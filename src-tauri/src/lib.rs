mod agent;
mod crash_doctor;
mod db;
mod delta_patch;
mod discord_rpc;
pub mod downloader;
pub mod error;
mod gpu_preset;
mod hardware;
mod importer;
mod java_manager;
pub mod keyring_store;
mod logger;
mod mod_sync;
mod nbt_manager;
pub mod network;
pub mod paths;
mod process_manager;
mod self_update;
mod sys;
mod version_manager;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BootMode {
    Uninstall,
    Install,
    Launcher,
}

impl std::fmt::Display for BootMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BootMode::Uninstall => write!(f, "uninstall"),
            BootMode::Install => write!(f, "install"),
            BootMode::Launcher => write!(f, "launcher"),
        }
    }
}

#[derive(serde::Serialize)]
pub struct BootContext {
    pub mode: BootMode,
    #[serde(rename = "defaultInstallDir")]
    pub default_install_dir: String,
    #[serde(rename = "currentExe")]
    pub current_exe: String,
    #[serde(rename = "isInstalled")]
    pub is_installed: bool,
    pub os: String,
}

pub fn validate_install_dir(target_dir: &str) -> Result<PathBuf, String> {
    let trimmed = target_dir.trim();
    if trimmed.is_empty() {
        return Err("El directorio de instalación no puede estar vacío.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(
            "Ruta no autorizada: El directorio de instalación debe ser una ruta absoluta."
                .to_string(),
        );
    }
    for component in path.components() {
        if let std::path::Component::ParentDir = component {
            return Err(
                "Ruta no autorizada: Detectada navegación relativa hacia directorios padres."
                    .to_string(),
            );
        }
    }
    if path.parent().is_none() {
        return Err("Ruta no autorizada: No se puede instalar en la raíz del disco.".to_string());
    }
    if let Some(home) = dirs::home_dir() {
        if path == home {
            return Err(
                "Ruta no autorizada: No se puede instalar directamente en la raíz del usuario."
                    .to_string(),
            );
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(sys_drive) = std::env::var("SystemDrive") {
            let win_dir = PathBuf::from(format!("{}\\Windows", sys_drive));
            if path.starts_with(&win_dir) {
                return Err(
                    "Ruta no autorizada: No se puede instalar dentro del directorio de Windows."
                        .to_string(),
                );
            }
        }
    }
    Ok(path)
}

/// Resuelve el directorio de instalación activo: predeterminado, registrado en el sistema
/// o el contenedor del ejecutable (`<dir>/bin/<exe>`).
pub(crate) fn resolve_install_dir(current_exe: &Path) -> PathBuf {
    let default_dir =
        sys::get_default_install_dir().unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let explicit_home = std::env::var_os("CRYSTALTIDES_HOME")
        .is_some_and(|home| !home.to_string_lossy().trim().is_empty());

    pick_install_dir(
        default_dir,
        explicit_home,
        sys::get_registered_install_location,
        current_exe,
    )
}

/// Con `CRYSTALTIDES_HOME` definido ese directorio es la única instalación válida, aunque
/// aún no esté instalado: nunca se recurre al registro ni a la ruta del ejecutable, para que
/// una sesión aislada (desarrollo, tests) no pueda actualizar ni leer la instalación del usuario.
fn pick_install_dir(
    default_dir: PathBuf,
    explicit_home: bool,
    registered_install_location: impl FnOnce() -> Option<PathBuf>,
    current_exe: &Path,
) -> PathBuf {
    if explicit_home || sys::is_app_installed(&default_dir) {
        default_dir
    } else if let Some(reg_dir) = registered_install_location() {
        if sys::is_app_installed(&reg_dir) {
            reg_dir
        } else {
            default_dir
        }
    } else if let Some(parent_root) = current_exe.parent().and_then(|p| p.parent()) {
        if sys::is_app_installed(parent_root) {
            parent_root.to_path_buf()
        } else {
            default_dir
        }
    } else {
        default_dir
    }
}

#[tauri::command]
fn get_boot_context() -> BootContext {
    let args: Vec<String> = std::env::args().collect();
    let current_exe = std::env::current_exe().unwrap_or_default();
    let resolved_install_dir = resolve_install_dir(&current_exe);
    let is_installed = sys::is_app_installed(&resolved_install_dir);

    // Las actualizaciones (`/UPDATE` del updater) se resuelven antes de crear la ventana,
    // en `self_update::perform_update_handoff` desde `run()`.

    // 1. Argumentos CLI explícitos
    if args.iter().any(|arg| arg == "--uninstall" || arg == "-u") {
        return BootContext {
            mode: BootMode::Uninstall,
            default_install_dir: resolved_install_dir.to_string_lossy().to_string(),
            current_exe: current_exe.to_string_lossy().to_string(),
            is_installed,
            os: std::env::consts::OS.to_string(),
        };
    }

    if args.iter().any(|arg| arg == "--install" || arg == "-i") {
        return BootContext {
            mode: BootMode::Install,
            default_install_dir: resolved_install_dir.to_string_lossy().to_string(),
            current_exe: current_exe.to_string_lossy().to_string(),
            is_installed,
            os: std::env::consts::OS.to_string(),
        };
    }

    // Auto-asegurar directorios esenciales de usuario
    let _ = fs::create_dir_all(resolved_install_dir.join("mods"));
    let _ = fs::create_dir_all(resolved_install_dir.join("profiles"));
    let _ = fs::create_dir_all(resolved_install_dir.join("bin"));
    let _ = fs::create_dir_all(resolved_install_dir.join("assets"));
    let _ = fs::create_dir_all(resolved_install_dir.join("runtimes"));
    version_manager::cleanup_installer_artifacts(&resolved_install_dir);

    // 2. Detección inteligente por ruta, nombre o CLI
    let exe_name = current_exe
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    let is_portable =
        args.iter().any(|arg| arg == "--portable" || arg == "-p") || exe_name.contains("portable");
    let is_in_install_dir = current_exe.starts_with(&resolved_install_dir);
    let is_setup_binary = exe_name.contains("install") || exe_name.contains("setup");

    let mode = if !is_portable
        && (args.iter().any(|arg| arg == "--install" || arg == "-i")
            || is_setup_binary
            || (!is_installed && !is_in_install_dir))
    {
        BootMode::Install
    } else {
        BootMode::Launcher
    };

    BootContext {
        mode,
        default_install_dir: resolved_install_dir.to_string_lossy().to_string(),
        current_exe: current_exe.to_string_lossy().to_string(),
        is_installed,
        os: std::env::consts::OS.to_string(),
    }
}

pub fn perform_self_install_sync(
    target_dir: &str,
    create_desktop_shortcut: Option<bool>,
) -> Result<(), String> {
    let path = validate_install_dir(target_dir)?;
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Error al crear directorio: {}", e))?;
    }

    // Estructura de carpetas aisladas
    let _ = fs::create_dir_all(path.join("mods"));
    let _ = fs::create_dir_all(path.join("profiles"));
    let _ = fs::create_dir_all(path.join("bin"));
    let _ = fs::create_dir_all(path.join("assets"));
    let _ = fs::create_dir_all(path.join("runtimes"));

    let is_windows = cfg!(target_os = "windows");
    let exe_name = if is_windows {
        "CrystalTidesLauncher.exe"
    } else {
        "CrystalTidesLauncher"
    };

    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Error obteniendo ejecutable actual: {}", e))?;
    let target_launcher = path.join("bin").join(exe_name);

    // Copiar ejecutable actual a ~/.crystaltides/bin/
    if current_exe != target_launcher {
        fs::copy(&current_exe, &target_launcher).map_err(|e| {
            format!(
                "Error al copiar ejecutable a la carpeta de instalación: {}",
                e
            )
        })?;
    }

    // Metadatos de instalación atómicos
    let installed_file = path.join(".installed.json");
    let tmp_file = path.join(".installed.json.tmp");
    let metadata = serde_json::json!({
        "installed": true,
        "productName": "CrystalTides Launcher - Papyrus Edition",
        "installedAt": chrono_now(),
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "executable": target_launcher.to_string_lossy().to_string()
    });
    fs::write(&tmp_file, metadata.to_string())
        .map_err(|e| format!("Error escribiendo metadata de instalación: {}", e))?;
    fs::rename(&tmp_file, &installed_file)
        .map_err(|e| format!("Error atomizando .installed.json: {}", e))?;

    // Registro en el SO y accesos directos
    sys::register_system_app(
        &target_launcher,
        &path,
        create_desktop_shortcut.unwrap_or(true),
    )?;

    Ok(())
}

