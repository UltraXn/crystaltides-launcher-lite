use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
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
        if decoder.take(16 * 1024 * 1024).read_to_end(&mut decompressed).is_ok() {
            return decompressed;
        }
    }
    raw.to_vec()
}

/// Lee `.minecraft/servers.dat` de forma nativa en memoria
#[tauri::command]
pub fn read_servers_dat(game_dir: String) -> Result<Vec<ServerEntry>, String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let servers_file = Path::new(&game_dir).join("servers.dat");
    if !servers_file.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read(&servers_file)
        .map_err(|e| format!("Error al leer servers.dat: {}", e))?;

    let bytes = decompress_if_gzip(&raw);

    let dat: ServersDat = fastnbt::from_bytes(&bytes)
        .map_err(|e| format!("Error deserializando NBT de servers.dat: {}", e))?;

    Ok(dat.servers)
}

/// Guarda `.minecraft/servers.dat` serializando atómicamente en formato NBT
#[tauri::command]
pub fn save_servers_dat(game_dir: String, servers: Vec<ServerEntry>) -> Result<(), String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let game_path = Path::new(&game_dir);
    if !game_path.exists() {
        let _ = fs::create_dir_all(game_path);
    }
    let servers_file = game_path.join("servers.dat");
    let dat = ServersDat { servers };

    let nbt_bytes = fastnbt::to_bytes(&dat)
        .map_err(|e| format!("Error serializando NBT: {}", e))?;

    // Minecraft soporta servers.dat tanto sin comprimir como GZipped; GZipping asegura máxima compatibilidad
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(&nbt_bytes)
        .map_err(|e| format!("Error comprimiendo NBT: {}", e))?;
    let compressed = encoder
        .finish()
        .map_err(|e| format!("Error finalizando compresión GZip: {}", e))?;

    let temp_file = Path::new(&game_dir).join("servers.dat.tmp");
    fs::write(&temp_file, &compressed)
        .map_err(|e| format!("Error escribiendo archivo temporal servers.dat: {}", e))?;

    fs::rename(&temp_file, &servers_file)
        .map_err(|e| format!("Error reemplazando servers.dat: {}", e))?;

    crate::logger::log(
        "INFO",
        "NBTManager",
        &format!("servers.dat actualizado exitosamente con {} servidores", dat.servers.len()),
    );

    Ok(())
}

fn read_save_icon_base64(path: &Path) -> Option<String> {
    let icon_path = path.join("icon.png");
    if icon_path.exists() {
        fs::read(&icon_path).ok().map(|b| {
            format!("data:image/png;base64,{}", general_purpose_base64(&b))
        })
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

/// Escanea `.minecraft/saves` y extrae metadatos e iconos de mundos locales con cero coste en JS
#[tauri::command]
pub fn list_singleplayer_saves(game_dir: String) -> Result<Vec<SingleplayerSaveInfo>, String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let saves_dir = Path::new(&game_dir).join("saves");
    if !saves_dir.exists() || !saves_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();
    let entries = fs::read_dir(&saves_dir)
        .map_err(|e| format!("Error leyendo directorio saves: {}", e))?;

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

fn general_purpose_base64(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(CHARSET[((n >> 18) & 63) as usize] as char);
        out.push(CHARSET[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}
