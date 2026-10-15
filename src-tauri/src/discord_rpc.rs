use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static PLAY_START_TIMESTAMP: AtomicU64 = AtomicU64::new(0);

const DEFAULT_DISCORD_APP_ID: &str = "1284568903214567890"; // Client ID de CrystalTides

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
                    })
                    .to_string();

                    if send_ipc_frame(&mut file, 0, &handshake_payload).is_ok() {
                        let _ = read_ipc_frame(&mut file);
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

    pub fn update_presence(
        &mut self,
        state: &str,
        details: &str,
        start_timestamp: Option<u64>,
    ) -> std::io::Result<()> {
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
            let _ = read_ipc_frame(&mut self.pipe);
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
            let _ = read_ipc_frame(&mut self.pipe);
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

#[cfg(target_os = "windows")]
fn read_ipc_frame(file: &mut std::fs::File) -> std::io::Result<Vec<u8>> {
    use std::io::Read;
    let mut header = [0u8; 8];
    file.read_exact(&mut header)?;
    let length = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
    if length > 65536 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Discord IPC frame too large",
        ));
    }
    let mut payload = vec![0u8; length];
    file.read_exact(&mut payload)?;
    Ok(payload)
}

pub enum DiscordRpcCommand {
    SetPresence {
        state: String,
        details: String,
        is_playing: bool,
    },
    ClearPresence,
}

static RPC_CHANNEL: OnceLock<std::sync::mpsc::SyncSender<DiscordRpcCommand>> = OnceLock::new();

fn get_rpc_channel() -> &'static std::sync::mpsc::SyncSender<DiscordRpcCommand> {
    RPC_CHANNEL.get_or_init(|| {
        let (tx, rx) = std::sync::mpsc::sync_channel::<DiscordRpcCommand>(16);
        if let Err(e) = std::thread::Builder::new()
            .name("discord-rpc-worker".to_string())
            .spawn(move || {
                let mut client: Option<DiscordPipeClient> = None;
                while let Ok(cmd) = rx.recv() {
                    match cmd {
                        DiscordRpcCommand::SetPresence {
                            state,
                            details,
                            is_playing,
                        } => {
                            let start_time = if is_playing {
                                let existing = PLAY_START_TIMESTAMP.load(Ordering::SeqCst);
                                if existing > 0 {
                                    Some(existing)
                                } else {
                                    None
                                }
                            } else {
                                None
                            };

                            if client.is_none() {
                                client = DiscordPipeClient::connect(DEFAULT_DISCORD_APP_ID);
                            }

                            if let Some(ref mut c) = client {
                                if let Err(e) = c.update_presence(&state, &details, start_time) {
                                    crate::logger::log(
                                        "WARN",
                                        "DiscordRPC",
                                        &format!("Error enviando presencia a Discord IPC ({}). Reintentando reconexión...", e),
                                    );
                                    client = DiscordPipeClient::connect(DEFAULT_DISCORD_APP_ID);
                                    if let Some(ref mut c2) = client {
                                        let _ = c2.update_presence(&state, &details, start_time);
                                    }
                                }
                            }
                        }
                        DiscordRpcCommand::ClearPresence => {
                            if let Some(ref mut c) = client {
                                let _ = c.clear_presence();
                            }
                        }
                    }
                }
            }) {
            crate::logger::log(
                "ERROR",
                "DiscordRPC",
                &format!("Error iniciando hilo de Discord RPC: {}", e),
            );
        }
        tx
    })
}

pub fn set_discord_presence_sync(
    state: String,
    details: String,
    is_playing: bool,
) -> Result<(), String> {
    if is_playing {
        let existing = PLAY_START_TIMESTAMP.load(Ordering::SeqCst);
        if existing == 0 {
            let now_secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            PLAY_START_TIMESTAMP.store(now_secs, Ordering::SeqCst);
        }
    } else {
        PLAY_START_TIMESTAMP.store(0, Ordering::SeqCst);
    }

    let tx = get_rpc_channel();
    let _ = tx.try_send(DiscordRpcCommand::SetPresence {
        state,
        details,
        is_playing,
    });
    Ok(())
}

#[tauri::command]
pub async fn set_discord_presence(
    state: String,
    details: String,
    is_playing: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_discord_presence_sync(state, details, is_playing))
        .await
        .map_err(|e| e.to_string())?
}

pub fn clear_discord_presence_sync() -> Result<(), String> {
    PLAY_START_TIMESTAMP.store(0, Ordering::SeqCst);
    let tx = get_rpc_channel();
    let _ = tx.try_send(DiscordRpcCommand::ClearPresence);
    Ok(())
}

#[tauri::command]
pub async fn clear_discord_presence() -> Result<(), String> {
    tokio::task::spawn_blocking(clear_discord_presence_sync)
        .await
        .map_err(|e| e.to_string())?
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

        let _ = clear_discord_presence_sync();
        assert_eq!(PLAY_START_TIMESTAMP.load(Ordering::SeqCst), 0);
    }
}
