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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_mods_empty() {
        let temp = tempfile::tempdir().expect("tempdir");
        let result = sync_mods_sync(&temp.path().to_string_lossy(), "[]");
        assert!(result.is_ok());
    }

    #[test]
    fn test_sync_mods_rejects_source_outside_authorized_roots() {
        let temp = tempfile::tempdir().expect("tempdir");
        #[cfg(target_os = "windows")]
        let outside = r"C:\Windows\System32\drivers\etc\hosts";
        #[cfg(not(target_os = "windows"))]
        let outside = "/etc/hosts";

        let entries = serde_json::json!([{ "source": outside, "filename": "hosts.jar" }]);
        let result = sync_mods_sync(&temp.path().to_string_lossy(), &entries.to_string());
        assert!(result.is_err());
        assert!(!temp.path().join("hosts.jar").exists());
    }

    #[test]
    fn test_cleanup_ignores_traversal_names_in_manifest() {
        let temp = tempfile::tempdir().expect("tempdir");
        let mods_dir = temp.path().join("mods");
        fs::create_dir_all(&mods_dir).expect("mods dir");
        let victim = temp.path().join("victim.txt");
        fs::write(&victim, b"no me borres").expect("victim");
        fs::write(mods_dir.join("viejo.jar"), b"jar").expect("old mod");
        write_manifest(
            &mods_dir,
            &["../victim.txt".to_string(), "viejo.jar".to_string()],
        )
        .expect("manifest");

        cleanup_stale_mods(&mods_dir, &[]);

        assert!(
            victim.exists(),
            "un nombre con '..' no debe borrar fuera de mods/"
        );
        assert!(!mods_dir.join("viejo.jar").exists());
    }

    #[test]
    fn test_validate_filename_rejects_alternate_data_streams() {
        assert!(validate_filename("sodium.jar").is_ok());
        assert!(validate_filename("sodium.jar:oculto").is_err());
        assert!(validate_filename("C:mod.jar").is_err());
    }

    fn download_item(name: &str, sha1: &str) -> ModDownloadItem {
        ModDownloadItem {
            name: name.to_string(),
            url: "https://cdn.modrinth.com/data/x/sodium.jar".to_string(),
            sha1: sha1.to_string(),
        }
    }

    #[test]
    fn test_parse_sha1_requires_40_hex_chars() {
        let hash = "A94A8FE5CCB19BA61C4C0873D391E987982FBBD3";
        assert_eq!(
            parse_sha1("m", &format!(" {hash} ")).unwrap(),
            hash.to_ascii_lowercase()
        );

        assert!(parse_sha1("m", "").is_err());
        assert!(parse_sha1("m", "   ").is_err());
        assert!(parse_sha1("m", &hash[..39]).is_err());
        assert!(parse_sha1("m", &format!("{}g", &hash[..39])).is_err());
        // Un SHA-256 no es un SHA-1
        assert!(parse_sha1("m", &"a".repeat(64)).is_err());
    }

    #[test]
    fn test_download_list_rejects_mod_without_hash_before_downloading() {
        let valid = "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3";
        let err = validate_download_list(vec![
            download_item("sodium.jar", valid),
            download_item("lithium.jar", ""),
        ])
        .unwrap_err();
        assert!(err.contains("lithium.jar"), "{err}");

        assert!(validate_download_list(vec![download_item("../x.jar", valid)]).is_err());

        let ok = validate_download_list(vec![download_item("sodium.jar", &valid.to_uppercase())])
            .unwrap();
        assert_eq!(ok[0].sha1, valid);
    }
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

/// Valida que el nombre de archivo no contenga rutas relativas ni traversal. `:` se rechaza
/// porque en Windows `mod.jar:x` escribe en un stream alternativo de `mod.jar`.
fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty()
        || filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains(':')
    {
        return Err(format!(
            "Nombre de archivo inválido o peligroso: {filename}"
        ));
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

/// Un mod se ejecuta dentro del juego con los permisos del usuario: sin un SHA-1 con el que
/// comprobar el archivo descargado no se instala.
fn parse_sha1(mod_name: &str, sha1: &str) -> Result<String, String> {
    let hex = sha1.trim();
    if hex.len() == 40 && hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        Ok(hex.to_ascii_lowercase())
    } else {
        Err(format!(
            "El mod {mod_name} no trae un SHA-1 válido y no se descarga sin verificar."
        ))
    }
}

/// Se valida la lista entera antes de descargar nada, para no dejar la mitad de los mods bajados.
fn validate_download_list(mods: Vec<ModDownloadItem>) -> Result<Vec<ModDownloadItem>, String> {
    mods.into_iter()
        .map(|mod_item| {
            validate_filename(&mod_item.name)?;
            let sha1 = parse_sha1(&mod_item.name, &mod_item.sha1)?;
            Ok(ModDownloadItem { sha1, ..mod_item })
        })
        .collect()
}

