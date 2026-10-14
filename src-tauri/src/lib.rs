mod agent;
mod crash_doctor;
mod db;
mod delta_patch;
mod discord_rpc;
mod gpu_preset;
mod hardware;
mod importer;
mod java_manager;
mod logger;
mod mod_sync;
mod nbt_manager;
mod process_manager;
mod sys;
mod version_manager;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(serde::Serialize)]
pub struct BootContext {
    pub mode: String,
    #[serde(rename = "defaultInstallDir")]
    pub default_install_dir: String,
    #[serde(rename = "currentExe")]
    pub current_exe: String,
    #[serde(rename = "isInstalled")]
    pub is_installed: bool,
    pub os: String,
}

#[tauri::command]
fn get_boot_context() -> BootContext {
    let args: Vec<String> = std::env::args().collect();
    let current_exe = std::env::current_exe().unwrap_or_default();
    let default_dir = sys::get_default_install_dir().unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let is_installed = sys::is_app_installed(&default_dir);

    // 1. Argumentos CLI explícitos
    if args.iter().any(|arg| arg == "--uninstall" || arg == "-u") {
        return BootContext {
            mode: "uninstall".to_string(),
            default_install_dir: default_dir.to_string_lossy().to_string(),
            current_exe: current_exe.to_string_lossy().to_string(),
            is_installed,
            os: std::env::consts::OS.to_string(),
        };
    }

    if args.iter().any(|arg| arg == "--install" || arg == "-i") {
        return BootContext {
            mode: "install".to_string(),
            default_install_dir: default_dir.to_string_lossy().to_string(),
            current_exe: current_exe.to_string_lossy().to_string(),
            is_installed,
            os: std::env::consts::OS.to_string(),
        };
    }

    // Auto-asegurar directorios esenciales de usuario
    let _ = fs::create_dir_all(default_dir.join("mods"));
    let _ = fs::create_dir_all(default_dir.join("profiles"));
    let _ = fs::create_dir_all(default_dir.join("bin"));
    let _ = fs::create_dir_all(default_dir.join("assets"));
    let _ = fs::create_dir_all(default_dir.join("runtimes"));
    version_manager::cleanup_installer_artifacts(&default_dir);

    // 2. Detección inteligente por ruta, nombre o CLI
    let exe_name = current_exe.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
    let is_portable = args.iter().any(|arg| arg == "--portable" || arg == "-p") || exe_name.contains("portable");
    let is_in_install_dir = current_exe.starts_with(&default_dir);
    let is_setup_binary = exe_name.contains("install") || exe_name.contains("setup");

    let mode = if !is_portable && (args.iter().any(|arg| arg == "--install" || arg == "-i") || is_setup_binary || (!is_installed && !is_in_install_dir)) {
        "install"
    } else {
        "launcher"
    };

    BootContext {
        mode: mode.to_string(),
        default_install_dir: default_dir.to_string_lossy().to_string(),
        current_exe: current_exe.to_string_lossy().to_string(),
        is_installed,
        os: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
fn perform_self_install(target_dir: String, create_desktop_shortcut: Option<bool>) -> Result<(), String> {
    agent::validate_game_dir(&target_dir)?;
    let path = Path::new(&target_dir);
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| format!("Error al crear directorio: {}", e))?;
    }

    // Estructura de carpetas aisladas
    let _ = fs::create_dir_all(path.join("mods"));
    let _ = fs::create_dir_all(path.join("profiles"));
    let _ = fs::create_dir_all(path.join("bin"));
    let _ = fs::create_dir_all(path.join("assets"));
    let _ = fs::create_dir_all(path.join("runtimes"));

    let is_windows = cfg!(target_os = "windows");
    let exe_name = if is_windows { "CrystalTidesLauncher.exe" } else { "CrystalTidesLauncher" };

    let current_exe = std::env::current_exe().map_err(|e| format!("Error obteniendo ejecutable actual: {}", e))?;
    let target_launcher = path.join("bin").join(exe_name);

    // Copiar ejecutable actual a ~/.crystaltides/bin/
    if current_exe != target_launcher {
        fs::copy(&current_exe, &target_launcher)
            .map_err(|e| format!("Error al copiar ejecutable a la carpeta de instalación: {}", e))?;
    }

    // Metadatos de instalación
    let installed_file = path.join(".installed.json");
    let metadata = serde_json::json!({
        "installed": true,
        "productName": "CrystalTides Launcher - Papyrus Edition",
        "installedAt": chrono_now(),
        "version": "1.0.0",
        "os": std::env::consts::OS,
        "executable": target_launcher.to_string_lossy().to_string()
    });
    let _ = fs::write(installed_file, metadata.to_string());

    // Registro en el SO y accesos directos
    sys::register_system_app(&target_launcher, path, create_desktop_shortcut.unwrap_or(true))?;

    Ok(())
}

