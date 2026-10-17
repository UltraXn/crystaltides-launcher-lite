use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServerEntry {
    pub name: String,
    pub ip: String,
    pub icon: Option<String>,
    #[serde(rename = "acceptTextures")]
    pub accept_textures: Option<i8>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServersDat {
    pub servers: Vec<ServerEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SingleplayerSaveInfo {
    pub folder_name: String,
    pub level_name: String,
    pub last_played: i64,
    pub game_type: i32,
    pub hardcore: bool,
    pub version_name: Option<String>,
    pub icon_base64: Option<String>,
}

#[derive(Deserialize, Debug)]
struct LevelDatData {
    #[serde(rename = "LevelName")]
    level_name: Option<String>,
    #[serde(rename = "LastPlayed")]
    last_played: Option<i64>,
    #[serde(rename = "GameType")]
    game_type: Option<i32>,
    hardcore: Option<i8>,
    #[serde(rename = "Version")]
    version: Option<LevelDatVersion>,
}

#[derive(Deserialize, Debug)]
struct LevelDatVersion {
    #[serde(rename = "Name")]
    name: Option<String>,
}

#[derive(Deserialize, Debug)]
struct LevelDatRoot {
    #[serde(rename = "Data")]
    data: Option<LevelDatData>,
}

/// Helper para descomprimir datos que pueden estar o no en formato GZip
fn decompress_if_gzip(raw: &[u8]) -> Vec<u8> {
    if raw.len() >= 2 && raw[0] == 0x1F && raw[1] == 0x8B {
        let decoder = GzDecoder::new(raw);
        let mut decompressed = Vec::new();
        if decoder
            .take(16 * 1024 * 1024)
            .read_to_end(&mut decompressed)
            .is_ok()
        {
            return decompressed;
        }
    }
    raw.to_vec()
}

/// Lee `.minecraft/servers.dat` de forma nativa en memoria (versión síncrona interna)
pub fn read_servers_dat_sync(game_dir: &str) -> Result<Vec<ServerEntry>, String> {
    crate::agent::validate_game_dir(game_dir)?;
    let servers_file = Path::new(game_dir).join("servers.dat");
    if !servers_file.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read(&servers_file).map_err(|e| format!("Error al leer servers.dat: {}", e))?;

    let bytes = decompress_if_gzip(&raw);

    let dat: ServersDat = fastnbt::from_bytes(&bytes)
        .map_err(|e| format!("Error deserializando NBT de servers.dat: {}", e))?;

    Ok(dat.servers)
}

#[tauri::command]
pub async fn read_servers_dat(game_dir: String) -> Result<Vec<ServerEntry>, String> {
    tokio::task::spawn_blocking(move || read_servers_dat_sync(&game_dir))
        .await
        .map_err(|e| e.to_string())?
}

/// Guarda `.minecraft/servers.dat` serializando atómicamente en formato NBT (versión síncrona interna)
pub fn save_servers_dat_sync(game_dir: &str, servers: Vec<ServerEntry>) -> Result<(), String> {
    crate::agent::validate_game_dir(game_dir)?;
    let game_path = Path::new(game_dir);
    if !game_path.exists() {
        let _ = fs::create_dir_all(game_path);
    }
    let servers_file = game_path.join("servers.dat");
    let dat = ServersDat { servers };

    let nbt_bytes =
        fastnbt::to_bytes(&dat).map_err(|e| format!("Error serializando NBT: {}", e))?;

    // Minecraft vanilla lee servers.dat estrictamente sin comprimir (uncompressed NBT compound tag)
    let temp_file = Path::new(game_dir).join("servers.dat.tmp");
    fs::write(&temp_file, &nbt_bytes)
        .map_err(|e| format!("Error escribiendo archivo temporal servers.dat: {}", e))?;

    fs::rename(&temp_file, &servers_file)
        .map_err(|e| format!("Error reemplazando servers.dat: {}", e))?;

    crate::logger::log(
        "INFO",
        "NBTManager",
        &format!(
            "servers.dat actualizado exitosamente con {} servidores",
            dat.servers.len()
        ),
    );

    Ok(())
}

#[tauri::command]
pub async fn save_servers_dat(game_dir: String, servers: Vec<ServerEntry>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || save_servers_dat_sync(&game_dir, servers))
        .await
        .map_err(|e| e.to_string())?
}

fn read_save_icon_base64(path: &Path) -> Option<String> {
    let icon_path = path.join("icon.png");
    if icon_path.exists() {
        use base64::prelude::*;
        fs::read(&icon_path)
            .ok()
            .map(|b| format!("data:image/png;base64,{}", BASE64_STANDARD.encode(&b)))
    } else {
        None
    }
}

fn parse_save_level_data(path: &Path, folder_name: &str) -> Option<SingleplayerSaveInfo> {
    let level_dat_path = path.join("level.dat");
    if !level_dat_path.exists() {
        return None;
    }

    let raw = fs::read(&level_dat_path).ok()?;
    let bytes = decompress_if_gzip(&raw);
    let root = fastnbt::from_bytes::<LevelDatRoot>(&bytes).ok()?;
    let data = root.data?;

    let level_name = data.level_name.unwrap_or_else(|| folder_name.to_string());
    let last_played = data.last_played.unwrap_or(0);
    let game_type = data.game_type.unwrap_or(0);
    let hardcore = data.hardcore.unwrap_or(0) == 1;
    let version_name = data.version.and_then(|v| v.name);
    let icon_base64 = read_save_icon_base64(path);

    Some(SingleplayerSaveInfo {
        folder_name: folder_name.to_string(),
        level_name,
        last_played,
        game_type,
        hardcore,
        version_name,
        icon_base64,
    })
}

/// Escanea `.minecraft/saves` y extrae metadatos e iconos de mundos locales con cero coste en JS (versión síncrona interna)
pub fn list_singleplayer_saves_sync(game_dir: &str) -> Result<Vec<SingleplayerSaveInfo>, String> {
    crate::agent::validate_game_dir(game_dir)?;
    let saves_dir = Path::new(game_dir).join("saves");
    if !saves_dir.exists() || !saves_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();
    let entries =
        fs::read_dir(&saves_dir).map_err(|e| format!("Error leyendo directorio saves: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = entry.file_name().to_string_lossy().to_string();
        if let Some(save_info) = parse_save_level_data(&path, &folder_name) {
            result.push(save_info);
        }
    }

    // Ordenar de más reciente a más antiguo
    result.sort_by(|a, b| b.last_played.cmp(&a.last_played));

    Ok(result)
}

#[tauri::command]
pub async fn list_singleplayer_saves(
    game_dir: String,
) -> Result<Vec<SingleplayerSaveInfo>, String> {
    tokio::task::spawn_blocking(move || list_singleplayer_saves_sync(&game_dir))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    #[test]
    fn test_servers_dat_uncompressed_roundtrip() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let game_dir = temp_dir.path().to_string_lossy().to_string();

        let entries = vec![
            ServerEntry {
                name: "CrystalTides SMP".to_string(),
                ip: "play.crystaltides.net".to_string(),
                icon: None,
                accept_textures: Some(1),
            },
            ServerEntry {
                name: "Local Test Server".to_string(),
                ip: "127.0.0.1:25565".to_string(),
                icon: Some("data:image/png;base64,abc".to_string()),
                accept_textures: None,
            },
        ];

        save_servers_dat_sync(&game_dir, entries).expect("save servers.dat");

        let file_path = temp_dir.path().join("servers.dat");
        assert!(file_path.exists());
        let raw = fs::read(&file_path).expect("read raw servers.dat");
        // Must NOT be GZipped (vanilla standard)
        assert!(raw.len() < 2 || raw[0] != 0x1F || raw[1] != 0x8B);

        let loaded = read_servers_dat_sync(&game_dir).expect("read servers.dat");
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].name, "CrystalTides SMP");
        assert_eq!(loaded[0].ip, "play.crystaltides.net");
        assert_eq!(loaded[0].accept_textures, Some(1));
        assert_eq!(loaded[1].name, "Local Test Server");
    }

    #[test]
    fn test_servers_dat_legacy_gzip_backwards_compatible() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let game_dir = temp_dir.path().to_string_lossy().to_string();

        let entries = vec![ServerEntry {
            name: "Legacy GZipped Server".to_string(),
            ip: "legacy.crystaltides.net".to_string(),
            icon: None,
            accept_textures: Some(0),
        }];
        let dat = ServersDat { servers: entries };
        let nbt_bytes = fastnbt::to_bytes(&dat).expect("to_bytes");

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&nbt_bytes).expect("compress");
        let compressed = encoder.finish().expect("finish");

        fs::write(temp_dir.path().join("servers.dat"), compressed).expect("write compressed");

        let loaded = read_servers_dat_sync(&game_dir).expect("read legacy servers.dat");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "Legacy GZipped Server");
        assert_eq!(loaded[0].ip, "legacy.crystaltides.net");
    }
}