#[tauri::command]
async fn perform_self_install(
    target_dir: String,
    create_desktop_shortcut: Option<bool>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        perform_self_install_sync(&target_dir, create_desktop_shortcut)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn launch_installed_app_sync(target_dir: &str) -> Result<(), String> {
    agent::validate_game_dir(target_dir)?;
    let is_windows = cfg!(target_os = "windows");
    let exe_name = if is_windows {
        "CrystalTidesLauncher.exe"
    } else {
        "CrystalTidesLauncher"
    };

    let bin_path = Path::new(target_dir).join("bin").join(exe_name);
    let root_path = Path::new(target_dir).join(exe_name);

    let target = if bin_path.exists() {
        bin_path
    } else if root_path.exists() {
        root_path
    } else {
        return Err("No se encontró el ejecutable instalado.".to_string());
    };

    let _ = Command::new(&target)
        .current_dir(target_dir)
        .spawn()
        .map_err(|e| format!("Error al iniciar el Launcher: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn launch_installed_app(target_dir: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || launch_installed_app_sync(&target_dir))
        .await
        .map_err(|e| e.to_string())?
}

pub fn is_authorized_uninstall_target(path: &Path) -> Result<PathBuf, String> {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());

    // 1. Prohibir raíces del disco o carpetas críticas
    if canonical.parent().is_none() {
        return Err("Ruta no autorizada: No se permite desinstalar la raíz del disco.".to_string());
    }

    if let Some(home) = dirs::home_dir() {
        let home_canon = home.canonicalize().unwrap_or(home.clone());
        if canonical == home_canon {
            return Err(
                "Ruta no autorizada: No se permite desinstalar el directorio raíz del usuario."
                    .to_string(),
            );
        }
        let desktop = home.join("Desktop");
        let desktop_canon = desktop.canonicalize().unwrap_or(desktop);
        if canonical == desktop_canon {
            return Err(
                "Ruta no autorizada: No se permite desinstalar el escritorio del usuario."
                    .to_string(),
            );
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(sys_drive) = std::env::var("SystemDrive") {
            let win_dir = PathBuf::from(format!("{}\\Windows", sys_drive));
            let pf_dir = PathBuf::from(format!("{}\\Program Files", sys_drive));
            let pf86_dir = PathBuf::from(format!("{}\\Program Files (x86)", sys_drive));
            if canonical.starts_with(&win_dir)
                || canonical.starts_with(&pf_dir)
                || canonical.starts_with(&pf86_dir)
            {
                return Err(
                    "Ruta no autorizada: Directorio protegido del sistema operativo.".to_string(),
                );
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let forbidden = [
            Path::new("/etc"),
            Path::new("/usr"),
            Path::new("/bin"),
            Path::new("/sbin"),
            Path::new("/var"),
        ];
        for f in &forbidden {
            if canonical.starts_with(f) {
                return Err(
                    "Ruta no autorizada: Directorio protegido del sistema operativo.".to_string(),
                );
            }
        }
    }

    // 2. Coincide con el directorio de instalación predeterminado (~/.crystaltides)
    let default_dir =
        sys::get_default_install_dir().unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let default_canonical = default_dir
        .canonicalize()
        .unwrap_or_else(|_| default_dir.clone());
    if canonical.starts_with(&default_canonical) {
        return Ok(canonical);
    }

    // 3. Coincide con la ubicación registrada en el sistema operativo (Registro de Windows)
    if let Some(reg_dir) = sys::get_registered_install_location() {
        let reg_canonical = reg_dir.canonicalize().unwrap_or_else(|_| reg_dir.clone());
        if canonical == reg_canonical || canonical.starts_with(&reg_canonical) {
            return Ok(canonical);
        }
    }

    // 4. Directorio de instalación personalizado autenticado por .installed.json de CrystalTides
    let installed_json = canonical.join(".installed.json");
    if installed_json.exists() {
        if let Ok(content) = fs::read_to_string(&installed_json) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                let is_installed = val
                    .get("installed")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let prod_name = val
                    .get("productName")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if is_installed && prod_name.contains("CrystalTides") {
                    return Ok(canonical);
                }
            }
        }
    }

    Err("Ruta no autorizada para desinstalación: debe residir dentro del directorio de CrystalTides.".to_string())
}

pub fn perform_self_uninstall_sync(
    target_dir: &str,
    remove_user_data: Option<bool>,
) -> Result<(), String> {
    if target_dir.trim().is_empty() {
        return Err("Ruta de desinstalación vacía.".to_string());
    }
    let path = Path::new(target_dir);
    if path
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("Ruta no autorizada: secuencias relativas '..' prohibidas.".to_string());
    }

    let verified_dir = is_authorized_uninstall_target(path)?;
    let remove_all = remove_user_data.unwrap_or(false);
    sys::unregister_system_app(&verified_dir, remove_all)?;

    Ok(())
}

#[tauri::command]
async fn perform_self_uninstall(
    target_dir: String,
    remove_user_data: Option<bool>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || perform_self_uninstall_sync(&target_dir, remove_user_data))
        .await
        .map_err(|e| e.to_string())?
}

pub fn schedule_self_deletion_sync(target_dir: &str) -> Result<(), String> {
    if target_dir.trim().is_empty() {
        return Err("Ruta de desinstalación vacía.".to_string());
    }
    let path = Path::new(target_dir);
    if path
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("Ruta no autorizada: secuencias relativas '..' prohibidas.".to_string());
    }

    let verified_dir = is_authorized_uninstall_target(path)?;
    sys::schedule_self_deletion(&verified_dir)?;
    Ok(())
}