#[tauri::command]
fn launch_installed_app(target_dir: String) -> Result<(), String> {
    agent::validate_game_dir(&target_dir)?;
    let is_windows = cfg!(target_os = "windows");
    let exe_name = if is_windows { "CrystalTidesLauncher.exe" } else { "CrystalTidesLauncher" };

    let bin_path = Path::new(&target_dir).join("bin").join(exe_name);
    let root_path = Path::new(&target_dir).join(exe_name);

    let target = if bin_path.exists() {
        bin_path
    } else if root_path.exists() {
        root_path
    } else {
        return Err("No se encontró el ejecutable instalado.".to_string());
    };

    let _ = Command::new(&target)
        .current_dir(&target_dir)
        .spawn()
        .map_err(|e| format!("Error al iniciar el Launcher: {}", e))?;

    Ok(())
}

#[tauri::command]
fn perform_self_uninstall(target_dir: String, remove_user_data: Option<bool>) -> Result<(), String> {
    if target_dir.trim().is_empty() {
        return Err("Ruta de desinstalación vacía.".to_string());
    }
    let path = Path::new(&target_dir);
    if path.components().any(|c| c == std::path::Component::ParentDir) {
        return Err("Ruta no autorizada: secuencias relativas '..' prohibidas.".to_string());
    }
    let default_dir = sys::get_default_install_dir().unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let default_canonical = default_dir.canonicalize().unwrap_or_else(|_| default_dir.clone());

    if !canonical.starts_with(&default_canonical) {
        return Err("Ruta no autorizada para desinstalación: debe residir dentro del directorio de CrystalTides.".to_string());
    }

    let remove_all = remove_user_data.unwrap_or(false);
    sys::unregister_system_app(path, remove_all)?;

    Ok(())
}

#[tauri::command]
fn schedule_self_deletion(target_dir: String) -> Result<(), String> {
    if target_dir.trim().is_empty() {
        return Err("Ruta de desinstalación vacía.".to_string());
    }
    let path = Path::new(&target_dir);
    if path.components().any(|c| c == std::path::Component::ParentDir) {
        return Err("Ruta no autorizada: secuencias relativas '..' prohibidas.".to_string());
    }
    let default_dir = sys::get_default_install_dir().unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let default_canonical = default_dir.canonicalize().unwrap_or_else(|_| default_dir.clone());

    if !canonical.starts_with(&default_canonical) {
        return Err("Ruta no autorizada para eliminación: debe residir dentro del directorio de CrystalTides.".to_string());
    }

    sys::schedule_self_deletion(path)?;
    Ok(())
}

#[tauri::command]
fn close_app(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn add_windows_defender_exclusion(folder_path: String) -> Result<(), String> {
    if folder_path.trim().is_empty() {
        return Err("Ruta de exclusión vacía.".to_string());
    }
    let path = Path::new(&folder_path);
    if path.components().any(|c| c == std::path::Component::ParentDir) {
        return Err("Ruta no autorizada: secuencias relativas '..' prohibidas.".to_string());
    }
    let default_dir = sys::get_default_install_dir().unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let default_canonical = default_dir.canonicalize().unwrap_or_else(|_| default_dir.clone());

    if !canonical.starts_with(&default_canonical) {
        return Err("Ruta no autorizada para exclusión de Defender: debe residir dentro del directorio de CrystalTides.".to_string());
    }

    sys::add_defender_exclusion(path)
}

fn chrono_now() -> String {
    logger::format_timestamp()
}

#[tauri::command]
fn log_frontend(msg: String, level: Option<String>) {
    let lvl = level.unwrap_or_else(|| "INFO".to_string());
    logger::log(&lvl, "Frontend", &msg);
}

#[tauri::command]
fn get_launcher_logs(max_lines: Option<usize>) -> Result<String, String> {
    logger::get_launcher_logs(max_lines)
}

#[tauri::command]
fn get_minecraft_logs(max_lines: Option<usize>) -> Result<String, String> {
    logger::get_minecraft_logs(max_lines)
}

#[tauri::command]
fn open_logs_folder() -> Result<(), String> {
    let dir = logger::get_logs_directory();
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Error abriendo carpeta de logs: {}", e))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Error abriendo carpeta de logs: {}", e))?;
        Ok(())
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Error abriendo carpeta de logs: {}", e))?;
        Ok(())
    }
}

