use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

static DISCORD_CLIENT: Mutex<Option<DiscordPipeClient>> = Mutex::new(None);
static PLAY_START_TIMESTAMP: AtomicU64 = AtomicU64::new(0);

pub struct DiscordPipeClient {
    #[cfg(target_os = "windows")]
    pipe: std::fs::File,
    #[allow(dead_code)]
    pub client_id: String,
}

impl DiscordPipeClient {
    pub fn connect(client_id: &str) -> Option<Self> {
        #[cfg(target_os = "windows")]
        {
            use std::fs::OpenOptions;
            for i in 0..10 {
                let pipe_path = format!(r"\\.\pipe\discord-ipc-{}", i);
                if let Ok(mut file) = OpenOptions::new().read(true).write(true).open(&pipe_path) {
                    // Handshake: Opcode 0 (Handshake) + Length (u32 LE) + JSON payload
                    let handshake_payload = json!({
                        "v": 1,
                        "client_id": client_id
                    }).to_string();

                    if send_ipc_frame(&mut file, 0, &handshake_payload).is_ok() {
                        // Read initial response frame
                        let mut buf = [0u8; 1024];
                        let _ = std::io::Read::read(&mut file, &mut buf);
                        return Some(DiscordPipeClient {
                            pipe: file,
                            client_id: client_id.to_string(),
                        });
                    }
                }
            }
        }
        None
    }

    pub fn update_presence(&mut self, state: &str, details: &str, start_timestamp: Option<u64>) -> std::io::Result<()> {
        #[cfg(target_os = "windows")]
        {
            let mut activity = json!({
                "state": state,
                "details": details,
                "assets": {
                    "large_image": "crystaltides_logo",
                    "large_text": "CrystalTides SMP",
                    "small_image": "crystal_gem",
                    "small_text": "Lite Launcher"
                }
            });

            if let Some(start) = start_timestamp {
                activity["timestamps"] = json!({ "start": start });
            }

            let payload = json!({
                "cmd": "SET_ACTIVITY",
                "args": {
                    "pid": std::process::id(),
                    "activity": activity
                },
                "nonce": format!("{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis())
            }).to_string();

            send_ipc_frame(&mut self.pipe, 1, &payload)?;
            let mut buf = [0u8; 1024];
            let _ = std::io::Read::read(&mut self.pipe, &mut buf);
        }
        Ok(())
    }

    pub fn clear_presence(&mut self) -> std::io::Result<()> {
        #[cfg(target_os = "windows")]
        {
            let payload = json!({
                "cmd": "SET_ACTIVITY",
                "args": {
                    "pid": std::process::id(),
                    "activity": null
                },
                "nonce": format!("{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis())
            }).to_string();

            send_ipc_frame(&mut self.pipe, 1, &payload)?;
            let mut buf = [0u8; 1024];
            let _ = std::io::Read::read(&mut self.pipe, &mut buf);
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn send_ipc_frame(file: &mut std::fs::File, opcode: u32, payload: &str) -> std::io::Result<()> {
    use std::io::Write;
    let payload_bytes = payload.as_bytes();
    let length = payload_bytes.len() as u32;

    file.write_all(&opcode.to_le_bytes())?;
    file.write_all(&length.to_le_bytes())?;
    file.write_all(payload_bytes)?;
    file.flush()?;
    Ok(())
}

const DEFAULT_DISCORD_APP_ID: &str = "1284568903214567890"; // Client ID de CrystalTides

#[tauri::command]
pub fn set_discord_presence(state: String, details: String, is_playing: bool) -> Result<(), String> {
    let mut lock = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;

    if lock.is_none() {
        *lock = DiscordPipeClient::connect(DEFAULT_DISCORD_APP_ID);
    }

    let start_time = if is_playing {
        let existing = PLAY_START_TIMESTAMP.load(Ordering::SeqCst);
        if existing > 0 {
            Some(existing)
        } else {
            let now_secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            PLAY_START_TIMESTAMP.store(now_secs, Ordering::SeqCst);
            Some(now_secs)
        }
    } else {
        PLAY_START_TIMESTAMP.store(0, Ordering::SeqCst);
        None
    };

    if let Some(ref mut client) = *lock {
        if let Err(e) = client.update_presence(&state, &details, start_time) {
            crate::logger::log(
                "WARN",
                "DiscordRPC",
                &format!("Error enviando presencia a Discord IPC ({}), reintentando reconexión inmediata...", e),
            );
            *lock = None;
        }
    }

    // Si falló o el cliente no estaba conectado, intentar reconectar y enviar de inmediato
    if lock.is_none() {
        *lock = DiscordPipeClient::connect(DEFAULT_DISCORD_APP_ID);
        if let Some(ref mut client) = *lock {
            if let Err(e) = client.update_presence(&state, &details, start_time) {
                crate::logger::log(
                    "WARN",
                    "DiscordRPC",
                    &format!("Fallo al reconectar y enviar presencia a Discord: {}", e),
                );
                *lock = None;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn clear_discord_presence() -> Result<(), String> {
    PLAY_START_TIMESTAMP.store(0, Ordering::SeqCst);
    let mut lock = DISCORD_CLIENT.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut client) = *lock {
        if let Err(e) = client.clear_presence() {
            crate::logger::log(
                "WARN",
                "DiscordRPC",
                &format!("Error limpiando presencia en Discord IPC, liberando cliente: {}", e),
            );
            *lock = None;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_play_start_timestamp_lifecycle() {
        PLAY_START_TIMESTAMP.store(0, Ordering::SeqCst);
        assert_eq!(PLAY_START_TIMESTAMP.load(Ordering::SeqCst), 0);

        let t1 = 12345678u64;
        PLAY_START_TIMESTAMP.store(t1, Ordering::SeqCst);
        assert_eq!(PLAY_START_TIMESTAMP.load(Ordering::SeqCst), t1);

        let _ = clear_discord_presence();
        assert_eq!(PLAY_START_TIMESTAMP.load(Ordering::SeqCst), 0);
    }
}