#[tauri::command]
async fn schedule_self_deletion(target_dir: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || schedule_self_deletion_sync(&target_dir))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn close_app(window: tauri::Window) {
    let _ = window.close();
}

pub fn add_windows_defender_exclusion_sync(folder_path: &str) -> Result<(), String> {
    if folder_path.trim().is_empty() {
        return Err("Ruta de exclusión vacía.".to_string());
    }
    let path = Path::new(folder_path);
    if path
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("Ruta no autorizada: secuencias relativas '..' prohibidas.".to_string());
    }

    let verified_dir = is_authorized_uninstall_target(path)?;
    sys::add_defender_exclusion(&verified_dir)
}

#[tauri::command]
async fn add_windows_defender_exclusion(folder_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || add_windows_defender_exclusion_sync(&folder_path))
        .await
        .map_err(|e| e.to_string())?
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
async fn get_launcher_logs(max_lines: Option<usize>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || logger::get_launcher_logs(max_lines))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_minecraft_logs(max_lines: Option<usize>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || logger::get_minecraft_logs(max_lines))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn open_logs_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = logger::get_logs_directory();
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    let path_str = dir.to_string_lossy().to_string();
    app.opener()
        .open_path(path_str, None::<&str>)
        .map_err(|e| format!("Error abriendo carpeta de logs: {e}"))
}