#[tauri::command]
fn get_home_dir() -> Option<String> {
    dirs::home_dir().map(|path| path.to_string_lossy().to_string())
}

fn get_authorized_file_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // 1. Directorio de instalación predeterminado (.crystaltides)
    if let Some(install_dir) = sys::get_default_install_dir() {
        if let Ok(c) = install_dir.canonicalize() {
            roots.push(c);
        } else {
            roots.push(install_dir);
        }
    }

    // 2. ~/.crystaltides explícito
    if let Some(home) = dirs::home_dir() {
        let ct_dir = home.join(".crystaltides");
        if let Ok(c) = ct_dir.canonicalize() {
            roots.push(c);
        } else {
            roots.push(ct_dir);
        }

        // 3. Directorio de Minecraft estándar
        #[cfg(target_os = "windows")]
        if let Some(appdata) = dirs::data_dir() {
            let mc_dir = appdata.join(".minecraft");
            if let Ok(c) = mc_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(mc_dir);
            }
        }
        #[cfg(target_os = "linux")]
        {
            let mc_dir = home.join(".minecraft");
            if let Ok(c) = mc_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(mc_dir);
            }
        }
        #[cfg(target_os = "macos")]
        {
            let mc_dir = home.join("Library/Application Support/minecraft");
            if let Ok(c) = mc_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(mc_dir);
            }
        }

        // 3.1 Carpetas de instancias de launchers externos conocidos
        let mut external_dirs = vec![
            home.join("curseforge").join("minecraft").join("Instances"),
        ];

        #[cfg(target_os = "windows")]
        {
            let roaming = home.join("AppData").join("Roaming");
            external_dirs.push(roaming.join("curseforge").join("minecraft").join("Instances"));
            external_dirs.push(roaming.join("ModrinthApp").join("profiles"));
            external_dirs.push(roaming.join("com.modrinth.theseus").join("profiles"));
            external_dirs.push(roaming.join("PrismLauncher").join("instances"));
            external_dirs.push(roaming.join("MultiMC").join("instances"));
        }

        #[cfg(target_os = "macos")]
        {
            let app_sup = home.join("Library").join("Application Support");
            external_dirs.push(app_sup.join("curseforge").join("minecraft").join("Instances"));
            external_dirs.push(app_sup.join("ModrinthApp").join("profiles"));
            external_dirs.push(app_sup.join("com.modrinth.theseus").join("profiles"));
            external_dirs.push(app_sup.join("PrismLauncher").join("instances"));
            external_dirs.push(app_sup.join("MultiMC").join("instances"));
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let local_share = home.join(".local").join("share");
            external_dirs.push(local_share.join("curseforge").join("minecraft").join("Instances"));
            external_dirs.push(local_share.join("ModrinthApp").join("profiles"));
            external_dirs.push(local_share.join("com.modrinth.theseus").join("profiles"));
            external_dirs.push(home.join(".var").join("app").join("com.modrinth.ModrinthApp").join("data").join("ModrinthApp").join("profiles"));
            external_dirs.push(local_share.join("PrismLauncher").join("instances"));
            external_dirs.push(local_share.join("multimc").join("instances"));
            external_dirs.push(home.join(".var").join("app").join("org.prismlauncher.PrismLauncher").join("data").join("PrismLauncher").join("instances"));
        }

        for ext_dir in external_dirs {
            if let Ok(c) = ext_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(ext_dir);
            }
        }
    }

    // 4. Directorios de juego registrados en la base de datos de perfiles
    if let Ok(profiles) = db::db_get_profiles() {
        for p in profiles {
            if let Some(gd) = p.game_dir {
                let pb = PathBuf::from(gd);
                if let Ok(c) = pb.canonicalize() {
                    roots.push(c);
                } else if pb.is_absolute() {
                    roots.push(pb);
                }
            }
        }
    }

    // 5. Directorio temporal del sistema
    let temp = std::env::temp_dir();
    if let Ok(c) = temp.canonicalize() {
        roots.push(c);
    } else {
        roots.push(temp);
    }

    roots
}

