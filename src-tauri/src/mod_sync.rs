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
#[tauri::command]
pub async fn download_mods_parallel(
    app_handle: tauri::AppHandle,
    mods: Vec<ModDownloadItem>,
    output_dir: String,
    max_concurrent: Option<i32>,
) -> Result<(), String> {
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
            validate_filename(&mod_item.name)?;

            let file_path = Path::new(&target_dir).join(&mod_item.name);

            // Si ya existe y el hash coincide, no re-descargar
            if file_path.exists() {
                if let Ok(bytes) = tokio::fs::read(&file_path).await {
                    use sha1::{Digest, Sha1};
                    let mut hasher = Sha1::new();
                    hasher.update(&bytes);
                    let local_hash = hex::encode(hasher.finalize());
                    if local_hash.eq_ignore_ascii_case(&mod_item.sha1) {
                        let _ = app.emit("mod-download-progress", idx);
                        return Ok::<(), String>(());
                    }
                }
            }

            // Descargar
            let res = client
                .get(&mod_item.url)
                .send()
                .await
                .map_err(|e| format!("Error solicitando {}: {}", mod_item.name, e))?;

            if !res.status().is_success() {
                return Err(format!("Error HTTP {} al descargar {}", res.status(), mod_item.name));
            }

            let bytes = res.bytes().await.map_err(|e| e.to_string())?;

            // Validar SHA1
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

            tokio::fs::write(&file_path, &bytes)
                .await
                .map_err(|e| format!("Error guardando {}: {}", mod_item.name, e))?;

            let _ = app.emit("mod-download-progress", idx);
            Ok(())
        });

        handles.push(handle);
    }

    for handle in handles {
        handle.await.map_err(|e| e.to_string())??;
    }

    Ok(())
}

/// Sincroniza mods en el directorio mods/ de la instancia mediante hardlinks/copias
/// Limpieza no destructiva: solo elimina mods antiguos que pertenecían al manifiesto anterior
#[tauri::command]
pub fn sync_mods(target_dir: String, mod_list_json: String) -> Result<(), String> {
    let mods_dir = Path::new(&target_dir);
    if !mods_dir.exists() {
        fs::create_dir_all(mods_dir).map_err(|e| e.to_string())?;
    }

    let entries: Vec<ModSyncEntry> =
        serde_json::from_str(&mod_list_json).map_err(|e| format!("JSON corrupto: {e}"))?;

    let mut intended_files = Vec::new();

    for entry in &entries {
        validate_filename(&entry.filename)?;
        let source_path = Path::new(&entry.source);
        let dest_path = mods_dir.join(&entry.filename);

        intended_files.push(entry.filename.clone());

        if !dest_path.exists() {
            if source_path.exists() {
                // Intentar hard link primero, si falla en discos cruzados usar copia
                if fs::hard_link(source_path, &dest_path).is_err() {
                    fs::copy(source_path, &dest_path).map_err(|e| {
                        format!("Error copiando {} a mods: {}", entry.filename, e)
                    })?;
                }
            } else {
                crate::logger::log(
                    "WARN",
                    "ModSync",
                    &format!("Archivo fuente no encontrado: {}", entry.source),
                );
            }
        }
    }

    // Limpieza de mods oficiales obsoletos
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

    write_manifest(mods_dir, &intended_files)?;
    Ok(())
}

/// Lista los mods presentes en una instancia
#[tauri::command]
pub fn list_instance_mods(target_dir: String) -> Result<Vec<LocalModItem>, String> {
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
    let p = Path::new(&game_dir);
    if !p.exists() {
        let _ = fs::create_dir_all(p);
    }

    let servers_file = p.join("servers.dat");
    if !servers_file.exists() {
        // NBT binario estándar de Minecraft para un único servidor
        let mut nbt_bytes = Vec::new();
        nbt_bytes.push(0x0Au8); // TAG_Compound
        nbt_bytes.extend_from_slice(&[0x00, 0x00]); // Root name: ""

        // TAG_List "servers"
        nbt_bytes.push(0x09u8);
        nbt_bytes.extend_from_slice(&(7u16).to_be_bytes());
        nbt_bytes.extend_from_slice(b"servers");
        nbt_bytes.push(0x0Au8); // List type: TAG_Compound
        nbt_bytes.extend_from_slice(&(1i32).to_be_bytes()); // 1 entry

        // Entry 1 TAG_Compound
        // TAG_String "name" -> "CrystalTides SMP"
        let name_bytes = b"CrystalTides SMP";
        nbt_bytes.push(0x08u8);
        nbt_bytes.extend_from_slice(&(4u16).to_be_bytes());
        nbt_bytes.extend_from_slice(b"name");
        nbt_bytes.extend_from_slice(&(name_bytes.len() as u16).to_be_bytes());
        nbt_bytes.extend_from_slice(name_bytes);

        // TAG_String "ip" -> "mc.crystaltidessmp.net"
        let ip_bytes = b"mc.crystaltidessmp.net";
        nbt_bytes.push(0x08u8);
        nbt_bytes.extend_from_slice(&(2u16).to_be_bytes());
        nbt_bytes.extend_from_slice(b"ip");
        nbt_bytes.extend_from_slice(&(ip_bytes.len() as u16).to_be_bytes());
        nbt_bytes.extend_from_slice(ip_bytes);

        // TAG_End for Entry 1
        nbt_bytes.push(0x00u8);

        // TAG_End for Root
        nbt_bytes.push(0x00u8);

        let _ = fs::write(&servers_file, nbt_bytes);
    }

    Ok(())
}