#[tauri::command]
fn get_home_dir() -> Option<String> {
    dirs::home_dir().map(|path| path.to_string_lossy().to_string())
}

fn validate_safe_file_path(path_str: &str) -> Result<PathBuf, String> {
    paths::validate_safe_file_path(path_str)
}

#[tauri::command]
async fn read_text_file(path: String) -> Result<String, error::AppError> {
    tokio::task::spawn_blocking(move || {
        let safe_path = validate_safe_file_path(&path).map_err(error::AppError::security)?;
        std::fs::read_to_string(safe_path).map_err(error::AppError::io)
    })
    .await
    .map_err(|e| error::AppError::io(e.to_string()))?
}

#[tauri::command]
async fn write_text_file(path: String, content: String) -> Result<(), error::AppError> {
    tokio::task::spawn_blocking(move || {
        let safe_path = validate_safe_file_path(&path).map_err(error::AppError::security)?;
        if let Some(parent) = safe_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(safe_path, content).map_err(error::AppError::io)
    })
    .await
    .map_err(|e| error::AppError::io(e.to_string()))?
}

#[tauri::command]
async fn file_exists(path: String) -> bool {
    tokio::task::spawn_blocking(move || {
        if let Ok(safe_path) = validate_safe_file_path(&path) {
            safe_path.exists()
        } else {
            false
        }
    })
    .await
    .unwrap_or(false)
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), error::AppError> {
    tokio::task::spawn_blocking(move || {
        let safe_path = validate_safe_file_path(&path).map_err(error::AppError::security)?;
        if safe_path.exists() {
            std::fs::remove_file(safe_path).map_err(error::AppError::io)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| error::AppError::io(e.to_string()))?
}

#[tauri::command]
async fn download_single_file(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    output_path: String,
    expected_sha1: Option<String>,
    expected_sha256: Option<String>,
) -> Result<(), error::AppError> {
    let safe_path = validate_safe_file_path(&output_path).map_err(error::AppError::security)?;
    let safe_url = network::validate_allowed_https_url(&url).map_err(error::AppError::security)?;
    let expected = if let Some(h) = expected_sha256 {
        downloader::ExpectedHash::Sha256(h)
    } else if let Some(h) = expected_sha1 {
        downloader::ExpectedHash::Sha1(h)
    } else {
        downloader::ExpectedHash::None
    };

    downloader::download_verified(&client, safe_url.as_str(), &safe_path, &expected, false)
        .await
        .map_err(error::AppError::network)
}

pub fn resolve_classpath_sync(
    game_dir: &str,
    home_dir: &str,
    version_id: &str,
    mc_version: &str,
    lib_rel_paths: &[String],
) -> String {
    use std::collections::HashSet;
    let mut cp_entries: Vec<String> = Vec::new();
    let mut seen_canonical: HashSet<String> = HashSet::new();

    let game_path = Path::new(game_dir);
    let home_path = Path::new(home_dir);

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
        add_if_exists(
            game_path
                .join("versions")
                .join(version_id)
                .join(format!("{}.jar", version_id)),
        );
        add_if_exists(
            home_path
                .join(".crystaltides/versions")
                .join(version_id)
                .join(format!("{}.jar", version_id)),
        );
        add_if_exists(
            mc_home_versions
                .join(version_id)
                .join(format!("{}.jar", version_id)),
        );
    }

    // 2. Base Vanilla jar
    add_if_exists(
        game_path
            .join("versions")
            .join(mc_version)
            .join(format!("{}.jar", mc_version)),
    );
    add_if_exists(
        home_path
            .join(".crystaltides/versions")
            .join(mc_version)
            .join(format!("{}.jar", mc_version)),
    );
    add_if_exists(
        mc_home_versions
            .join(mc_version)
            .join(format!("{}.jar", mc_version)),
    );

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

    let separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    cp_entries.join(separator)
}

#[tauri::command]
async fn resolve_classpath(
    game_dir: String,
    home_dir: String,
    version_id: String,
    mc_version: String,
    lib_rel_paths: Vec<String>,
) -> String {
    tokio::task::spawn_blocking(move || {
        resolve_classpath_sync(
            &game_dir,
            &home_dir,
            &version_id,
            &mc_version,
            &lib_rel_paths,
        )
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn launch_minecraft(
    app_handle: tauri::AppHandle,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
    profile_id: Option<String>,
    pre_launch_command: Option<String>,
    wrapper_command: Option<String>,
    post_exit_command: Option<String>,
    environment_variables: Option<String>,
) -> Result<u32, String> {
    tokio::task::spawn_blocking(move || {
        paths::validate_game_dir(&game_dir)?;
        version_manager::cleanup_installer_artifacts(Path::new(&game_dir));

        let (trusted_pre, trusted_wrap, trusted_post, trusted_env) =
            if let Some(ref pid) = profile_id {
                if let Ok(profiles) = db::get_profiles_sync() {
                    if let Some(prof) = profiles.into_iter().find(|p| p.id == *pid) {
                        (
                            prof.pre_launch_command.or(pre_launch_command),
                            prof.wrapper_command.or(wrapper_command),
                            prof.post_exit_command.or(post_exit_command),
                            prof.environment_variables.or(environment_variables),
                        )
                    } else {
                        (
                            pre_launch_command,
                            wrapper_command,
                            post_exit_command,
                            environment_variables,
                        )
                    }
                } else {
                    (
                        pre_launch_command,
                        wrapper_command,
                        post_exit_command,
                        environment_variables,
                    )
                }
            } else {
                (
                    pre_launch_command,
                    wrapper_command,
                    post_exit_command,
                    environment_variables,
                )
            };

        process_manager::launch_minecraft_process(
            app_handle,
            java_path,
            args,
            game_dir,
            trusted_pre,
            trusted_wrap,
            trusted_post,
            trusted_env,
        )
    })
    .await
    .map_err(|e| e.to_string())?
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
    let app_clone = app_handle.clone();
    let path = java_manager::download_and_install_java(
        version as u8,
        &install_path,
        distribution.as_deref(),
        move |progress| {
            let _ = app_clone.emit("java-install-progress", progress);
        },
    )
    .await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn check_java_status(install_dir: String) -> Option<String> {
    tokio::task::spawn_blocking(move || {
        java_manager::find_java_binary(std::path::Path::new(&install_dir))
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
async fn http_post(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
    body: String,
) -> Result<String, error::AppError> {
    let safe_url = network::validate_allowed_https_url(&url).map_err(error::AppError::security)?;
    let mut req = client.post(safe_url.as_str());
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req
        .body(body)
        .send()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    let status = res.status();
    let text = res
        .text()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    if !status.is_success() {
        return Err(error::AppError::network(format!(
            "HTTP {}: {}",
            status, text
        )));
    }
    Ok(text)
}

#[tauri::command]
async fn http_get(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
) -> Result<String, error::AppError> {
    let safe_url = network::validate_allowed_https_url(&url).map_err(error::AppError::security)?;
    let mut req = client.get(safe_url.as_str());
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req
        .send()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    let status = res.status();
    let text = res
        .text()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    if !status.is_success() {
        return Err(error::AppError::network(format!(
            "HTTP {}: {}",
            status, text
        )));
    }
    Ok(text)
}

#[tauri::command]
async fn http_put(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
    body: String,
) -> Result<String, error::AppError> {
    let safe_url = network::validate_allowed_https_url(&url).map_err(error::AppError::security)?;
    let mut req = client.put(safe_url.as_str());
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req
        .body(body)
        .send()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    let status = res.status();
    let text = res
        .text()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    if !status.is_success() {
        return Err(error::AppError::network(format!(
            "HTTP {}: {}",
            status, text
        )));
    }
    Ok(text)
}

#[tauri::command]
async fn http_delete(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    headers: HashMap<String, String>,
) -> Result<String, error::AppError> {
    let safe_url = network::validate_allowed_https_url(&url).map_err(error::AppError::security)?;
    let mut req = client.delete(safe_url.as_str());
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req
        .send()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    let status = res.status();
    let text = res
        .text()
        .await
        .map_err(|e| error::AppError::network(e.to_string()))?;
    if !status.is_success() {
        return Err(error::AppError::network(format!(
            "HTTP {}: {}",
            status, text
        )));
    }
    Ok(text)
}

#[tauri::command]
async fn get_installed_minecraft_versions() -> Vec<String> {
    tokio::task::spawn_blocking(version_manager::get_installed_versions)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn prepare_minecraft_version(version_id: String, game_dir: String) -> Result<String, String> {
    agent::validate_game_dir(&game_dir)?;
    version_manager::cleanup_installer_artifacts(Path::new(&game_dir));
    version_manager::prepare_version(&version_id, &game_dir).await
}

#[tauri::command]
async fn cleanup_installer_cache(game_dir: String) {
    let _ = tokio::task::spawn_blocking(move || {
        version_manager::cleanup_installer_artifacts(Path::new(&game_dir));
    })
    .await;
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
    version_manager::install_mod_loader(
        &loader_type,
        &loader_version,
        &mc_version,
        &game_dir,
        &java_path,
    )
    .await
}

#[tauri::command]
async fn scan_external_instances() -> Vec<importer::ImportableInstance> {
    tokio::task::spawn_blocking(importer::scan_all_external_instances)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn inspect_custom_instance_dir(path: String) -> Result<importer::ImportableInstance, String> {
    tokio::task::spawn_blocking(move || importer::inspect_custom_instance_dir(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pick_instance_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        app.dialog()
            .file()
            .blocking_pick_folder()
            .map(|p| p.to_string())
    })
    .await
    .map_err(|e| e.to_string())
}

pub fn is_valid_instance_id(id: &str) -> bool {
    let trimmed = id.trim();
    !trimmed.is_empty()
        && trimmed.len() <= 64
        && trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn delete_instance_dir_sync(instance_id: &str) -> Result<(), String> {
    let trimmed = instance_id.trim();
    if !is_valid_instance_id(trimmed) {
        return Err("Identificador de instancia inválido o inseguro.".to_string());
    }

    let instances_root = paths::get_launcher_instances_dir();
    let target_dir = instances_root.join(trimmed);

    if target_dir == instances_root || !target_dir.starts_with(&instances_root) {
        return Err(
            "La ruta calculada no reside dentro del directorio de instancias del launcher."
                .to_string(),
        );
    }

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|e| {
            format!(
                "Error eliminando directorio de instancia {:?}: {}",
                target_dir, e
            )
        })?;
        logger::log(
            "INFO",
            "InstanceManager",
            &format!(
                "Directorio de instancia eliminado exitosamente: {:?}",
                target_dir
            ),
        );
    }

    Ok(())
}

#[tauri::command]
async fn delete_instance_dir(instance_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || delete_instance_dir_sync(&instance_id))
        .await
        .map_err(|e| e.to_string())?
}

fn parse_oauth_query(
    url: &tauri::Url,
    expected_state: Option<&str>,
) -> Option<Result<String, String>> {
    let url_str = url.as_str();
    let is_callback = url_str.starts_with("https://login.live.com/oauth20_desktop.srf")
        || url_str.starts_with("https://crystaltidessmp.net/ms-callback.html")
        || (cfg!(debug_assertions)
            && url_str.starts_with("http://localhost:5173/ms-callback.html"));

    if !is_callback || url.query().is_none() {
        return None;
    }

    let mut code = None;
    let mut error = None;
    let mut returned_state = None;

    for (k, v) in url.query_pairs() {
        if k == "code" {
            code = Some(v.into_owned());
        } else if k == "error" {
            error = Some(v.into_owned());
        } else if k == "state" {
            returned_state = Some(v.into_owned());
        }
    }

    if let Some(err) = error {
        return Some(Err(format!("Error de Microsoft: {}", err)));
    }

    if let Some(expected) = expected_state {
        if returned_state.as_deref() != Some(expected) {
            return Some(Err(
                "Violación de integridad OAuth: discrepancia de state (posible ataque CSRF)"
                    .to_string(),
            ));
        }
    }

    code.map(Ok)
}

#[tauri::command]
async fn open_microsoft_auth_window(
    app_handle: tauri::AppHandle,
    code_challenge: Option<String>,
    state: Option<String>,
) -> Result<String, String> {
    use std::sync::{Arc, Mutex};
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
    use tokio::sync::oneshot;

    if let Some(existing) = app_handle.get_webview_window("microsoft-login-window") {
        let _ = existing.destroy();
    }

    let effective_state = state.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let mut auth_url = format!(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=3974b918-cd84-4d60-8955-2ad65234d16b&response_type=code&redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf&scope=XboxLive.SignIn%20XboxLive.offline_access&prompt=select_account&state={}",
        effective_state
    );

    if let Some(ref challenge) = code_challenge {
        auth_url.push_str(&format!(
            "&code_challenge={}&code_challenge_method=S256",
            challenge
        ));
    }

    let (tx, rx) = oneshot::channel::<Result<String, String>>();
    let tx_mutex = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = tx_mutex.clone();
    let expected_state = effective_state.clone();

    let window = WebviewWindowBuilder::new(
        &app_handle,
        "microsoft-login-window",
        WebviewUrl::External(
            auth_url
                .parse()
                .map_err(|e| format!("URL no válida: {}", e))?,
        ),
    )
    .title("CrystalTides Lite - Iniciar sesión con Microsoft")
    .inner_size(520.0, 680.0)
    .resizable(false)
    .always_on_top(true)
    .on_navigation(move |url| {
        if let Some(auth_result) = parse_oauth_query(url, Some(&expected_state)) {
            let mut lock = tx_nav.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(sender) = lock.take() {
                let _ = sender.send(auth_result);
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Error creando ventana de autenticación: {}", e))?;

    let window_clone = window.clone();
    let tx_close = tx_mutex.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let mut lock = tx_close.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(sender) = lock.take() {
                let _ = sender.send(Err(
                    "El usuario cerró la ventana de inicio de sesión.".to_string()
                ));
            }
        }
    });

    let code_res = rx
        .await
        .map_err(|_| "La ventana de inicio de sesión se cerró inesperadamente.".to_string())?;
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
            logger::log(
                "INFO",
                "AutoUpdater",
                &format!("Actualización disponible: v{}", update.version),
            );
            Ok(AppUpdateInfo {
                available: true,
                current_version,
                version: Some(update.version.clone()),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            })
        }
        Ok(None) => {
            logger::log(
                "INFO",
                "AutoUpdater",
                "El launcher se encuentra en la versión más reciente.",
            );
            Ok(AppUpdateInfo {
                available: false,
                current_version,
                version: None,
                body: None,
                date: None,
            })
        }
        Err(e) => {
            logger::log(
                "WARN",
                "AutoUpdater",
                &format!("Check de actualización omitido o no disponible: {}", e),
            );
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
        update
            .download_and_install(
                |downloaded, total| {
                    println!(
                        "[AutoUpdater] Progress: downloaded {} of {:?}",
                        downloaded, total
                    );
                },
                || {
                    println!("[AutoUpdater] Download finished, applying binary...");
                },
            )
            .await
            .map_err(|e| format!("Error instalando actualización: {}", e))?;

        app.restart();
    }
    Ok(())
}

#[tauri::command]
async fn pick_install_directory(
    app: tauri::AppHandle,
    current_dir: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut builder = app
        .dialog()
        .file()
        .set_title("Seleccionar carpeta de instalación");
    if let Some(ref dir) = current_dir {
        builder = builder.set_directory(dir);
    }
    builder.pick_folder(move |folder| {
        let _ = tx.send(folder.map(|f| f.to_string()));
    });
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

static SHARED_HTTP_CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();

pub fn get_shared_http_client() -> &'static reqwest::Client {
    SHARED_HTTP_CLIENT.get_or_init(|| {
        let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 10 {
                return attempt.error("Demasiadas redirecciones consecutivas.");
            }
            let next_url = attempt.url();
            if let Err(e) = crate::network::validate_allowed_https_url(next_url.as_str()) {
                return attempt.error(format!("Redirección abortada por seguridad: {e}"));
            }
            attempt.follow()
        });

        reqwest::Client::builder()
            .user_agent("CrystalTides-Launcher-Lite")
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .redirect(redirect_policy)
            .build()
            .unwrap_or_default()
    })
}

/// `QuietUninstallString` del registro: `"<exe>" --uninstall --silent`.
fn is_silent_uninstall(args: &[String]) -> bool {
    let has = |flags: &[&str]| {
        args.iter()
            .skip(1)
            .any(|arg| flags.iter().any(|flag| arg.eq_ignore_ascii_case(flag)))
    };
    has(&["--uninstall", "-u"]) && has(&["--silent"])
}

/// Desinstalación sin ventana con los mismos valores por defecto que `UninstallerView`:
/// conserva los datos del usuario y programa el borrado de `bin/` al salir.
fn run_silent_uninstall() -> i32 {
    let current_exe = std::env::current_exe().unwrap_or_default();
    let install_dir = resolve_install_dir(&current_exe);
    if !sys::is_app_installed(&install_dir) {
        logger::log(
            "WARN",
            "Uninstall",
            &format!(
                "Desinstalación silenciosa: no hay instalación en {:?}",
                install_dir
            ),
        );
        return 1;
    }

    let dir = install_dir.to_string_lossy().to_string();
    match perform_self_uninstall_sync(&dir, Some(false))
        .and_then(|()| schedule_self_deletion_sync(&dir))
    {
        Ok(()) => {
            logger::log(
                "INFO",
                "Uninstall",
                &format!("Desinstalación silenciosa completada en {:?}", install_dir),
            );
            0
        }
        Err(e) => {
            logger::log(
                "ERROR",
                "Uninstall",
                &format!("Desinstalación silenciosa fallida: {}", e),
            );
            1
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    if self_update::is_update_handoff(&args) {
        // Termina el proceso si el traspaso tuvo éxito; si no, se sigue con el arranque normal
        // (el nombre temporal contiene "installer", así que se ofrece reinstalar).
        self_update::perform_update_handoff();
    }
    if is_silent_uninstall(&args) {
        std::process::exit(run_silent_uninstall());
    }

    let http_client = get_shared_http_client().clone();

    if let Err(e) = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(http_client)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" && process_manager::is_game_running() {
                    logger::log(
                        "WARN",
                        "App",
                        "Cierre del Launcher detectado con Minecraft activo.",
                    );
                }
            }
        })
        .setup(|app| {
            use tauri::Manager;
            logger::init();
            logger::log("INFO", "App", "CrystalTides Launcher backend inicializado.");
            let db_state = db::init_managed_db().map_err(Box::<dyn std::error::Error>::from)?;
            app.manage(db_state);
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = agent::start_game_ipc_server(handle).await;
            });
            let boot_ctx = get_boot_context();
            if let Some(window) = app.get_webview_window("main") {
                if boot_ctx.mode == BootMode::Install || boot_ctx.mode == BootMode::Uninstall {
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
            pick_install_directory,
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
            agent::remove_crystaltides_boost,
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
    {
        eprintln!("error while running tauri application: {}", e);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fake_installed_dir() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(".installed.json"), r#"{"installed":true}"#).unwrap();
        dir
    }

    #[test]
    fn test_is_silent_uninstall_matches_registry_quiet_uninstall_string() {
        let args = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(is_silent_uninstall(&args(&[
            "C:\\x\\bin\\CrystalTidesLauncher.exe",
            "--uninstall",
            "--silent"
        ])));
        assert!(is_silent_uninstall(&args(&[
            "launcher.exe",
            "-u",
            "--SILENT"
        ])));
        // Sin --silent sigue siendo el asistente con UI
        assert!(!is_silent_uninstall(&args(&[
            "launcher.exe",
            "--uninstall"
        ])));
        assert!(!is_silent_uninstall(&args(&["launcher.exe", "--silent"])));
    }

    #[test]
    fn test_pick_install_dir_explicit_home_never_falls_back_to_registry() {
        let isolated_home = tempfile::tempdir().unwrap(); // aún no instalado
        let registered = fake_installed_dir();
        let exe = registered
            .path()
            .join("bin")
            .join("CrystalTidesLauncher.exe");

        let picked = pick_install_dir(
            isolated_home.path().to_path_buf(),
            true,
            || Some(registered.path().to_path_buf()),
            &exe,
        );
        assert_eq!(picked, isolated_home.path());
    }

    #[test]
    fn test_pick_install_dir_without_explicit_home_uses_registered_install() {
        let default_dir = tempfile::tempdir().unwrap(); // ~/.crystaltides sin instalar
        let registered = fake_installed_dir();
        let exe = std::env::temp_dir().join("CrystalTides-Setup.exe");

        let picked = pick_install_dir(
            default_dir.path().to_path_buf(),
            false,
            || Some(registered.path().to_path_buf()),
            &exe,
        );
        assert_eq!(picked, registered.path());

        let installed_default = fake_installed_dir();
        let picked = pick_install_dir(
            installed_default.path().to_path_buf(),
            false,
            || Some(registered.path().to_path_buf()),
            &exe,
        );
        assert_eq!(picked, installed_default.path());
    }

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
        assert!(
            res.is_err(),
            "Debe rechazar rutas arbitrarias del sistema fuera del ámbito de CrystalTides"
        );
    }

    #[test]
    fn test_validate_safe_file_path_allows_authorized_temp_dir() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let temp_file = temp_dir.path().join("crystaltides_test_file.txt");
        let path_str = temp_file.to_string_lossy().to_string();
        let validated = validate_safe_file_path(&path_str);
        assert!(
            validated.is_ok(),
            "Debe permitir archivos dentro del directorio temporal autorizado"
        );
    }

    #[test]
    fn test_default_install_dir_unification() {
        let default_dir = sys::get_default_install_dir().expect("Debe existir home_dir");
        assert!(
            default_dir.ends_with(".crystaltides") || std::env::var_os("CRYSTALTIDES_HOME").is_some(),
            "El directorio de instalación predeterminado debe ser ~/.crystaltides en todas las plataformas: {:?}",
            default_dir
        );
    }

    #[test]
    fn test_perform_self_uninstall_and_deletion_rejects_invalid_paths() {
        assert!(perform_self_uninstall_sync("", None).is_err());
        assert!(schedule_self_deletion_sync("").is_err());

        #[cfg(target_os = "windows")]
        let bad_path = "C:/Windows/System32";
        #[cfg(not(target_os = "windows"))]
        let bad_path = "/etc";

        assert!(perform_self_uninstall_sync(bad_path, None).is_err());
        assert!(schedule_self_deletion_sync(bad_path).is_err());

        // Debe rechazar el home raíz directo o subcarpetas del usuario fuera de .crystaltides (ej: Desktop)
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy().to_string();
            assert!(perform_self_uninstall_sync(&home_str, None).is_err());
            assert!(schedule_self_deletion_sync(&home_str).is_err());

            let desktop = home.join("Desktop").to_string_lossy().to_string();
            assert!(perform_self_uninstall_sync(&desktop, None).is_err());
            assert!(schedule_self_deletion_sync(&desktop).is_err());

            // Debe rechazar secuencias con '..' incluso si aparentan comenzar por .crystaltides
            let traversal_path = home
                .join(".crystaltides")
                .join("..")
                .join("Desktop")
                .to_string_lossy()
                .to_string();
            assert!(perform_self_uninstall_sync(&traversal_path, None).is_err());
            assert!(schedule_self_deletion_sync(&traversal_path).is_err());
            assert!(add_windows_defender_exclusion_sync(&traversal_path).is_err());
        }
    }

    #[test]
    fn test_delete_instance_dir_rejects_unsafe_ids() {
        assert!(delete_instance_dir_sync("").is_err());
        assert!(delete_instance_dir_sync("   ").is_err());
        assert!(delete_instance_dir_sync(".").is_err());
        assert!(delete_instance_dir_sync("..").is_err());
        assert!(delete_instance_dir_sync("../escaped").is_err());
        assert!(delete_instance_dir_sync("inst/sub").is_err());
        assert!(delete_instance_dir_sync("inst\\sub").is_err());
        assert!(delete_instance_dir_sync("inst.dot").is_err());
        assert!(delete_instance_dir_sync(&"a".repeat(65)).is_err());
        assert!(is_valid_instance_id("valid-instance_123"));
        assert!(!is_valid_instance_id("."));
        assert!(!is_valid_instance_id(".."));
        assert!(!is_valid_instance_id("inst/sub"));
        assert!(!is_valid_instance_id("inst\\sub"));
    }

    #[test]
    fn test_is_authorized_uninstall_target_custom_dir() {
        let temp_dir =
            std::env::temp_dir().join(format!("ct_test_uninstall_{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        // 1. Sin .installed.json -> debe fallar
        assert!(is_authorized_uninstall_target(&temp_dir).is_err());

        // 2. Con .installed.json ajeno -> debe fallar
        let installed_file = temp_dir.join(".installed.json");
        let fake_meta = serde_json::json!({
            "productName": "Other Game",
            "version": "1.0.0"
        });
        fs::write(&installed_file, fake_meta.to_string()).unwrap();
        assert!(is_authorized_uninstall_target(&temp_dir).is_err());

        // 3. Con .installed.json de CrystalTides -> autorizado
        let valid_meta = serde_json::json!({
            "installed": true,
            "productName": "CrystalTides Launcher",
            "version": "0.1.0"
        });
        fs::write(&installed_file, valid_meta.to_string()).unwrap();
        assert!(is_authorized_uninstall_target(&temp_dir).is_ok());

        // Limpieza
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
