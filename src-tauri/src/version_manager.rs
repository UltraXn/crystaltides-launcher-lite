use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangVersionManifestEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangVersionManifest {
    pub latest: Option<MojangLatest>,
    pub versions: Vec<MojangVersionManifestEntry>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangLatest {
    pub release: String,
    pub snapshot: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangArtifact {
    pub path: Option<String>,
    pub url: Option<String>,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangDownloads {
    pub client: Option<MojangArtifact>,
    pub server: Option<MojangArtifact>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangLibrary {
    pub name: Option<String>,
    pub downloads: Option<MojangLibraryDownloads>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangLibraryDownloads {
    pub artifact: Option<MojangArtifact>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangAssetIndexRef {
    pub id: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
    #[serde(rename = "totalSize")]
    pub total_size: Option<u64>,
    pub url: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangVersionDetail {
    pub id: String,
    pub downloads: Option<MojangDownloads>,
    pub libraries: Option<Vec<MojangLibrary>>,
    #[serde(rename = "mainClass")]
    pub main_class: Option<String>,
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<MojangAssetIndexRef>,
    pub assets: Option<String>,
}

fn get_appdata_minecraft_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| {
        #[cfg(target_os = "windows")]
        {
            h.join("AppData").join("Roaming").join(".minecraft")
        }
        #[cfg(target_os = "macos")]
        {
            h.join("Library").join("Application Support").join("minecraft")
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            h.join(".minecraft")
        }
    })
}

/// Scans local directories for all installed versions with a .json file
pub fn get_installed_versions() -> Vec<String> {
    let mut versions = Vec::new();
    let home = dirs::home_dir();

    if let Some(ref h) = home {
        // 1. Check ~/.crystaltides/versions
        let ct_versions = h.join(".crystaltides").join("versions");
        scan_versions_in_dir(&ct_versions, &mut versions);

        // 2. Check %APPDATA%/.minecraft/versions
        if let Some(mc_dir) = get_appdata_minecraft_dir() {
            let mc_versions = mc_dir.join("versions");
            scan_versions_in_dir(&mc_versions, &mut versions);
        }
    }

    versions.sort();
    versions.dedup();
    versions.reverse(); // newer first

    // Prioritize 1.21.1 at the top of Minecraft versions
    if let Some(pos) = versions.iter().position(|v| v == "1.21.1") {
        let v = versions.remove(pos);
        versions.insert(0, v);
    }

    versions
}

fn scan_versions_in_dir(dir: &Path, versions: &mut Vec<String>) {
    if !dir.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let folder_name = entry.file_name().to_string_lossy().to_string();
                    let json_path = entry.path().join(format!("{}.json", folder_name));
                    if json_path.exists() {
                        versions.push(folder_name);
                    }
                }
            }
        }
    }
}

/// Ensures the version's jar and json exist in the game directory.
/// If not present, attempts to copy from .minecraft or download from Mojang.
pub async fn prepare_version(version_id: &str, game_dir_str: &str) -> Result<String, String> {
    let game_dir = Path::new(game_dir_str);
    let target_ver_dir = game_dir.join("versions").join(version_id);
    let target_jar = target_ver_dir.join(format!("{}.jar", version_id));
    let target_json = target_ver_dir.join(format!("{}.json", version_id));

    // If both jar and json already exist in game_dir, we're ready
    if target_jar.exists() && target_json.exists() {
        return Ok(format!("Version {} ya lista en {}", version_id, game_dir_str));
    }

    fs::create_dir_all(&target_ver_dir)
        .map_err(|e| format!("No se pudo crear carpeta de versión {}: {}", version_id, e))?;

    // 1. Try copying from local .minecraft
    if let Some(mc_dir) = get_appdata_minecraft_dir() {
        let mc_ver_dir = mc_dir.join("versions").join(version_id);
        let mc_jar = mc_ver_dir.join(format!("{}.jar", version_id));
        let mc_json = mc_ver_dir.join(format!("{}.json", version_id));

        if mc_json.exists() && !target_json.exists() {
            let _ = fs::copy(&mc_json, &target_json);
        }
        if mc_jar.exists() && !target_jar.exists() {
            let _ = fs::copy(&mc_jar, &target_jar);
            println!("[VersionManager] Copied {} jar and json from .minecraft", version_id);
            return Ok(format!("Version {} copiada desde .minecraft", version_id));
        }
    }

    // 2. Download from Mojang Piston Meta
    println!("[VersionManager] Downloading manifest for {} from Mojang...", version_id);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let manifest_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    let manifest_resp = client.get(manifest_url).send().await.map_err(|e| format!("Error conectando con Mojang: {}", e))?;
    let manifest: MojangVersionManifest = manifest_resp.json().await.map_err(|e| format!("Error parseando manifiesto de Mojang: {}", e))?;

    let version_entry = manifest.versions.iter().find(|v| v.id == version_id)
        .ok_or_else(|| format!("Versión '{}' no encontrada en el catálogo oficial de Mojang ni en instalaciones locales.", version_id))?;

    println!("[VersionManager] Found version entry URL: {}", version_entry.url);
    let detail_resp = client.get(&version_entry.url).send().await.map_err(|e| format!("Error descargando json de versión: {}", e))?;
    let detail_bytes = detail_resp.bytes().await.map_err(|e| e.to_string())?;

    // Save version json
    fs::write(&target_json, &detail_bytes).map_err(|e| format!("Error guardando {}.json: {}", version_id, e))?;

    let detail: MojangVersionDetail = serde_json::from_slice(&detail_bytes)
        .map_err(|e| format!("Error parseando detalle de versión: {}", e))?;

    // Download client.jar
    if let Some(downloads) = detail.downloads {
        if let Some(client_artifact) = downloads.client {
            if let Some(url) = client_artifact.url {
                println!("[VersionManager] Downloading client.jar from {}...", url);
                let jar_resp = client.get(&url).send().await.map_err(|e| format!("Error descargando client.jar: {}", e))?;
                let jar_bytes = jar_resp.bytes().await.map_err(|e| e.to_string())?;
                fs::write(&target_jar, &jar_bytes).map_err(|e| format!("Error guardando {}.jar: {}", version_id, e))?;
                println!("[VersionManager] client.jar downloaded successfully ({} bytes).", jar_bytes.len());
            }
        }
    }

    // Also download essential libraries if missing
    if let Some(libraries) = detail.libraries {
        let libraries_dir = game_dir.join("libraries");
        let mc_lib_dir = get_appdata_minecraft_dir().map(|d| d.join("libraries"));

        for lib in libraries {
            if let Some(downloads) = lib.downloads {
                if let Some(artifact) = downloads.artifact {
                    if let (Some(rel_path), Some(url)) = (artifact.path, artifact.url) {
                        let target_lib_path = libraries_dir.join(&rel_path);
                        if target_lib_path.exists() {
                            continue;
                        }

                        // Check if present in .minecraft/libraries
                        if let Some(ref mc_libs) = mc_lib_dir {
                            let mc_lib_path = mc_libs.join(&rel_path);
                            if mc_lib_path.exists() {
                                if let Some(parent) = target_lib_path.parent() {
                                    let _ = fs::create_dir_all(parent);
                                }
                                let _ = fs::copy(&mc_lib_path, &target_lib_path);
                                continue;
                            }
                        }

                        // Download missing library in background/sync
                        if let Some(parent) = target_lib_path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        if let Ok(resp) = client.get(&url).send().await {
                            if let Ok(bytes) = resp.bytes().await {
                                let _ = fs::write(&target_lib_path, bytes);
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Download asset index and missing asset objects (sounds, languages, textures)
    if let Some(asset_ref) = detail.asset_index {
        let assets_dir = game_dir.join("assets");
        let indexes_dir = assets_dir.join("indexes");
        let objects_dir = assets_dir.join("objects");
        let _ = fs::create_dir_all(&indexes_dir);
        let _ = fs::create_dir_all(&objects_dir);
        let target_index_file = indexes_dir.join(format!("{}.json", asset_ref.id));

        let mc_assets_dir = get_appdata_minecraft_dir().map(|d| d.join("assets"));
        let mc_index_file = mc_assets_dir.as_ref().map(|a| a.join("indexes").join(format!("{}.json", asset_ref.id)));

        let mut index_content = None;
        if target_index_file.exists() {
            index_content = fs::read_to_string(&target_index_file).ok();
        } else if let Some(ref mc_idx) = mc_index_file {
            if mc_idx.exists() {
                if let Ok(content) = fs::read_to_string(mc_idx) {
                    let _ = fs::write(&target_index_file, &content);
                    index_content = Some(content);
                }
            }
        }

        if index_content.is_none() {
            println!("[VersionManager] Downloading asset index {} from {}...", asset_ref.id, asset_ref.url);
            if let Ok(resp) = client.get(&asset_ref.url).send().await {
                if let Ok(text) = resp.text().await {
                    let _ = fs::write(&target_index_file, &text);
                    if let Some(ref mc_idx) = mc_index_file {
                        if let Some(parent) = mc_idx.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        let _ = fs::write(mc_idx, &text);
                    }
                    index_content = Some(text);
                }
            }
        }

        if let Some(content) = index_content {
            if let Ok(parsed_idx) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(objects) = parsed_idx.get("objects").and_then(|o| o.as_object()) {
                    let mc_objects_dir = mc_assets_dir.as_ref().map(|a| a.join("objects"));

                    let mut missing_objects = Vec::new();
                    for (_obj_name, obj_val) in objects {
                        if let Some(hash) = obj_val.get("hash").and_then(|h| h.as_str()) {
                            if hash.len() < 2 {
                                continue;
                            }
                            let prefix = &hash[..2];
                            let target_obj = objects_dir.join(prefix).join(hash);
                            if target_obj.exists() {
                                continue;
                            }
                            if let Some(ref mc_objs) = mc_objects_dir {
                                let mc_obj = mc_objs.join(prefix).join(hash);
                                if mc_obj.exists() {
                                    if let Some(parent) = target_obj.parent() {
                                        let _ = fs::create_dir_all(parent);
                                    }
                                    let _ = fs::copy(&mc_obj, &target_obj);
                                    continue;
                                }
                            }
                            missing_objects.push((prefix.to_string(), hash.to_string()));
                        }
                    }

                    if !missing_objects.is_empty() {
                        println!("[VersionManager] Downloading {} missing assets for index {}...", missing_objects.len(), asset_ref.id);
                        for chunk in missing_objects.chunks(25) {
                            let mut handles = Vec::new();
                            for (prefix, hash) in chunk {
                                let url = format!("https://resources.download.minecraft.net/{}/{}", prefix, hash);
                                let target_file = objects_dir.join(prefix).join(hash);
                                let mc_file = mc_objects_dir.as_ref().map(|d| d.join(prefix).join(hash));
                                let c = client.clone();
                                handles.push(tokio::spawn(async move {
                                    if let Ok(resp) = c.get(&url).send().await {
                                        if let Ok(bytes) = resp.bytes().await {
                                            if let Some(p) = target_file.parent() {
                                                let _ = fs::create_dir_all(p);
                                            }
                                            let _ = fs::write(&target_file, &bytes);
                                            if let Some(mc_f) = mc_file {
                                                if let Some(p) = mc_f.parent() {
                                                    let _ = fs::create_dir_all(p);
                                                }
                                                let _ = fs::write(&mc_f, &bytes);
                                            }
                                        }
                                    }
                                }));
                            }
                            for h in handles {
                                let _ = h.await;
                            }
                        }
                        println!("[VersionManager] Asset objects downloaded successfully.");
                    }
                }
            }
        }
    }

    Ok(format!("Versión {} preparada exitosamente.", version_id))
}

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn ensure_launcher_profiles(game_dir: &Path) {
    let profiles_file = game_dir.join("launcher_profiles.json");
    if !profiles_file.exists() {
        let minimal_profiles = serde_json::json!({
            "profiles": {
                "crystaltides": {
                    "name": "CrystalTides",
                    "type": "custom",
                    "created": "2026-01-01T00:00:00.000Z",
                    "lastUsed": "2026-01-01T00:00:00.000Z",
                    "lastVersionId": "1.21.1"
                }
            },
            "settings": {
                "crashAssistance": true,
                "enableAdvanced": true
            },
            "version": 3
        });
        let _ = fs::write(&profiles_file, minimal_profiles.to_string());
    }
}

fn resolve_java_path(provided: &str, game_dir: &str) -> PathBuf {
    if !provided.is_empty() {
        let p = PathBuf::from(provided);
        if p.exists() {
            return p;
        }
    }
    // 1. Search in game_dir / runtimes
    let runtimes_dir = Path::new(game_dir).join("runtimes");
    if let Some(found) = crate::java_manager::find_java_binary(&runtimes_dir) {
        return found;
    }
    // 2. Search in default ~/.crystaltides/runtimes
    if let Some(home) = dirs::home_dir() {
        let ct_runtimes = home.join(".crystaltides").join("runtimes");
        if let Some(found) = crate::java_manager::find_java_binary(&ct_runtimes) {
            return found;
        }
    }
    // 3. Search common system Java directories on Windows
    #[cfg(target_os = "windows")]
    {
        for vendor_parent in &[r"C:\Program Files\Java", r"C:\Program Files\Eclipse Adoptium", r"C:\Program Files\Microsoft"] {
            let p = Path::new(vendor_parent);
            if p.is_dir() {
                if let Some(found) = crate::java_manager::find_java_binary(p) {
                    return found;
                }
            }
        }
    }
    // Fallback to "java" on system PATH
    PathBuf::from("java")
}

/// Limpia automáticamente archivos temporales de instalación y volcados de fallos de la JVM
/// que puedan haber quedado en el directorio raíz del juego.
pub fn cleanup_installer_artifacts(game_dir: &Path) {
    if !game_dir.is_dir() {
        return;
    }

    let entries = match fs::read_dir(game_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy().to_lowercase();

        let is_installer_jar = name_str.ends_with(".jar") && name_str.contains("installer");
        let is_installer_log = (name_str.ends_with(".log") || name_str.ends_with(".txt")) && name_str.contains("installer");
        let is_crash_log = (name_str.starts_with("hs_err_pid") || name_str.starts_with("replay_pid"))
            && name_str.ends_with(".log");

        if is_installer_jar || is_installer_log || is_crash_log {
            if let Err(e) = fs::remove_file(&path) {
                crate::logger::log(
                    "WARN",
                    "VersionManager",
                    &format!("No se pudo eliminar residuo temporal {:?}: {}", path, e),
                );
            } else {
                crate::logger::log(
                    "INFO",
                    "VersionManager",
                    &format!("Residuo de instalación eliminado automáticamente: {:?}", file_name),
                );
            }
        }
    }
}

pub async fn install_mod_loader(
    loader_type: &str,
    loader_version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let game_path = Path::new(game_dir);
    ensure_launcher_profiles(game_path);
    cleanup_installer_artifacts(game_path);

    // Ensure the base vanilla version files exist before installing mod loader
    let _ = prepare_version(mc_version, game_dir).await;

    let res = match loader_type.to_lowercase().as_str() {
        "fabric" => install_fabric(loader_version, mc_version, game_dir, java_path).await,
        "quilt" => install_quilt(loader_version, mc_version, game_dir, java_path).await,
        "neoforge" | "forge" => {
            install_forge_family(loader_type, loader_version, game_dir, java_path).await
        }
        _ => Err(format!("Tipo de cargador desconocido: {}", loader_type)),
    };

    cleanup_installer_artifacts(game_path);
    res
}

async fn download_file_to(url: &str, path: &Path) -> Result<(), String> {
    println!("[VersionManager] Descargando instalador: {}", url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().await.map_err(|e| format!("Error conectando: {}", e))?;
    let resp = resp.error_for_status().map_err(|e| format!("Error HTTP: {}", e))?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(path, bytes).map_err(|e| format!("Error guardando archivo: {}", e))?;
    Ok(())
}

async fn install_fabric(
    loader_version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let installer_url = "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar";
    let installer_path = Path::new(game_dir).join("fabric-installer.jar");

    crate::logger::log("INFO", "VersionManager", &format!("Descargando Fabric installer: {}", installer_url));
    download_file_to(installer_url, &installer_path).await?;

    let resolved_java = resolve_java_path(java_path, game_dir);
    crate::logger::log("INFO", "VersionManager", &format!("Ejecutando Fabric Installer con Java: {:?}", resolved_java));
    let mut cmd = std::process::Command::new(resolved_java);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("client")
        .arg("-mcversion")
        .arg(mc_version)
        .arg("-loader")
        .arg(loader_version)
        .arg("-dir")
        .arg(game_dir)
        .arg("-noprofile");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        let _ = fs::remove_file(&installer_path);
        let err_str = format!("Fallo al ejecutar instalador Fabric: {}", e);
        crate::logger::log("ERROR", "VersionManager", &err_str);
        err_str
    })?;
    let _ = fs::remove_file(&installer_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = format!("Instalador Fabric falló: {}", stderr);
        crate::logger::log("ERROR", "VersionManager", &err_msg);
        return Err(err_msg);
    }

    let ok_msg = format!("Fabric {} para Minecraft {} instalado exitosamente.", loader_version, mc_version);
    crate::logger::log("INFO", "VersionManager", &ok_msg);
    Ok(ok_msg)
}

async fn install_quilt(
    loader_version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let installer_url = "https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/0.9.2/quilt-installer-0.9.2.jar";
    let installer_path = Path::new(game_dir).join("quilt-installer.jar");

    crate::logger::log("INFO", "VersionManager", &format!("Descargando Quilt installer: {}", installer_url));
    download_file_to(installer_url, &installer_path).await?;

    let resolved_java = resolve_java_path(java_path, game_dir);
    crate::logger::log("INFO", "VersionManager", &format!("Ejecutando Quilt Installer con Java: {:?}", resolved_java));
    let mut cmd = std::process::Command::new(resolved_java);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("install")
        .arg("client")
        .arg(mc_version)
        .arg("--loader-version")
        .arg(loader_version)
        .arg("--install-dir")
        .arg(game_dir)
        .arg("--no-profile");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        let _ = fs::remove_file(&installer_path);
        let err_str = format!("Fallo al ejecutar instalador Quilt: {}", e);
        crate::logger::log("ERROR", "VersionManager", &err_str);
        err_str
    })?;
    let _ = fs::remove_file(&installer_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = format!("Instalador Quilt falló: {}", stderr);
        crate::logger::log("ERROR", "VersionManager", &err_msg);
        return Err(err_msg);
    }

    let ok_msg = format!("Quilt {} para Minecraft {} instalado exitosamente.", loader_version, mc_version);
    crate::logger::log("INFO", "VersionManager", &ok_msg);
    Ok(ok_msg)
}

async fn install_forge_family(
    loader_type: &str,
    version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let (url, file_name) = match loader_type.to_lowercase().as_str() {
        "neoforge" => {
            let name = format!("neoforge-{}-installer.jar", version);
            (
                format!(
                    "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/{}",
                    version, name
                ),
                name,
            )
        }
        "forge" => {
            let name = format!("forge-{}-installer.jar", version);
            (
                format!(
                    "https://maven.minecraftforge.net/net/minecraftforge/forge/{}/{}",
                    version, name
                ),
                name,
            )
        }
        _ => return Err("Loader no soportado en familia Forge.".to_string()),
    };

    let installer_path = Path::new(game_dir).join(&file_name);
    crate::logger::log("INFO", "VersionManager", &format!("Descargando {} installer: {}", loader_type, url));
    download_file_to(&url, &installer_path).await?;

    let resolved_java = resolve_java_path(java_path, game_dir);
    crate::logger::log("INFO", "VersionManager", &format!("Ejecutando instalador de {} con Java: {:?}", loader_type, resolved_java));
    let mut cmd = std::process::Command::new(resolved_java);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("--installClient")
        .arg(game_dir)
        .current_dir(game_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        let _ = fs::remove_file(&installer_path);
        let err_str = format!("Fallo al ejecutar instalador {}: {}", loader_type, e);
        crate::logger::log("ERROR", "VersionManager", &err_str);
        err_str
    })?;
    let _ = fs::remove_file(&installer_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = format!("Instalador {} falló: {}", loader_type, stderr);
        crate::logger::log("ERROR", "VersionManager", &err_msg);
        return Err(err_msg);
    }

    let ok_msg = format!("{} {} instalado exitosamente.", loader_type, version);
    crate::logger::log("INFO", "VersionManager", &ok_msg);
    Ok(ok_msg)
}

