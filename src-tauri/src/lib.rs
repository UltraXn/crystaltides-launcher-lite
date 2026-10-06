mod agent;
mod discord_rpc;
mod gpu_preset;
mod hardware;
mod java_manager;
mod logger;
mod mod_sync;
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

    // 2. Detección inteligente por ruta o CLI
    let mode = if args.iter().any(|arg| arg == "--install" || arg == "-i") {
        "install"
    } else {
        "launcher"
    };

    BootContext {
        mode: mode.to_string(),
        default_install_dir: default_dir.to_string_lossy().to_string(),
        current_exe: current_exe.to_string_lossy().to_string(),
        is_installed: true,
        os: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
fn perform_self_install(target_dir: String) -> Result<(), String> {
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
    sys::register_system_app(&target_launcher, path)?;

    Ok(())
}

#[tauri::command]
fn launch_installed_app(target_dir: String) -> Result<(), String> {
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
    let path = Path::new(&target_dir);
    let remove_all = remove_user_data.unwrap_or(false);

    sys::unregister_system_app(path, remove_all)?;

    Ok(())
}

#[tauri::command]
fn schedule_self_deletion(target_dir: String) -> Result<(), String> {
    let path = Path::new(&target_dir);
    sys::schedule_self_deletion(path)?;
    Ok(())
}

#[tauri::command]
fn close_app(window: tauri::Window) {
    let _ = window.close();
}

fn chrono_now() -> String {
    "2026-08-29T05:00:00Z".to_string()
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
    #[cfg(not(target_os = "windows"))]
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

fn validate_safe_file_path(path_str: &str) -> Result<PathBuf, String> {
    if path_str.contains("..") {
        return Err("Ruta no permitida: secuencias relativas '..' prohibidas.".to_string());
    }
    Ok(PathBuf::from(path_str))
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
    let mc_home_libs = home_path.join("AppData/Roaming/.minecraft/libraries");

    let mut add_if_exists = |candidate: PathBuf| {
        if candidate.is_file() {
            let canonical_key = candidate
                .canonicalize()
                .map(|p| p.to_string_lossy().to_lowercase())
                .unwrap_or_else(|_| candidate.to_string_lossy().to_lowercase());

            if !seen_canonical.contains(&canonical_key) {
                seen_canonical.insert(canonical_key);
                cp_entries.push(candidate.to_string_lossy().replace('/', "\\"));
            }
        }
    };

    // 1. Mod Loader jar if exists
    if version_id != mc_version {
        add_if_exists(game_path.join("versions").join(&version_id).join(format!("{}.jar", version_id)));
    }

    // 2. Base Vanilla jar
    add_if_exists(game_path.join("versions").join(&mc_version).join(format!("{}.jar", mc_version)));
    add_if_exists(home_path.join("AppData/Roaming/.minecraft/versions").join(&mc_version).join(format!("{}.jar", mc_version)));

    // 3. Libraries
    for rel in lib_rel_paths {
        let clean_rel = rel.replace('\\', "/");
        let p1 = game_path.join("libraries").join(Path::new(&clean_rel));
        if p1.is_file() {
            add_if_exists(p1);
        } else {
            let p2 = mc_home_libs.join(Path::new(&clean_rel));
            if p2.is_file() {
                add_if_exists(p2);
            }
        }
    }

    cp_entries.join(";")
}

#[tauri::command]
fn launch_minecraft(
    app_handle: tauri::AppHandle,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
) -> Result<u32, String> {
    version_manager::cleanup_installer_artifacts(Path::new(&game_dir));
    process_manager::launch_minecraft_process(app_handle, java_path, args, game_dir)
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
) -> Result<String, String> {
    use tauri::Emitter;
    let install_path = std::path::PathBuf::from(install_dir);
    tokio::task::spawn_blocking(move || {
        let path = java_manager::download_and_install_java(version as u8, &install_path, move |progress| {
            let _ = app_handle.emit("java-install-progress", progress);
        })?;
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
    let text = res.text().await.map_err(|e| e.to_string())?;
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
    let text = res.text().await.map_err(|e| e.to_string())?;
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
    let text = res.text().await.map_err(|e| e.to_string())?;
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
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
fn get_installed_minecraft_versions() -> Vec<String> {
    version_manager::get_installed_versions()
}

#[tauri::command]
async fn prepare_minecraft_version(version_id: String, game_dir: String) -> Result<String, String> {
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
    version_manager::install_mod_loader(&loader_type, &loader_version, &mc_version, &game_dir, &java_path).await
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
        let url_str = url.as_str();
        if url_str.starts_with("https://login.live.com/oauth20_desktop.srf")
            || url_str.starts_with("https://crystaltidessmp.net/ms-callback.html")
            || url_str.starts_with("http://localhost:5173/ms-callback.html")
        {
            if let Some(query) = url.query() {
                for pair in query.split('&') {
                    let mut parts = pair.splitn(2, '=');
                    if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                        if k == "code" {
                            if let Some(sender) = tx_nav.lock().unwrap().take() {
                                let _ = sender.send(Ok(v.to_string()));
                            }
                            return false;
                        } else if k == "error" {
                            if let Some(sender) = tx_nav.lock().unwrap().take() {
                                let _ = sender.send(Err(format!("Error de Microsoft: {}", v)));
                            }
                            return false;
                        }
                    }
                }
            }
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;

    let window_clone = window.clone();
    let tx_close = tx_mutex.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            if let Some(sender) = tx_close.lock().unwrap().take() {
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
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 1280.0,
                    height: 720.0,
                }));
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
            launch_minecraft,
            kill_minecraft,
            is_game_running,
            check_java_status,
            install_java_runtime,
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
            gpu_preset::apply_gpu_options,
            agent::prepare_crystal_agent,
            agent::get_agent_jvm_args,
            agent::get_agent_benchmark_status,
            mod_sync::download_mods_parallel,
            mod_sync::sync_mods,
            mod_sync::list_instance_mods,
            mod_sync::toggle_instance_mod,
            mod_sync::delete_instance_mod,
            mod_sync::open_folder,
            mod_sync::ensure_servers_dat,
            discord_rpc::set_discord_presence,
            discord_rpc::clear_discord_presence
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