fn validate_safe_file_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("Ruta vacía no permitida.".to_string());
    }

    let raw_path = PathBuf::from(trimmed);
    for comp in raw_path.components() {
        if let std::path::Component::ParentDir = comp {
            return Err("Ruta no permitida: secuencias relativas '..' prohibidas.".to_string());
        }
    }

    if !raw_path.is_absolute() {
        return Err("Ruta no permitida: debe ser una ruta absoluta.".to_string());
    }

    // Resolver ruta canónica para evitar evasiones con symlinks o aliasing
    let target_canonical = if raw_path.exists() {
        raw_path.canonicalize().map_err(|e| format!("Error canonicalizando ruta: {}", e))?
    } else {
        let mut ancestor = raw_path.as_path();
        while !ancestor.exists() {
            match ancestor.parent() {
                Some(p) => ancestor = p,
                None => return Err("Ruta no válida: ancestro inexistente.".to_string()),
            }
        }
        let canonical_ancestor = ancestor.canonicalize().map_err(|e| format!("Error canonicalizando ancestro: {}", e))?;
        let relative = raw_path.strip_prefix(ancestor).unwrap_or(Path::new(""));
        canonical_ancestor.join(relative)
    };

    let authorized_roots = get_authorized_file_roots();
    let is_authorized = authorized_roots.iter().any(|root| target_canonical.starts_with(root));

    if !is_authorized {
        return Err("Acceso denegado: La ruta se encuentra fuera de los directorios autorizados de CrystalTides (.crystaltides, .minecraft o perfiles registrados).".to_string());
    }

    Ok(target_canonical)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let safe_path = validate_safe_file_path(&path)?;
    std::fs::read_to_string(safe_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let safe_path = validate_safe_file_path(&path)?;
    if let Some(parent) = safe_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(safe_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    if let Ok(safe_path) = validate_safe_file_path(&path) {
        safe_path.exists()
    } else {
        false
    }
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let safe_path = validate_safe_file_path(&path)?;
    if safe_path.exists() {
        std::fs::remove_file(safe_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn download_single_file(url: String, output_path: String) -> Result<(), String> {
    let safe_path = validate_safe_file_path(&output_path)?;
    if let Some(parent) = safe_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Fallo descarga HTTP {}: {}", resp.status(), url));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(safe_path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn resolve_classpath(
    game_dir: String,
    home_dir: String,
    version_id: String,
    mc_version: String,
    lib_rel_paths: Vec<String>,
) -> String {
    use std::collections::HashSet;
    let mut cp_entries: Vec<String> = Vec::new();
    let mut seen_canonical: HashSet<String> = HashSet::new();

    let game_path = Path::new(&game_dir);
    let home_path = Path::new(&home_dir);

    #[cfg(target_os = "windows")]
    let mc_home = home_path.join("AppData/Roaming/.minecraft");
    #[cfg(target_os = "macos")]
    let mc_home = home_path.join("Library/Application Support/minecraft");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mc_home = home_path.join(".minecraft");

    let mc_home_libs = mc_home.join("libraries");
    let mc_home_versions = mc_home.join("versions");

    let mut add_if_exists = |candidate: PathBuf| {
        if candidate.is_file() {
            let canonical_key = candidate
                .canonicalize()
                .map(|p| p.to_string_lossy().to_lowercase())
                .unwrap_or_else(|_| candidate.to_string_lossy().to_lowercase());

            if !seen_canonical.contains(&canonical_key) {
                seen_canonical.insert(canonical_key);
                #[cfg(target_os = "windows")]
                let entry_str = candidate.to_string_lossy().replace('/', "\\");
                #[cfg(not(target_os = "windows"))]
                let entry_str = candidate.to_string_lossy().to_string();

                cp_entries.push(entry_str);
            }
        }
    };

    // 1. Mod Loader jar if exists
    if version_id != mc_version {
        add_if_exists(game_path.join("versions").join(&version_id).join(format!("{}.jar", version_id)));
        add_if_exists(home_path.join(".crystaltides/versions").join(&version_id).join(format!("{}.jar", version_id)));
        add_if_exists(mc_home_versions.join(&version_id).join(format!("{}.jar", version_id)));
    }

    // 2. Base Vanilla jar
    add_if_exists(game_path.join("versions").join(&mc_version).join(format!("{}.jar", mc_version)));
    add_if_exists(home_path.join(".crystaltides/versions").join(&mc_version).join(format!("{}.jar", mc_version)));
    add_if_exists(mc_home_versions.join(&mc_version).join(format!("{}.jar", mc_version)));

    // 3. Libraries
    let crystal_libs = home_path.join(".crystaltides/libraries");
    for rel in lib_rel_paths {
        let clean_rel = rel.replace('\\', "/");
        let p1 = game_path.join("libraries").join(Path::new(&clean_rel));
        if p1.is_file() {
            add_if_exists(p1);
        } else {
            let p_crystal = crystal_libs.join(Path::new(&clean_rel));
            if p_crystal.is_file() {
                add_if_exists(p_crystal);
            } else {
                let p2 = mc_home_libs.join(Path::new(&clean_rel));
                if p2.is_file() {
                    add_if_exists(p2);
                }
            }
        }
    }

    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    cp_entries.join(separator)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn launch_minecraft(
    app_handle: tauri::AppHandle,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
    pre_launch_command: Option<String>,
    wrapper_command: Option<String>,
    post_exit_command: Option<String>,
    environment_variables: Option<String>,
) -> Result<u32, String> {
    agent::validate_game_dir(&game_dir)?;
    version_manager::cleanup_installer_artifacts(Path::new(&game_dir));
    process_manager::launch_minecraft_process(
        app_handle,
        java_path,
        args,
        game_dir,
        pre_launch_command,
        wrapper_command,
        post_exit_command,
        environment_variables,
    )
}

#[tauri::command]
fn kill_minecraft() -> Result<bool, String> {
    process_manager::kill_minecraft_process()
}

#[tauri::command]
fn is_game_running() -> bool {
    process_manager::is_game_running()
}

#[tauri::command]
async fn install_java_runtime(
    app_handle: tauri::AppHandle,
    version: i32,
    install_dir: String,
    distribution: Option<String>,
) -> Result<String, String> {
    use tauri::Emitter;
    let install_path = std::path::PathBuf::from(install_dir);
    tokio::task::spawn_blocking(move || {
        let path = java_manager::download_and_install_java(
            version as u8,
            &install_path,
            distribution.as_deref(),
            move |progress| {
                let _ = app_handle.emit("java-install-progress", progress);
            },
        )?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Error en tarea de instalación de Java: {}", e))?
}

#[tauri::command]
fn check_java_status(install_dir: String) -> Option<String> {
    java_manager::find_java_binary(std::path::Path::new(&install_dir))
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
async fn http_post(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
    body: String,
) -> Result<String, String> {
    let mut req = client.post(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.body(body).send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    Ok(text)
}

#[tauri::command]
async fn http_get(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
) -> Result<String, String> {
    let mut req = client.get(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    Ok(text)
}

#[tauri::command]
async fn http_put(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
    body: String,
) -> Result<String, String> {
    let mut req = client.put(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.body(body).send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    Ok(text)
}

#[tauri::command]
async fn http_delete(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
) -> Result<String, String> {
    let mut req = client.delete(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    Ok(text)
}

#[tauri::command]
fn get_installed_minecraft_versions() -> Vec<String> {
    version_manager::get_installed_versions()
}

#[tauri::command]
async fn prepare_minecraft_version(version_id: String, game_dir: String) -> Result<String, String> {
    agent::validate_game_dir(&game_dir)?;
    version_manager::cleanup_installer_artifacts(Path::new(&game_dir));
    version_manager::prepare_version(&version_id, &game_dir).await
}

#[tauri::command]
fn cleanup_installer_cache(game_dir: String) {
    version_manager::cleanup_installer_artifacts(Path::new(&game_dir));
}

#[tauri::command]
async fn install_mod_loader(
    loader_type: String,
    loader_version: String,
    mc_version: String,
    game_dir: String,
    java_path: String,
) -> Result<String, String> {
    agent::validate_game_dir(&game_dir)?;
    version_manager::install_mod_loader(&loader_type, &loader_version, &mc_version, &game_dir, &java_path).await
}

#[tauri::command]
fn scan_external_instances() -> Vec<importer::ImportableInstance> {
    importer::scan_all_external_instances()
}

#[tauri::command]
fn inspect_custom_instance_dir(path: String) -> Result<importer::ImportableInstance, String> {
    importer::inspect_custom_instance_dir(&path)
}

#[tauri::command]
fn pick_instance_folder() -> Option<String> {
    importer::pick_folder()
}

#[tauri::command]
fn delete_instance_dir(instance_id: String) -> Result<(), String> {
    let trimmed = instance_id.trim();
    if trimmed.is_empty() || trimmed.contains("..") || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Identificador de instancia inválido o inseguro.".to_string());
    }

    let home = dirs::home_dir().ok_or_else(|| "No se pudo determinar el directorio de usuario".to_string())?;
    let instances_root = home.join(".crystaltides").join("instances");
    let target_dir = instances_root.join(trimmed);

    if !target_dir.starts_with(&instances_root) {
        return Err("La ruta calculada no reside dentro de .crystaltides/instances.".to_string());
    }

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|e| format!("Error eliminando directorio de instancia {:?}: {}", target_dir, e))?;
        logger::log(
            "INFO",
            "InstanceManager",
            &format!("Directorio de instancia eliminado exitosamente: {:?}", target_dir),
        );
    }

    Ok(())
}

fn parse_oauth_query(url: &tauri::Url) -> Option<Result<String, String>> {
    let url_str = url.as_str();
    let is_callback = url_str.starts_with("https://login.live.com/oauth20_desktop.srf")
        || url_str.starts_with("https://crystaltidessmp.net/ms-callback.html")
        || url_str.starts_with("http://localhost:5173/ms-callback.html");

    if !is_callback || url.query().is_none() {
        return None;
    }

    for (k, v) in url.query_pairs() {
        if k == "code" {
            return Some(Ok(v.into_owned()));
        } else if k == "error" {
            return Some(Err(format!("Error de Microsoft: {}", v)));
        }
    }
    None
}

#[tauri::command]
async fn open_microsoft_auth_window(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;

    if let Some(existing) = app_handle.get_webview_window("microsoft-login-window") {
        let _ = existing.destroy();
    }

    let auth_url = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=3974b918-cd84-4d60-8955-2ad65234d16b&response_type=code&redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf&scope=XboxLive.SignIn%20XboxLive.offline_access&prompt=select_account";

    let (tx, rx) = oneshot::channel::<Result<String, String>>();
    let tx_mutex = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = tx_mutex.clone();

    let window = WebviewWindowBuilder::new(
        &app_handle,
        "microsoft-login-window",
        WebviewUrl::External(auth_url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    )
    .title("CrystalTides Lite - Iniciar sesión con Microsoft")
    .inner_size(520.0, 680.0)
    .resizable(false)
    .always_on_top(true)
    .on_navigation(move |url| {
        if let Some(auth_result) = parse_oauth_query(url) {
            let mut lock = tx_nav.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(sender) = lock.take() {
                let _ = sender.send(auth_result);
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;

    let window_clone = window.clone();
    let tx_close = tx_mutex.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let mut lock = tx_close.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(sender) = lock.take() {
                let _ = sender.send(Err("El usuario cerró la ventana de inicio de sesión.".to_string()));
            }
        }
    });

    let code_res = rx.await.map_err(|_| "La ventana de inicio de sesión se cerró inesperadamente.".to_string())?;
    let _ = window_clone.destroy();

    code_res
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct AppUpdateInfo {
    pub available: bool,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    pub version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<AppUpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;
    let current_version = app.package_info().version.to_string();
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[AutoUpdater] Updater plugin unavailable: {}", e);
            return Ok(AppUpdateInfo {
                available: false,
                current_version,
                version: None,
                body: None,
                date: None,
            });
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            logger::log("INFO", "AutoUpdater", &format!("Actualización disponible: v{}", update.version));
            Ok(AppUpdateInfo {
                available: true,
                current_version,
                version: Some(update.version.clone()),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            })
        }
        Ok(None) => {
            logger::log("INFO", "AutoUpdater", "El launcher se encuentra en la versión más reciente.");
            Ok(AppUpdateInfo {
                available: false,
                current_version,
                version: None,
                body: None,
                date: None,
            })
        }
        Err(e) => {
            logger::log("WARN", "AutoUpdater", &format!("Check de actualización omitido o no disponible: {}", e));
            Ok(AppUpdateInfo {
                available: false,
                current_version,
                version: None,
                body: None,
                date: None,
            })
        }
    }
}

#[tauri::command]
async fn apply_app_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;

    if let Some(update) = update {
        update.download_and_install(
            |downloaded, total| {
                println!("[AutoUpdater] Progress: downloaded {} of {:?}", downloaded, total);
            },
            || {
                println!("[AutoUpdater] Download finished, applying binary...");
            },
        ).await.map_err(|e| format!("Error instalando actualización: {}", e))?;

        app.restart();
    }
    Ok(())
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_client = reqwest::Client::builder()
        .tcp_keepalive(std::time::Duration::from_secs(60))
        .build()
        .unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(http_client)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" && process_manager::is_game_running() {
                    logger::log("WARN", "App", "Cierre del Launcher detectado con Minecraft activo.");
                }
            }
        })
        .setup(|app| {
            use tauri::Manager;
            logger::init();
            logger::log("INFO", "App", "CrystalTides Launcher backend inicializado.");
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = agent::start_game_ipc_server(handle).await;
            });
            let boot_ctx = get_boot_context();
            if let Some(window) = app.get_webview_window("main") {
                if boot_ctx.mode == "install" || boot_ctx.mode == "uninstall" {
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: 600.0,
                        height: 400.0,
                    }));
                    let _ = window.set_resizable(false);
                } else {
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: 1280.0,
                        height: 720.0,
                    }));
                    let _ = window.set_resizable(true);
                }
                let _ = window.center();
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_boot_context,
            perform_self_install,
            launch_installed_app,
            perform_self_uninstall,
            schedule_self_deletion,
            close_app,
            restart_app,
            check_app_update,
            apply_app_update,
            log_frontend,
            get_launcher_logs,
            get_minecraft_logs,
            open_logs_folder,
            get_home_dir,
            read_text_file,
            write_text_file,
            file_exists,
            delete_file,
            download_single_file,
            launch_minecraft,
            kill_minecraft,
            is_game_running,
            check_java_status,
            install_java_runtime,
            add_windows_defender_exclusion,
            http_post,
            http_get,
            http_put,
            http_delete,
            open_microsoft_auth_window,
            get_installed_minecraft_versions,
            prepare_minecraft_version,
            install_mod_loader,
            cleanup_installer_cache,
            resolve_classpath,
            hardware::detect_hardware_profile,
            gpu_preset::detect_gpu_profile,
            agent::prepare_crystal_agent,
            agent::deploy_crystaltides_boost,
            agent::get_agent_jvm_args,
            agent::get_agent_benchmark_status,
            agent::start_game_ipc_server,
            agent::get_game_ipc_port,
            mod_sync::download_mods_parallel,
            mod_sync::sync_mods,
            mod_sync::list_instance_mods,
            mod_sync::toggle_instance_mod,
            mod_sync::delete_instance_mod,
            mod_sync::open_folder,
            mod_sync::ensure_servers_dat,
            discord_rpc::set_discord_presence,
            discord_rpc::clear_discord_presence,
            nbt_manager::read_servers_dat,
            nbt_manager::save_servers_dat,
            nbt_manager::list_singleplayer_saves,
            db::db_get_profiles,
            db::db_save_profile,
            db::db_delete_profile,
            db::db_get_accounts,
            db::db_save_account,
            db::db_delete_account,
            db::db_set_active_account,
            crash_doctor::analyze_latest_crash,
            crash_doctor::fix_offending_mod,
            crash_doctor::enable_offending_mod,
            crash_doctor::reset_options_txt,
            delta_patch::apply_binary_patch,
            scan_external_instances,
            inspect_custom_instance_dir,
            pick_instance_folder,
            delete_instance_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chrono_now_dynamic_timestamp() {
        let ts = chrono_now();
        assert_ne!(ts, "2026-08-29T05:00:00Z");
        assert!(ts.contains('-'));
        assert!(ts.contains(':'));
    }

    #[test]
    fn test_validate_safe_file_path_rejects_relative_and_traversal() {
        assert!(validate_safe_file_path("relative/file.txt").is_err());
        assert!(validate_safe_file_path("../traversal.txt").is_err());
        assert!(validate_safe_file_path("").is_err());
    }

    #[test]
    fn test_validate_safe_file_path_rejects_unauthorized_system_paths() {
        #[cfg(target_os = "windows")]
        let forbidden = "C:/Windows/System32/drivers/etc/hosts";
        #[cfg(not(target_os = "windows"))]
        let forbidden = "/etc/shadow";

        let res = validate_safe_file_path(forbidden);
        assert!(res.is_err(), "Debe rechazar rutas arbitrarias del sistema fuera del ámbito de CrystalTides");
    }

    #[test]
    fn test_validate_safe_file_path_allows_authorized_temp_dir() {
        let temp_file = std::env::temp_dir().join("crystaltides_test_file.txt");
        let path_str = temp_file.to_string_lossy().to_string();
        let validated = validate_safe_file_path(&path_str);
        assert!(validated.is_ok(), "Debe permitir archivos dentro del directorio temporal autorizado");
    }

    #[test]
    fn test_default_install_dir_unification() {
        let default_dir = sys::get_default_install_dir().expect("Debe existir home_dir");
        assert!(
            default_dir.ends_with(".crystaltides"),
            "El directorio de instalación predeterminado debe ser ~/.crystaltides en todas las plataformas: {:?}",
            default_dir
        );
    }

    #[test]
    fn test_perform_self_uninstall_and_deletion_rejects_invalid_paths() {
        assert!(perform_self_uninstall("".to_string(), None).is_err());
        assert!(schedule_self_deletion("".to_string()).is_err());

        #[cfg(target_os = "windows")]
        let bad_path = "C:/Windows/System32".to_string();
        #[cfg(not(target_os = "windows"))]
        let bad_path = "/etc".to_string();

        assert!(perform_self_uninstall(bad_path.clone(), None).is_err());
        assert!(schedule_self_deletion(bad_path).is_err());

        // Debe rechazar el home raíz directo o subcarpetas del usuario fuera de .crystaltides (ej: Desktop)
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_string();
            assert!(perform_self_uninstall(home_str.clone(), None).is_err());
            assert!(schedule_self_deletion(home_str).is_err());

            let desktop = home.join("Desktop").to_string_lossy().to_string();
            assert!(perform_self_uninstall(desktop.clone(), None).is_err());
            assert!(schedule_self_deletion(desktop).is_err());

            // Debe rechazar secuencias con '..' incluso si aparentan comenzar por .crystaltides
            let traversal_path = home.join(".crystaltides").join("..").join("Desktop").to_string_lossy().to_string();
            assert!(perform_self_uninstall(traversal_path.clone(), None).is_err());
            assert!(schedule_self_deletion(traversal_path.clone()).is_err());
            assert!(add_windows_defender_exclusion(traversal_path).is_err());
        }
    }

    #[test]
    fn test_delete_instance_dir_rejects_unsafe_ids() {
        assert!(delete_instance_dir("".to_string()).is_err());
        assert!(delete_instance_dir("   ".to_string()).is_err());
        assert!(delete_instance_dir("../escaped".to_string()).is_err());
        assert!(delete_instance_dir("inst/sub".to_string()).is_err());
        assert!(delete_instance_dir("inst\\sub".to_string()).is_err());
    }
}
