mod java_manager;
mod process_manager;
mod sys;

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

    // 2. Detección inteligente por ruta
    let current_dir = current_exe.parent().unwrap_or_else(|| Path::new("."));
    let is_running_from_install_dir = current_dir.starts_with(&default_dir)
        || current_dir == default_dir.as_path()
        || current_dir == default_dir.join("bin").as_path();

    let mode = if is_running_from_install_dir || is_installed {
        "launcher"
    } else {
        "install"
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
fn log_frontend(msg: String) {
    println!("[Launcher Lite] {}", msg);
}

#[tauri::command]
fn get_home_dir() -> Option<String> {
    dirs::home_dir().map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn launch_minecraft(
    app_handle: tauri::AppHandle,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
) -> Result<u32, String> {
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
    let path = java_manager::download_and_install_java(version as u8, std::path::Path::new(&install_dir), |progress| {
        let _ = app_handle.emit("java-install-progress", progress);
    })?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn check_java_status(install_dir: String) -> Option<String> {
    java_manager::find_java_binary(std::path::Path::new(&install_dir))
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
async fn http_post(url: String, headers: HashMap<String, String>, body: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client.post(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.body(body).send().await.map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn http_get(url: String, headers: HashMap<String, String>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn http_put(url: String, headers: HashMap<String, String>, body: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client.put(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.body(body).send().await.map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn http_delete(url: String, headers: HashMap<String, String>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client.delete(&url);
    for (key, val) in headers {
        req = req.header(key, val);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_boot_context,
            perform_self_install,
            launch_installed_app,
            perform_self_uninstall,
            schedule_self_deletion,
            close_app,
            log_frontend,
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
            open_microsoft_auth_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
