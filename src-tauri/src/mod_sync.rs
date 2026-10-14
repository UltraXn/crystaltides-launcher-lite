use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Semaphore;

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct ModDownloadItem {
    pub name: String,
    pub url: String,
    pub sha1: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct ModSyncEntry {
    pub source: String,
    pub filename: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct LocalModItem {
    pub filename: String,
    pub size_bytes: u64,
    pub enabled: bool,
    pub official: bool,
}

const SYNC_MANIFEST_NAME: &str = ".crystaltides_sync.json";

/// Valida que el nombre de archivo no contenga rutas relativas ni traversal
fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty()
        || filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
    {
        return Err(format!("Nombre de archivo inválido o peligroso: {filename}"));
    }
    Ok(())
}

/// Lee el manifiesto de sincronización de la carpeta mods
fn read_manifest(target_dir: &Path) -> Vec<String> {
    let path = target_dir.join(SYNC_MANIFEST_NAME);
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// Escribe el manifiesto de sincronización
fn write_manifest(target_dir: &Path, files: &[String]) -> Result<(), String> {
    let path = target_dir.join(SYNC_MANIFEST_NAME);
    let json = serde_json::to_string_pretty(files).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

/// Descarga archivos en paralelo hacia una carpeta destino (Virtual Library)
async fn is_cached_file_valid(file_path: &Path, expected_sha1: &str) -> bool {
    if !file_path.exists() {
        return false;
    }
    if let Ok(bytes) = tokio::fs::read(file_path).await {
        use sha1::{Digest, Sha1};
        let mut hasher = Sha1::new();
        hasher.update(&bytes);
        let local_hash = hex::encode(hasher.finalize());
        return local_hash.eq_ignore_ascii_case(expected_sha1);
    }
    false
}

async fn fetch_and_verify_mod(
    client: &reqwest::Client,
    mod_item: &ModDownloadItem,
) -> Result<Vec<u8>, String> {
    let res = client
        .get(&mod_item.url)
        .send()
        .await
        .map_err(|e| format!("Error solicitando {}: {}", mod_item.name, e))?;

    if !res.status().is_success() {
        return Err(format!("Error HTTP {} al descargar {}", res.status(), mod_item.name));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?.to_vec();

    use sha1::{Digest, Sha1};
    let mut hasher = Sha1::new();
    hasher.update(&bytes);
    let computed_hash = hex::encode(hasher.finalize());

    if !computed_hash.eq_ignore_ascii_case(&mod_item.sha1) {
        return Err(format!(
            "SHA-1 inválido para {}: esperado {}, obtenido {}",
            mod_item.name, mod_item.sha1, computed_hash
        ));
    }

    Ok(bytes)
}

async fn process_mod_download(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    target_dir: &str,
    mod_item: ModDownloadItem,
    idx: usize,
) -> Result<(), String> {
    validate_filename(&mod_item.name)?;
    let file_path = Path::new(target_dir).join(&mod_item.name);

    if is_cached_file_valid(&file_path, &mod_item.sha1).await {
        let _ = app.emit("mod-download-progress", idx);
        return Ok(());
    }

    let bytes = fetch_and_verify_mod(client, &mod_item).await?;
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e| format!("Error guardando {}: {}", mod_item.name, e))?;

    let _ = app.emit("mod-download-progress", idx);
    Ok(())
}

/// Descarga archivos en paralelo hacia una carpeta destino (Virtual Library)
#[tauri::command]
pub async fn download_mods_parallel(
    app_handle: tauri::AppHandle,
    mods: Vec<ModDownloadItem>,
    output_dir: String,
    max_concurrent: Option<i32>,
) -> Result<(), String> {
    crate::agent::validate_game_dir(&output_dir)?;
    let out_path = PathBuf::from(&output_dir);
    if !out_path.exists() {
        fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let concurrency = max_concurrent.unwrap_or(4).clamp(1, 8) as usize;
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for (idx, mod_item) in mods.into_iter().enumerate() {
        let client = client.clone();
        let sem = semaphore.clone();
        let target_dir = output_dir.clone();
        let app = app_handle.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.map_err(|e| e.to_string())?;
            process_mod_download(&app, &client, &target_dir, mod_item, idx).await
        });

        handles.push(handle);
    }

    for handle in handles {
        handle.await.map_err(|e| e.to_string())??;
    }

    Ok(())
}

fn link_or_copy_mod_entry(mods_dir: &Path, entry: &ModSyncEntry) -> Result<(), String> {
    validate_filename(&entry.filename)?;
    let source_path = Path::new(&entry.source);
    let dest_path = mods_dir.join(&entry.filename);
    let disabled_path = mods_dir.join(format!("{}.disabled", entry.filename));

    if dest_path.exists() || disabled_path.exists() {
        return Ok(());
    }

    if source_path.exists() {
        if fs::hard_link(source_path, &dest_path).is_err() {
            fs::copy(source_path, &dest_path)
                .map_err(|e| format!("Error copiando {} a mods: {}", entry.filename, e))?;
        }
    } else {
        crate::logger::log(
            "WARN",
            "ModSync",
            &format!("Archivo fuente no encontrado: {}", entry.source),
        );
    }
    Ok(())
}

fn cleanup_stale_mods(mods_dir: &Path, intended_files: &[String]) {
    let prev_manifest = read_manifest(mods_dir);
    for old_file in prev_manifest {
        if !intended_files.contains(&old_file) {
            let stale_path = mods_dir.join(&old_file);
            let stale_disabled = mods_dir.join(format!("{}.disabled", old_file));
            if stale_path.exists() {
                let _ = fs::remove_file(stale_path);
            }
            if stale_disabled.exists() {
                let _ = fs::remove_file(stale_disabled);
            }
        }
    }
}

/// Sincroniza mods en el directorio mods/ de la instancia mediante hardlinks/copias
/// Limpieza no destructiva: solo elimina mods antiguos que pertenecían al manifiesto anterior
#[tauri::command]
pub fn sync_mods(target_dir: String, mod_list_json: String) -> Result<(), String> {
    crate::agent::validate_game_dir(&target_dir)?;
    let mods_dir = Path::new(&target_dir);
    if !mods_dir.exists() {
        fs::create_dir_all(mods_dir).map_err(|e| e.to_string())?;
    }

    let entries: Vec<ModSyncEntry> =
        serde_json::from_str(&mod_list_json).map_err(|e| format!("JSON corrupto: {e}"))?;

    let mut intended_files = Vec::new();
    for entry in &entries {
        link_or_copy_mod_entry(mods_dir, entry)?;
        intended_files.push(entry.filename.clone());
    }

    cleanup_stale_mods(mods_dir, &intended_files);
    write_manifest(mods_dir, &intended_files)?;
    Ok(())
}

/// Lista los mods presentes en una instancia
#[tauri::command]
pub fn list_instance_mods(target_dir: String) -> Result<Vec<LocalModItem>, String> {
    crate::agent::validate_game_dir(&target_dir)?;
    let mods_dir = Path::new(&target_dir);
    let mut items = Vec::new();

    if !mods_dir.exists() {
        return Ok(items);
    }

    let official_files: std::collections::HashSet<String> =
        read_manifest(mods_dir).into_iter().collect();

    let dir_entries = fs::read_dir(mods_dir).map_err(|e| e.to_string())?;

    for entry in dir_entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let enabled = if name.ends_with(".jar") {
            true
        } else if name.ends_with(".jar.disabled") {
            false
        } else {
            continue;
        };

        let base_name = name.trim_end_matches(".disabled").to_string();
        let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

        items.push(LocalModItem {
            filename: name,
            size_bytes,
            enabled,
            official: official_files.contains(&base_name),
        });
    }

    items.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
    Ok(items)
}

/// Activa o desactiva un mod (.jar <-> .jar.disabled)
#[tauri::command]
pub fn toggle_instance_mod(target_dir: String, filename: String, enable: bool) -> Result<(), String> {
    crate::agent::validate_game_dir(&target_dir)?;
    validate_filename(&filename)?;
    let mods_dir = Path::new(&target_dir);
    let from_path = mods_dir.join(&filename);

    if !from_path.exists() {
        return Err(format!("El archivo no existe: {filename}"));
    }

    let to_path = if enable {
        if !filename.ends_with(".jar.disabled") {
            return Ok(());
        }
        mods_dir.join(filename.trim_end_matches(".disabled"))
    } else {
        if filename.ends_with(".jar.disabled") {
            return Ok(());
        }
        mods_dir.join(format!("{filename}.disabled"))
    };

    fs::rename(&from_path, &to_path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Elimina un archivo de mod
#[tauri::command]
pub fn delete_instance_mod(target_dir: String, filename: String) -> Result<(), String> {
    crate::agent::validate_game_dir(&target_dir)?;
    validate_filename(&filename)?;
    let path = Path::new(&target_dir).join(&filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Abre una carpeta en el Explorador de archivos del sistema operativo
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let clean_path = path.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let clean_path = path;

    let p = PathBuf::from(&clean_path);
    if !p.exists() {
        let _ = fs::create_dir_all(&p);
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&clean_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&clean_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&clean_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Asegura que el archivo servers.dat de Minecraft contenga play.crystaltides.net
#[tauri::command]
pub fn ensure_servers_dat(game_dir: String) -> Result<(), String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let p = Path::new(&game_dir);
    if !p.exists() {
        let _ = std::fs::create_dir_all(p);
    }
    let servers_file = p.join("servers.dat");
    if !servers_file.exists() {
        let default_entry = crate::nbt_manager::ServerEntry {
            name: "CrystalTides SMP".to_string(),
            ip: "mc.crystaltidessmp.net".to_string(),
            icon: None,
            accept_textures: None,
        };
        crate::nbt_manager::save_servers_dat(game_dir, vec![default_entry])?;
    }

    Ok(())
}
