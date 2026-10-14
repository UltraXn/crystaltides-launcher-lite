// Prevents console window on Windows completely
#![windows_subsystem = "windows"]

fn main() {
    if let Some(home) = dirs::home_dir() {
        let config_path = home.join(".crystaltides").join("hardware_config.json");
        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if json.get("disable_hardware_acceleration").and_then(|v| v.as_bool()) == Some(true) {
                        // SAFETY: Called synchronously at the start of main() before any threads
                        // or the Tauri runtime have been spawned, eliminating any race condition on the environment block.
                        #[allow(unsafe_code)]
                        unsafe {
                            std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu");
                        }
                    }
                }
            }
        }
    }
    launcher_lite_tauri_lib::run()
}
