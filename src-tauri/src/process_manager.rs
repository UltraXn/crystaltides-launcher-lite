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
static TIMER_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(target_os = "windows")]
mod winmm {
    #[link(name = "winmm")]
    extern "system" {
        pub fn timeBeginPeriod(uPeriod: u32) -> u32;
        pub fn timeEndPeriod(uPeriod: u32) -> u32;
    }
}

#[allow(unsafe_code)]
pub fn set_high_resolution_timer(enable: bool) {
    #[cfg(target_os = "windows")]
    unsafe {
        use std::sync::atomic::Ordering;
        if enable {
            if !TIMER_ACTIVE.swap(true, Ordering::SeqCst) {
                winmm::timeBeginPeriod(1);
                crate::logger::log("INFO", "ProcessManager", "Windows high-resolution timer (1ms) enabled.");
            }
        } else if TIMER_ACTIVE.swap(false, Ordering::SeqCst) {
            winmm::timeEndPeriod(1);
            crate::logger::log("INFO", "ProcessManager", "Windows high-resolution timer restored.");
        }
    }
}

fn get_game_process_handle() -> &'static Arc<Mutex<Option<Child>>> {
    GAME_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)))
}

pub fn validate_java_binary(path_str: &str) -> Result<std::path::PathBuf, String> {
    let mut candidate = std::path::PathBuf::from(path_str);

    // 1. If candidate does not exist directly, try finding it in ~/.crystaltides/runtimes
    if !candidate.exists() {
        if let Some(home) = dirs::home_dir() {
            let ct_runtimes = home.join(".crystaltides").join("runtimes");
            if let Some(found) = crate::java_manager::find_java_binary(&ct_runtimes) {
                candidate = found;
            }
        }
    }

    // 2. If still does not exist, search in system PATH
    if !candidate.exists() {
        if let Some(paths) = std::env::var_os("PATH") {
            for p in std::env::split_paths(&paths) {
                let full = p.join(path_str);
                if full.exists() {
                    candidate = full;
                    break;
                }
                #[cfg(target_os = "windows")]
                {
                    let full_exe = p.join(format!("{}.exe", path_str));
                    if full_exe.exists() {
                        candidate = full_exe;
                        break;
                    }
                }
            }
        }
    }

    if !candidate.exists() {
        return Err(format!("No existe el ejecutable Java especificado: {}", path_str));
    }

    let canonical = candidate
        .canonicalize()
        .map_err(|e| format!("No se pudo resolver la ruta canónica del ejecutable Java: {}", e))?;

    // On Windows, strip verbatim prefix \\?\ to prevent CreateProcess issues
    #[cfg(target_os = "windows")]
    let canonical = {
        let s = canonical.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            std::path::PathBuf::from(stripped)
        } else {
            canonical
        }
    };

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

    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!("Iniciando Minecraft con Java: {:?} (Argumentos: {})", validated_java_path, args.len()),
    );

    // 2. Spawn Child Process with piped stdout & stderr
    let mut command = Command::new(&validated_java_path);
    command
        .args(&args)
        .current_dir(&game_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // 2. Inject high-performance driver environment variables
    command.env("__GL_THREADED_OPTIMIZATIONS", "1");
    command.env("SHIM_MCCOMPAT", "0");
    #[cfg(target_os = "linux")]
    command.env("mesa_glthread", "true");

    let mut child = command
        .spawn()
        .map_err(|e| {
            let err_msg = format!("Error al ejecutar el proceso de Java: {}", e);
            crate::logger::log("ERROR", "ProcessManager", &err_msg);
            err_msg
        })?;

    let pid = child.id();
    crate::logger::log("INFO", "ProcessManager", &format!("Proceso de Minecraft iniciado exitosamente. PID: {}", pid));

    // 3. Apply low-level OS process optimizations (CPU Affinity, High Priority, No EcoQoS, 1ms Timer)
    apply_os_optimizations(pid);
    set_high_resolution_timer(true);

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store active process
    {
        let mut lock = process_lock.lock().map_err(|e| e.to_string())?;
        *lock = Some(child);
    }

    // Emit event: game-started
    let _ = app_handle.emit("game-started", pid);

    // 3. Stream STDOUT in a background thread and write to log file
    if let Some(stdout) = stdout {
        let app = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
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

                crate::logger::log_minecraft(&line, level);

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

    // 4. Stream STDERR in a background thread and write to log file
    if let Some(stderr) = stderr {
        let app = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                crate::logger::log_minecraft(&line, "ERROR");

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
                        crate::logger::log(
                            if success { "INFO" } else { "ERROR" },
                            "ProcessManager",
                            &format!(
                                "Proceso de Minecraft finalizado. PID: {}, Código de salida: {:?}, Éxito: {}",
                                pid, exit_code, success
                            ),
                        );
                        *lock = None;
                        set_high_resolution_timer(false);
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
                        set_high_resolution_timer(false);
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
                set_high_resolution_timer(false);
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
        set_high_resolution_timer(false);
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
                set_high_resolution_timer(false);
                false
            }
        }
    } else {
        false
    }
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
pub fn apply_os_optimizations(pid: u32) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, SetPriorityClass, SetProcessAffinityMask,
        HIGH_PRIORITY_CLASS, PROCESS_SET_INFORMATION, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use crate::hardware::detect_hardware_profile;

    unsafe {
        let desired_access = PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION;
        if let Ok(handle) = OpenProcess(desired_access, false, pid) {
            // 1. Assign High Priority Class to javaw.exe
            let prio_res = SetPriorityClass(handle, HIGH_PRIORITY_CLASS);
            crate::logger::log(
                "INFO",
                "ProcessManager",
                &format!("Applied HIGH_PRIORITY_CLASS to PID {}: {:?}", pid, prio_res.is_ok()),
            );

            // 2. CPU Affinity (P-cores for Intel Hybrid, CCD0 for AMD Ryzen Dual-CCD X3D)
            let hw = detect_hardware_profile();
            if hw.recommended_affinity_mask > 0 {
                let mask = hw.recommended_affinity_mask as usize;
                let aff_res = SetProcessAffinityMask(handle, mask);
                crate::logger::log(
                    "INFO",
                    "ProcessManager",
                    &format!("Applied CPU Affinity Mask 0x{:X} to PID {}: {:?}", mask, pid, aff_res.is_ok()),
                );
            }

            // 3. Disable Windows 11 EcoQoS (PowerThrottling)
            disable_windows_power_throttling(handle);

            let _ = CloseHandle(handle);
        } else {
            crate::logger::log(
                "WARN",
                "ProcessManager",
                &format!("Warning: Failed to OpenProcess for optimization on PID {}", pid),
            );
        }
    }
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct ProcessPowerThrottlingState {
    version: u32,
    control_mask: u32,
    state_mask: u32,
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
fn disable_windows_power_throttling(handle: windows::Win32::Foundation::HANDLE) {
    #[link(name = "kernel32")]
    extern "system" {
        fn SetProcessInformation(
            hProcess: windows::Win32::Foundation::HANDLE,
            ProcessInformationClass: i32,
            ProcessInformation: *const std::ffi::c_void,
            ProcessInformationSize: u32,
        ) -> windows::Win32::Foundation::BOOL;
    }

    let state = ProcessPowerThrottlingState {
        version: 1, // PROCESS_POWER_THROTTLING_CURRENT_VERSION
        control_mask: 0x1, // PROCESS_POWER_THROTTLING_EXECUTION_SPEED
        state_mask: 0, // 0 = Turn off throttling / EcoQoS
    };

    let ok = unsafe {
        SetProcessInformation(
            handle,
            4, // ProcessPowerThrottling
            &state as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<ProcessPowerThrottlingState>() as u32,
        )
    };
    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!("Disabled Windows PowerThrottling (EcoQoS): {:?}", ok.as_bool()),
    );
}

#[cfg(not(target_os = "windows"))]
pub fn apply_os_optimizations(pid: u32) {
    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!("OS process optimizations not applicable on this platform for PID: {}", pid),
    );
}

