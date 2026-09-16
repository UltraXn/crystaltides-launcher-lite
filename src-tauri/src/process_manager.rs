use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize, Clone, Debug)]
pub struct GameLogPayload {
    pub line: String,
    pub level: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct GameStoppedPayload {
    pub exit_code: Option<i32>,
    pub success: bool,
}

static GAME_PROCESS: OnceLock<Arc<Mutex<Option<Child>>>> = OnceLock::new();

fn get_game_process_handle() -> &'static Arc<Mutex<Option<Child>>> {
    GAME_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)))
}

pub fn validate_java_binary(path_str: &str) -> Result<std::path::PathBuf, String> {
    let raw_path = std::path::Path::new(path_str);
    
    if !raw_path.exists() {
        return Err(format!("No existe el ejecutable Java especificado: {}", path_str));
    }

    let canonical = raw_path
        .canonicalize()
        .map_err(|e| format!("No se pudo resolver la ruta canónica del ejecutable Java: {}", e))?;

    let file_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.to_lowercase())
        .ok_or_else(|| "Ruta de ejecutable inválida.".to_string())?;

    let is_valid_java_name = if cfg!(target_os = "windows") {
        file_name == "java.exe" || file_name == "javaw.exe"
    } else {
        file_name == "java" || file_name == "javaw"
    };

    if !is_valid_java_name {
        return Err(format!(
            "Violación de Seguridad RCE: El binario especificado ('{}') no es un ejecutable Java válido (java.exe / javaw.exe).",
            file_name
        ));
    }

    Ok(canonical)
}

pub fn launch_minecraft_process(
    app_handle: AppHandle,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
) -> Result<u32, String> {
    let validated_java_path = validate_java_binary(&java_path)?;
    let process_lock = get_game_process_handle();

    // 1. Check if process is already running
    {
        let mut lock = process_lock.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut child) = *lock {
            if let Ok(None) = child.try_wait() {
                return Err("Ya existe una instancia de Minecraft en ejecución.".to_string());
            }
        }
    }

    println!("[ProcessManager] Launching validated Java binary at: {:?}", validated_java_path);

    // 2. Spawn Child Process with piped stdout & stderr
    let mut command = Command::new(&validated_java_path);
    command
        .args(&args)
        .current_dir(&game_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Error al ejecutar el proceso de Java: {}", e))?;

    let pid = child.id();
    println!("[ProcessManager] Game process spawned successfully. PID: {}", pid);

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store active process
    {
        let mut lock = process_lock.lock().map_err(|e| e.to_string())?;
        *lock = Some(child);
    }

    // Emit event: game-started
    let _ = app_handle.emit("game-started", pid);

    // 3. Stream STDOUT in a background thread
    if let Some(stdout) = stdout {
        let app = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let level = if line.contains("[ERROR]")
                    || line.contains(" Exception")
                    || line.contains("FATAL")
                    || line.contains("Crash")
                {
                    "ERROR"
                } else if line.contains("[WARN]") {
                    "WARN"
                } else if line.contains("[DEBUG]") {
                    "DEBUG"
                } else {
                    "INFO"
                };

                let _ = app.emit(
                    "game-log",
                    GameLogPayload {
                        line,
                        level: level.to_string(),
                    },
                );
            }
        });
    }

    // 4. Stream STDERR in a background thread
    if let Some(stderr) = stderr {
        let app = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = app.emit(
                    "game-log",
                    GameLogPayload {
                        line,
                        level: "ERROR".to_string(),
                    },
                );
            }
        });
    }

    // 5. Monitor process termination in a background thread
    let app = app_handle.clone();
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_millis(500));
            let process_lock = get_game_process_handle();
            let mut lock = match process_lock.lock() {
                Ok(guard) => guard,
                Err(_) => break,
            };

            if let Some(ref mut child) = *lock {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let exit_code = status.code();
                        let success = status.success();
                        println!(
                            "[ProcessManager] Game process terminated. PID: {}, ExitCode: {:?}, Success: {}",
                            pid, exit_code, success
                        );
                        *lock = None;
                        let _ = app.emit(
                            "game-stopped",
                            GameStoppedPayload {
                                exit_code,
                                success,
                            },
                        );
                        break;
                    }
                    Ok(None) => continue,
                    Err(e) => {
                        println!("[ProcessManager] Error checking process status: {}", e);
                        *lock = None;
                        let _ = app.emit(
                            "game-stopped",
                            GameStoppedPayload {
                                exit_code: None,
                                success: false,
                            },
                        );
                        break;
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(pid)
}

pub fn kill_minecraft_process() -> Result<bool, String> {
    let process_lock = get_game_process_handle();
    let mut lock = process_lock.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *lock {
        println!("[ProcessManager] Forcefully killing active game process PID: {}", child.id());
        let _ = child.kill();
        *lock = None;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn is_game_running() -> bool {
    let process_lock = get_game_process_handle();
    let mut lock = match process_lock.lock() {
        Ok(guard) => guard,
        Err(_) => return false,
    };
    if let Some(ref mut child) = *lock {
        match child.try_wait() {
            Ok(None) => true,
            _ => {
                *lock = None;
                false
            }
        }
    } else {
        false
    }
}