async fn process_mod_download(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    target_dir: &str,
    mod_item: ModDownloadItem,
    idx: usize,
) -> Result<(), String> {
    let file_path = Path::new(target_dir).join(&mod_item.name);
    let expected_hash = crate::downloader::ExpectedHash::Sha1(mod_item.sha1);

    crate::downloader::download_verified(client, &mod_item.url, &file_path, &expected_hash, true)
        .await?;

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
    let mods = validate_download_list(mods)?;
    let out_path = PathBuf::from(&output_dir);
    if !out_path.exists() {
        fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
    }

    let client = crate::get_shared_http_client().clone();

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
    // Sin validar, el origen permitía copiar a mods/ cualquier archivo del sistema
    let source_path = crate::paths::validate_safe_file_path(&entry.source)?;
    let source_path = source_path.as_path();
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
        // El manifiesto está en disco y una instancia importada puede traerlo manipulado:
        // un nombre con `..` borraría archivos fuera de mods/
        if let Err(e) = validate_filename(&old_file) {
            crate::logger::log("WARN", "ModSync", &format!("Manifiesto ignorado: {}", e));
            continue;
        }
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
/// Limpieza no destructiva: solo elimina mods antiguos que pertenecían al manifiesto anterior (versión síncrona interna)
pub fn sync_mods_sync(target_dir: &str, mod_list_json: &str) -> Result<(), String> {
    crate::agent::validate_game_dir(target_dir)?;
    let mods_dir = Path::new(target_dir);
    if !mods_dir.exists() {
        fs::create_dir_all(mods_dir).map_err(|e| e.to_string())?;
    }

    let entries: Vec<ModSyncEntry> =
        serde_json::from_str(mod_list_json).map_err(|e| format!("JSON corrupto: {e}"))?;

    let mut intended_files = Vec::new();
    for entry in &entries {
        link_or_copy_mod_entry(mods_dir, entry)?;
        intended_files.push(entry.filename.clone());
    }

    cleanup_stale_mods(mods_dir, &intended_files);
    write_manifest(mods_dir, &intended_files)?;
    Ok(())
}

/// Sincroniza mods en el directorio mods/ de la instancia mediante hardlinks/copias
#[tauri::command]
pub async fn sync_mods(target_dir: String, mod_list_json: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || sync_mods_sync(&target_dir, &mod_list_json))
        .await
        .map_err(|e| e.to_string())?
}

/// Lista los mods presentes en una instancia (versión síncrona interna)
pub fn list_instance_mods_sync(target_dir: &str) -> Result<Vec<LocalModItem>, String> {
    crate::agent::validate_game_dir(target_dir)?;
    let mods_dir = Path::new(target_dir);
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

    items.sort_by_key(|a| a.filename.to_lowercase());
    Ok(items)
}

/// Lista los mods presentes en una instancia
#[tauri::command]
pub async fn list_instance_mods(target_dir: String) -> Result<Vec<LocalModItem>, String> {
    tokio::task::spawn_blocking(move || list_instance_mods_sync(&target_dir))
        .await
        .map_err(|e| e.to_string())?
}

/// Activa o desactiva un mod (.jar <-> .jar.disabled) (versión síncrona interna)
pub fn toggle_instance_mod_sync(
    target_dir: &str,
    filename: &str,
    enable: bool,
) -> Result<(), String> {
    crate::agent::validate_game_dir(target_dir)?;
    validate_filename(filename)?;
    let mods_dir = Path::new(target_dir);
    let from_path = mods_dir.join(filename);

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

/// Activa o desactiva un mod (.jar <-> .jar.disabled)
#[tauri::command]
pub async fn toggle_instance_mod(
    target_dir: String,
    filename: String,
    enable: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || toggle_instance_mod_sync(&target_dir, &filename, enable))
        .await
        .map_err(|e| e.to_string())?
}

/// Elimina un archivo de mod (versión síncrona interna)
pub fn delete_instance_mod_sync(target_dir: &str, filename: &str) -> Result<(), String> {
    crate::agent::validate_game_dir(target_dir)?;
    validate_filename(filename)?;
    let path = Path::new(target_dir).join(filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Elimina un archivo de mod
#[tauri::command]
pub async fn delete_instance_mod(target_dir: String, filename: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || delete_instance_mod_sync(&target_dir, &filename))
        .await
        .map_err(|e| e.to_string())?
}

/// Abre una carpeta en el Explorador de archivos del sistema operativo usando tauri-plugin-opener
#[tauri::command]
pub async fn open_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let safe_path = crate::paths::validate_safe_file_path(&path)?;
    if !safe_path.exists() {
        let _ = fs::create_dir_all(&safe_path);
    }
    if !safe_path.is_dir() {
        return Err("Ruta no válida: debe ser un directorio.".to_string());
    }
    let path_str = safe_path.to_string_lossy().to_string();
    app.opener()
        .open_path(path_str, None::<&str>)
        .map_err(|e| format!("Error abriendo directorio: {e}"))
}

/// Asegura que el archivo servers.dat de Minecraft contenga play.crystaltides.net (versión síncrona interna)
pub fn ensure_servers_dat_sync(game_dir: &str) -> Result<(), String> {
    crate::agent::validate_game_dir(game_dir)?;
    let p = Path::new(game_dir);
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
        crate::nbt_manager::save_servers_dat_sync(game_dir, vec![default_entry])?;
    }

    Ok(())
}

/// Asegura que el archivo servers.dat de Minecraft contenga play.crystaltides.net
#[tauri::command]
pub async fn ensure_servers_dat(game_dir: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || ensure_servers_dat_sync(&game_dir))
        .await
        .map_err(|e| e.to_string())?
}
