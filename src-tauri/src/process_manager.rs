use std::io::{BufRead, BufReader};
use std::path::Path;
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
pub struct GameLogBatchPayload {
    pub lines: Vec<GameLogPayload>,
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
                crate::logger::log(
                    "INFO",
                    "ProcessManager",
                    "Windows high-resolution timer (1ms) enabled.",
                );
            }
        } else if TIMER_ACTIVE.swap(false, Ordering::SeqCst) {
            winmm::timeEndPeriod(1);
            crate::logger::log(
                "INFO",
                "ProcessManager",
                "Windows high-resolution timer restored.",
            );
        }
    }
}

fn get_game_process_handle() -> &'static Arc<Mutex<Option<Child>>> {
    GAME_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)))
}

#[cfg(target_os = "windows")]
#[derive(Debug)]
pub struct ProcessJobGuard {
    job_handle: isize,
}

#[cfg(target_os = "windows")]
impl ProcessJobGuard {
    #[allow(unsafe_code)]
    pub fn new() -> Option<Self> {
        use windows::Win32::System::JobObjects::{
            CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };
        // SAFETY: Crea un nuevo Job Object de Windows para encapsular el árbol de procesos de Minecraft.
        // Si el launcher termina inesperadamente, Windows liquida automáticamente todos los procesos del Job.
        unsafe {
            let job = CreateJobObjectW(None, None).ok()?;
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let res = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if res.is_err() {
                let _ = windows::Win32::Foundation::CloseHandle(job);
                return None;
            }
            Some(Self {
                job_handle: job.0 as isize,
            })
        }
    }

    #[allow(unsafe_code)]
    pub fn assign_process(&self, process_handle: windows::Win32::Foundation::HANDLE) -> bool {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::JobObjects::AssignProcessToJobObject;
        // SAFETY: Asigna el proceso hijo al Job Object activo.
        unsafe {
            AssignProcessToJobObject(HANDLE(self.job_handle as *mut _), process_handle).is_ok()
        }
    }

    #[allow(unsafe_code)]
    pub fn terminate(&self, exit_code: u32) -> bool {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::JobObjects::TerminateJobObject;
        // SAFETY: Termina atómicamente todos los procesos del árbol asignado al Job Object.
        unsafe { TerminateJobObject(HANDLE(self.job_handle as *mut _), exit_code).is_ok() }
    }
}

#[cfg(target_os = "windows")]
impl Drop for ProcessJobGuard {
    #[allow(unsafe_code)]
    fn drop(&mut self) {
        use windows::Win32::Foundation::{CloseHandle, HANDLE};
        // SAFETY: Cierra el handle de Job Object al liberarse la guardia.
        unsafe {
            let _ = CloseHandle(HANDLE(self.job_handle as *mut _));
        }
    }
}

#[cfg(target_os = "windows")]
static GAME_JOB_GUARD: std::sync::OnceLock<Arc<Mutex<Option<ProcessJobGuard>>>> =
    std::sync::OnceLock::new();

#[cfg(target_os = "windows")]
fn get_game_job_guard() -> &'static Arc<Mutex<Option<ProcessJobGuard>>> {
    GAME_JOB_GUARD.get_or_init(|| Arc::new(Mutex::new(None)))
}

pub fn find_java_pid_under_wrapper(wrapper_pid: u32) -> u32 {
    use sysinfo::{Pid, ProcessesToUpdate, System};
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let target_parent = Pid::from_u32(wrapper_pid);
    for (pid, process) in sys.processes() {
        if process.parent() == Some(target_parent) {
            let name = process.name().to_string_lossy().to_lowercase();
            if name.contains("java") {
                return pid.as_u32();
            }
        }
    }
    wrapper_pid
}

fn resolve_candidate_path(path_str: &str) -> Option<std::path::PathBuf> {
    let candidate = std::path::PathBuf::from(path_str);
    if candidate.exists() {
        return Some(candidate);
    }

    crate::java_manager::resolve(Some(path_str), None).ok()
}

fn check_java_file_name(canonical: &std::path::Path) -> Result<(), String> {
    let file_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.to_lowercase())
        .ok_or_else(|| "Ruta de ejecutable inválida.".to_string())?;

    let is_valid = if cfg!(target_os = "windows") {
        file_name == "java.exe" || file_name == "javaw.exe"
    } else {
        file_name == "java" || file_name == "javaw"
    };

    // Evita lanzar por error otro programa como "Java". No es una barrera de seguridad: cualquier
    // archivo con este nombre pasa, y los argumentos de la JVM ya permiten ejecutar código.
    if !is_valid {
        return Err(format!(
            "Ejecutable Java no válido: '{}' no es java/javaw (java.exe / javaw.exe en Windows).",
            file_name
        ));
    }
    Ok(())
}

pub fn validate_java_binary(path_str: &str) -> Result<std::path::PathBuf, String> {
    let candidate = resolve_candidate_path(path_str)
        .ok_or_else(|| format!("No existe el ejecutable Java especificado: {}", path_str))?;

    let canonical = candidate.canonicalize().map_err(|e| {
        format!(
            "No se pudo resolver la ruta canónica del ejecutable Java: {}",
            e
        )
    })?;

    #[cfg(target_os = "windows")]
    let canonical = {
        let s = canonical.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            std::path::PathBuf::from(stripped)
        } else {
            canonical
        }
    };

    check_java_file_name(&canonical)?;
    Ok(canonical)
}

fn split_command_line(cmd: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';
    let mut chars = cmd.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                // Preservar escapes ante comillas o barras invertidas
                if let Some(&next) = chars.peek() {
                    if (next == '"' || next == '\'' || next == '\\') && chars.next().is_some() {
                        current.push(next);
                        continue;
                    }
                }
                current.push('\\');
            }
            '"' | '\'' if !in_quotes => {
                in_quotes = true;
                quote_char = c;
            }
            c if in_quotes && c == quote_char => {
                in_quotes = false;
            }
            ' ' | '\t' if !in_quotes => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            _ => {
                current.push(c);
            }
        }
    }
    if !current.is_empty() {
        args.push(current);
    }
    args
}

fn check_running_instance(process_lock: &Arc<Mutex<Option<Child>>>) -> Result<(), String> {
    let mut lock = process_lock.lock().unwrap_or_else(|e| {
        crate::logger::log(
            "WARN",
            "ProcessManager",
            &format!("Mutex envenenado, recuperando lock... {}", e),
        );
        e.into_inner()
    });
    if let Some(ref mut child) = *lock {
        if let Ok(None) = child.try_wait() {
            return Err("Ya existe una instancia de Minecraft en ejecución.".to_string());
        }
    }
    Ok(())
}

/// Shells, intérpretes de scripts y descargadores que no se aceptan como hook ni wrapper.
///
/// Evita el uso más obvio (pegar un one-liner de shell o `curl | sh`), pero NO es una barrera de
/// seguridad: los hooks ejecutan el programa que configure el usuario, y cualquier otro intérprete
/// o una copia renombrada pasa. La frontera real es que solo el bundle local controla el webview
/// (CSP y capabilities, ver `src/config/__tests__/tauriSecurity.test.ts`).
fn is_blocked_shell_binary(name: &str) -> bool {
    let lower = name.to_lowercase();
    let path = Path::new(&lower);
    let base = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(lower.as_str());
    matches!(
        base,
        "cmd"
            | "powershell"
            | "pwsh"
            | "sh"
            | "bash"
            | "zsh"
            | "dash"
            | "ksh"
            | "cscript"
            | "wscript"
            | "mshta"
            | "curl"
            | "wget"
    )
}

fn execute_hook_command(cmd_str: &str, dir: &str, envs: &[(&str, &str)]) -> Result<(), String> {
    let parts = split_command_line(cmd_str);
    if parts.is_empty() {
        return Ok(());
    }

    let program = &parts[0];
    if is_blocked_shell_binary(program) {
        let msg = format!(
            "Hook no permitido: '{}' es un shell o descargador; indica directamente el programa a ejecutar.",
            program
        );
        crate::logger::log("ERROR", "ProcessManager", &msg);
        return Err(msg);
    }

    let mut proc = Command::new(program);
    if parts.len() > 1 {
        proc.args(&parts[1..]);
    }

    proc.current_dir(dir);
    for (k, v) in envs {
        proc.env(k, v);
    }

    let mut child = proc
        .spawn()
        .map_err(|e| format!("Error ejecutando hook '{}': {}", program, e))?;

    let timeout = Duration::from_secs(10);
    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(format!(
                        "Comando hook falló con código de salida {:?}",
                        status.code()
                    ));
                }
                return Ok(());
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    return Err(format!("Hook '{}' abortado por timeout (10s)", program));
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("Error esperando hook '{}': {}", program, e)),
        }
    }
}

fn execute_pre_launch_hook(pre_cmd_raw: &str, game_dir: &str) -> Result<(), String> {
    let pre_cmd = pre_cmd_raw.trim();
    if pre_cmd.is_empty() {
        return Ok(());
    }
    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!("Ejecutando comando hook pre-launch: {}", pre_cmd),
    );
    execute_hook_command(pre_cmd, game_dir, &[]).map_err(|e| {
        let msg = format!("Error al ejecutar comando hook pre-launch: {}", e);
        crate::logger::log("ERROR", "ProcessManager", &msg);
        msg
    })
}

fn build_command_with_wrapper(
    validated_java_path: &std::path::Path,
    args: &[String],
    wrapper_command: Option<&str>,
) -> Command {
    if let Some(wrapper_raw) = wrapper_command {
        let wrapper_trimmed = wrapper_raw.trim();
        if !wrapper_trimmed.is_empty() {
            let parts = split_command_line(wrapper_trimmed);
            if !parts.is_empty() {
                let program = &parts[0];
                if is_blocked_shell_binary(program) {
                    crate::logger::log(
                        "WARN",
                        "ProcessManager",
                        &format!(
                            "Wrapper no permitido (shell o descargador), se lanza Java sin él: {}",
                            program
                        ),
                    );
                } else {
                    crate::logger::log(
                        "INFO",
                        "ProcessManager",
                        &format!("Envolviendo proceso de Java con wrapper: {:?}", parts),
                    );
                    let mut cmd = Command::new(program);
                    if parts.len() > 1 {
                        cmd.args(&parts[1..]);
                    }
                    cmd.arg(validated_java_path.to_string_lossy().to_string());
                    cmd.args(args);
                    return cmd;
                }
            }
        }
    }
    let mut cmd = Command::new(validated_java_path);
    cmd.args(args);
    cmd
}

/// Variables de entorno de perfil que no se pasan al proceso de Java: las que inyectan opciones
/// en la JVM o cambian qué librerías carga el cargador dinámico (todas las `LD_*` de glibc y
/// `DYLD_*` de macOS, incluidas `LD_AUDIT` y `DYLD_LIBRARY_PATH`).
///
/// Como `is_blocked_shell_binary`, evita configuraciones peligrosas obvias, pero no es una
/// barrera de seguridad: los argumentos de la JVM los controla igualmente el frontend.
fn is_blocked_env_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "java_tool_options" | "_java_options" | "jdk_java_options"
    ) || lower.starts_with("ld_")
        || lower.starts_with("dyld_")
}

pub fn is_dangerous_jvm_arg(arg: &str) -> bool {
    let clean = arg
        .trim()
        .trim_start_matches(['-', '/'])
        .to_ascii_lowercase();

    if clean.starts_with("agentpath") {
        let path_part = clean
            .strip_prefix("agentpath:")
            .or_else(|| clean.strip_prefix("agentpath="))
            .unwrap_or("");
        let path_without_opts = path_part.split('=').next().unwrap_or(path_part);

        let is_official_ct_agent = (path_without_opts.ends_with("ct-agent.dll")
            || path_without_opts.ends_with("ct-agent.so")
            || path_without_opts.ends_with("libct-agent.so"))
            && (path_without_opts.contains("natives")
                || path_without_opts.contains(".crystaltides"));
        return !is_official_ct_agent;
    }

    clean.starts_with("agentlib")
        || clean.starts_with("xrun")
        || clean.starts_with("xx:onerror")
        || clean.starts_with("xx:onoutofmemoryerror")
        || clean.starts_with("djava.security.policy")
        || clean.starts_with("djava.security.manager")
}

fn inject_json_env(command: &mut Command, json_str: &str) {
    if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, String>>(json_str) {
        for (k, v) in map {
            if !is_blocked_env_key(&k) {
                command.env(k, v);
            } else {
                crate::logger::log(
                    "WARN",
                    "ProcessManager",
                    &format!(
                        "Variable de entorno no autorizada bloqueada por seguridad: {}",
                        k
                    ),
                );
            }
        }
    }
}

fn inject_dotenv_line(command: &mut Command, line: &str) {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return;
    }
    if let Some((k, v)) = line.split_once('=') {
        let key = k.trim();
        if !is_blocked_env_key(key) {
            command.env(key, v.trim());
        } else {
            crate::logger::log(
                "WARN",
                "ProcessManager",
                &format!(
                    "Variable de entorno no autorizada bloqueada por seguridad: {}",
                    key
                ),
            );
        }
    }
}

fn inject_environment_variables(command: &mut Command, env_raw: Option<&str>) {
    command.env("__GL_THREADED_OPTIMIZATIONS", "1");
    command.env("SHIM_MCCOMPAT", "0");
    #[cfg(target_os = "linux")]
    {
        command.env("mesa_glthread", "true");
        command.env("__NV_PRIME_RENDER_OFFLOAD", "1");
        command.env("__GLX_VENDOR_LIBRARY_NAME", "nvidia");
        command.env("DRI_PRIME", "1");
    }

    let Some(raw) = env_raw else { return };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return;
    }

    if trimmed.starts_with('{') {
        inject_json_env(command, trimmed);
    } else {
        for line in trimmed.lines() {
            inject_dotenv_line(command, line);
        }
    }
}

fn flush_log_batch(app: &AppHandle, batch: &mut Vec<GameLogPayload>) {
    if batch.is_empty() {
        return;
    }
    let lines = std::mem::take(batch);
    if lines.len() <= 5 {
        for item in &lines {
            let _ = app.emit("game-log", item);
        }
    }
    let _ = app.emit("game-log-batch", GameLogBatchPayload { lines });
}

fn spawn_log_batcher(app: AppHandle, rx: std::sync::mpsc::Receiver<GameLogPayload>) {
    thread::spawn(move || {
        let mut batch = Vec::with_capacity(200);
        let mut last_flush = std::time::Instant::now();

        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(payload) => {
                    batch.push(payload);
                    if batch.len() >= 200 || last_flush.elapsed() >= Duration::from_millis(100) {
                        flush_log_batch(&app, &mut batch);
                        last_flush = std::time::Instant::now();
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    if !batch.is_empty() {
                        flush_log_batch(&app, &mut batch);
                        last_flush = std::time::Instant::now();
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    if !batch.is_empty() {
                        flush_log_batch(&app, &mut batch);
                    }
                    break;
                }
            }
        }
    });
}

/// Segundos sin salida de log, tras el `Stopping!` del cliente, antes de forzar el cierre.
/// Se cuenta desde la última línea y no desde la señal: el servidor integrado sigue guardando
/// el mundo después de `Stopping!` y mientras escriba log no se considera zombi.
const SHUTDOWN_IDLE_GRACE: Duration = Duration::from_secs(20);

/// `true` solo para el `Stopping!` que emite el propio cliente al cerrarse
/// (`[hh:mm:ss] [Render thread/INFO]: Stopping!`, o con `[minecraft/Minecraft]` en Forge/NeoForge).
/// El mensaje debe ser exactamente `Stopping!` tras el primer `]: `, así que una línea de chat
/// (`...]: [System] [CHAT] <x> Stopping!`) nunca coincide.
fn is_client_shutdown_line(line: &str) -> bool {
    let Some(idx) = line.find("]: ") else {
        return false;
    };
    let (header, message) = (&line[..idx], &line[idx + 3..]);
    header.contains("/INFO") && message.trim_end() == "Stopping!"
}

/// Arma la señal con el `Stopping!` del cliente y, una vez armada, la renueva con cada línea
/// para que el periodo de gracia se mida en inactividad.
fn record_shutdown_activity(shutdown_signal: &Mutex<Option<std::time::Instant>>, line: &str) {
    let Ok(mut sig) = shutdown_signal.lock() else {
        return;
    };
    if sig.is_some() {
        *sig = Some(std::time::Instant::now());
    } else if is_client_shutdown_line(line) {
        *sig = Some(std::time::Instant::now());
        crate::logger::log(
            "INFO",
            "ProcessManager",
            "Detectada señal de parada de Minecraft ('Stopping!'). Se forzará el cierre si el proceso sigue vivo tras 20s sin actividad de log.",
        );
    }
}

fn spawn_stdout_streamer(
    tx: std::sync::mpsc::Sender<GameLogPayload>,
    stdout: std::process::ChildStdout,
    shutdown_signal: Arc<Mutex<Option<std::time::Instant>>>,
) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buffer = Vec::new();
        while let Ok(bytes_read) = reader.read_until(b'\n', &mut buffer) {
            if bytes_read == 0 {
                break;
            }
            let raw_str = String::from_utf8_lossy(&buffer);
            let line = raw_str.trim_end_matches(&['\r', '\n'][..]).to_string();
            buffer.clear();
            if line.is_empty() {
                continue;
            }

            record_shutdown_activity(&shutdown_signal, &line);

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
            let _ = tx.send(GameLogPayload {
                line,
                level: level.to_string(),
            });
        }
    });
}

fn spawn_stderr_streamer(
    tx: std::sync::mpsc::Sender<GameLogPayload>,
    stderr: std::process::ChildStderr,
    shutdown_signal: Arc<Mutex<Option<std::time::Instant>>>,
) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = Vec::new();
        while let Ok(bytes_read) = reader.read_until(b'\n', &mut buffer) {
            if bytes_read == 0 {
                break;
            }
            let raw_str = String::from_utf8_lossy(&buffer);
            let line = raw_str.trim_end_matches(&['\r', '\n'][..]).to_string();
            buffer.clear();
            if line.is_empty() {
                continue;
            }

            record_shutdown_activity(&shutdown_signal, &line);

            crate::logger::log_minecraft(&line, "ERROR");
            let _ = tx.send(GameLogPayload {
                line,
                level: "ERROR".to_string(),
            });
        }
    });
}

fn handle_post_exit_command(
    post_cmd_raw: &str,
    game_dir: &str,
    pid: u32,
    exit_code: Option<i32>,
    success: bool,
) {
    let post_cmd = post_cmd_raw.trim();
    if post_cmd.is_empty() {
        return;
    }
    let exit_code_str = exit_code
        .map(|c| c.to_string())
        .unwrap_or_else(|| "-1".to_string());
    let success_str = if success { "1" } else { "0" };
    let pid_str = pid.to_string();
    let envs = [
        ("MC_PID", pid_str.as_str()),
        ("MC_EXIT_CODE", exit_code_str.as_str()),
        ("MC_SUCCESS", success_str),
    ];
    let _ = execute_hook_command(post_cmd, game_dir, &envs);
}

fn notify_game_stopped(
    app_handle: &AppHandle,
    pid: u32,
    exit_code: Option<i32>,
    success: bool,
    post_exit_cmd: Option<&str>,
    game_dir: &str,
) {
    crate::logger::log(
        if success { "INFO" } else { "ERROR" },
        "ProcessManager",
        &format!(
            "Proceso de Minecraft finalizado. PID: {}, Código de salida: {:?}, Éxito: {}",
            pid, exit_code, success
        ),
    );
    set_high_resolution_timer(false);
    crate::agent::reset_live_metrics();
    #[cfg(target_os = "windows")]
    {
        if let Ok(mut job_lock) = get_game_job_guard().lock() {
            *job_lock = None;
        }
    }

    if let Some(post_cmd) = post_exit_cmd {
        handle_post_exit_command(post_cmd, game_dir, pid, exit_code, success);
    }

    let _ = app_handle.emit("game-stopped", GameStoppedPayload { exit_code, success });
}

fn handle_child_exit(
    app_handle: &AppHandle,
    pid: u32,
    status: std::process::ExitStatus,
    post_exit_cmd: Option<&str>,
    game_dir: &str,
) {
    notify_game_stopped(
        app_handle,
        pid,
        status.code(),
        status.success(),
        post_exit_cmd,
        game_dir,
    );
}

fn handle_child_error(app_handle: &AppHandle, err: std::io::Error) {
    println!("[ProcessManager] Error checking process status: {}", err);
    set_high_resolution_timer(false);
    crate::agent::reset_live_metrics();
    #[cfg(target_os = "windows")]
    {
        if let Ok(mut job_lock) = get_game_job_guard().lock() {
            *job_lock = None;
        }
    }
    let _ = app_handle.emit(
        "game-stopped",
        GameStoppedPayload {
            exit_code: None,
            success: false,
        },
    );
}

enum PollResult {
    Exited,
    Running,
    Stop,
}

fn poll_child_status(
    app_handle: &AppHandle,
    pid: u32,
    post_exit_cmd: Option<&str>,
    game_dir: &str,
    shutdown_signal: &Arc<Mutex<Option<std::time::Instant>>>,
) -> PollResult {
    let process_lock = get_game_process_handle();
    let mut lock = process_lock.lock().unwrap_or_else(|e| {
        crate::logger::log(
            "WARN",
            "ProcessManager",
            &format!("Mutex envenenado, recuperando lock... {}", e),
        );
        e.into_inner()
    });

    let Some(ref mut child) = *lock else {
        set_high_resolution_timer(false);
        return PollResult::Stop;
    };

    match child.try_wait() {
        Ok(Some(status)) => {
            *lock = None;
            drop(lock);
            handle_child_exit(app_handle, pid, status, post_exit_cmd, game_dir);
            PollResult::Exited
        }
        Ok(None) => {
            let should_kill_zombie = shutdown_signal
                .lock()
                .ok()
                .and_then(|sig| *sig)
                .is_some_and(|last_activity| last_activity.elapsed() >= SHUTDOWN_IDLE_GRACE);

            if should_kill_zombie {
                crate::logger::log(
                    "WARN",
                    "ProcessManager",
                    &format!(
                        "El proceso de Minecraft (PID: {}) sigue vivo tras cerrarse el cliente y 20s sin actividad de log (hilos zombi de mods). Forzando cierre...",
                        pid
                    ),
                );
                let _ = child.kill();
                let exit_code = child.wait().ok().and_then(|s| s.code());
                *lock = None;
                drop(lock);

                // El usuario ya cerró el juego: se notifica como cierre correcto para no abrir
                // el modal de crash por el código de salida que deja el kill.
                notify_game_stopped(app_handle, pid, exit_code, true, post_exit_cmd, game_dir);
                PollResult::Exited
            } else {
                PollResult::Running
            }
        }
        Err(e) => {
            *lock = None;
            drop(lock);
            handle_child_error(app_handle, e);
            PollResult::Exited
        }
    }
}

fn spawn_process_monitor(
    app_handle: AppHandle,
    pid: u32,
    post_exit_cmd: Option<String>,
    game_dir: String,
    shutdown_signal: Arc<Mutex<Option<std::time::Instant>>>,
) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(500));
        match poll_child_status(
            &app_handle,
            pid,
            post_exit_cmd.as_deref(),
            &game_dir,
            &shutdown_signal,
        ) {
            PollResult::Running => continue,
            PollResult::Exited | PollResult::Stop => break,
        }
    });
}

#[allow(clippy::too_many_arguments)]
pub fn launch_minecraft_process(
    app_handle: AppHandle,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
    pre_launch_command: Option<String>,
    wrapper_command: Option<String>,
    post_exit_command: Option<String>,
    environment_variables: Option<String>,
) -> Result<u32, String> {
    let validated_java_path = validate_java_binary(&java_path)?;
    for arg in &args {
        if is_dangerous_jvm_arg(arg) {
            let err_msg = format!(
                "Argumento JVM no permitido por razones de seguridad: {}",
                arg
            );
            crate::logger::log("WARN", "ProcessManager", &err_msg);
            return Err(err_msg);
        }
    }
    enforce_high_performance_gpu(&validated_java_path);
    let process_lock = get_game_process_handle();

    check_running_instance(process_lock)?;

    if let Some(ref pre_cmd) = pre_launch_command {
        execute_pre_launch_hook(pre_cmd, &game_dir)?;
    }

    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!(
            "Iniciando Minecraft con Java: {:?} (Argumentos: {})",
            validated_java_path,
            args.len()
        ),
    );

    let mut command =
        build_command_with_wrapper(&validated_java_path, &args, wrapper_command.as_deref());
    command
        .current_dir(&game_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    inject_environment_variables(&mut command, environment_variables.as_deref());

    let mut child = command.spawn().map_err(|e| {
        let err_msg = format!("Error al ejecutar el proceso de Java: {}", e);
        crate::logger::log("ERROR", "ProcessManager", &err_msg);
        err_msg
    })?;

    let pid = child.id();
    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!("Proceso de Minecraft iniciado exitosamente. PID: {}", pid),
    );

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::io::AsRawHandle;
        if let Some(guard) = ProcessJobGuard::new() {
            let win_handle = windows::Win32::Foundation::HANDLE(child.as_raw_handle() as _);
            guard.assign_process(win_handle);
            if let Ok(mut job_lock) = get_game_job_guard().lock() {
                *job_lock = Some(guard);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if wrapper_command.is_some() {
            let wrapper_pid = pid;
            tauri::async_runtime::spawn(async move {
                for _ in 0..10 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                    let target_pid = find_java_pid_under_wrapper(wrapper_pid);
                    if target_pid != wrapper_pid {
                        apply_os_optimizations(target_pid);
                        return;
                    }
                }
                apply_os_optimizations(wrapper_pid);
            });
        } else {
            apply_os_optimizations(pid);
        }
    }
    set_high_resolution_timer(true);
    let app_for_ipc = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let _ = crate::agent::start_game_ipc_server(app_for_ipc).await;
    });

    let (log_tx, log_rx) = std::sync::mpsc::channel::<GameLogPayload>();
    spawn_log_batcher(app_handle.clone(), log_rx);

    let shutdown_signal = Arc::new(Mutex::new(None));

    if let Some(stdout) = child.stdout.take() {
        spawn_stdout_streamer(log_tx.clone(), stdout, shutdown_signal.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_stderr_streamer(log_tx, stderr, shutdown_signal.clone());
    }

    {
        let mut lock = process_lock.lock().unwrap_or_else(|e| {
            crate::logger::log(
                "WARN",
                "ProcessManager",
                &format!("Mutex envenenado, recuperando lock... {}", e),
            );
            e.into_inner()
        });
        *lock = Some(child);
    }

    let _ = app_handle.emit("game-started", pid);
    spawn_process_monitor(
        app_handle,
        pid,
        post_exit_command,
        game_dir,
        shutdown_signal,
    );

    Ok(pid)
}

pub fn kill_minecraft_process() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(mut job_lock) = get_game_job_guard().lock() {
            if let Some(ref guard) = *job_lock {
                guard.terminate(1);
            }
            *job_lock = None;
        }
    }

    let process_lock = get_game_process_handle();
    let mut lock = process_lock.lock().unwrap_or_else(|e| {
        crate::logger::log(
            "WARN",
            "ProcessManager",
            &format!("Mutex envenenado, recuperando lock... {}", e),
        );
        e.into_inner()
    });
    if let Some(ref mut child) = *lock {
        println!(
            "[ProcessManager] Forcefully killing active game process PID: {}",
            child.id()
        );
        let _ = child.kill();
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn is_game_running() -> bool {
    let process_lock = get_game_process_handle();
    let mut lock = process_lock.lock().unwrap_or_else(|e| {
        crate::logger::log(
            "WARN",
            "ProcessManager",
            &format!("Mutex envenenado, recuperando lock... {}", e),
        );
        e.into_inner()
    });
    lock.as_mut()
        .is_some_and(|child| matches!(child.try_wait(), Ok(None)))
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
pub fn apply_os_optimizations(pid: u32) {
    use crate::hardware::detect_hardware_profile_sync;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        GetProcessAffinityMask, OpenProcess, SetPriorityClass, SetProcessAffinityMask,
        HIGH_PRIORITY_CLASS, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION,
        PROCESS_SET_QUOTA,
    };

    unsafe {
        let desired_access =
            PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_QUOTA;
        if let Ok(handle) = OpenProcess(desired_access, false, pid) {
            // 1. Assign High Priority Class to javaw.exe
            let prio_res = SetPriorityClass(handle, HIGH_PRIORITY_CLASS);
            crate::logger::log(
                "INFO",
                "ProcessManager",
                &format!(
                    "Applied HIGH_PRIORITY_CLASS to PID {}: {:?}",
                    pid,
                    prio_res.is_ok()
                ),
            );

            // 2. CPU Affinity (P-cores for Intel Hybrid, CCD0 for AMD Ryzen Dual-CCD X3D)
            let hw = detect_hardware_profile_sync(None);
            if hw.recommended_affinity_mask > 0 {
                let mask = hw.recommended_affinity_mask as usize;
                let mut proc_mask: usize = 0;
                let mut sys_mask: usize = 0;
                let target_mask = if GetProcessAffinityMask(handle, &mut proc_mask, &mut sys_mask)
                    .is_ok()
                    && sys_mask > 0
                {
                    let valid = mask & sys_mask;
                    if valid > 0 {
                        valid
                    } else {
                        sys_mask
                    }
                } else {
                    mask
                };
                let aff_res = SetProcessAffinityMask(handle, target_mask);
                crate::logger::log(
                    "INFO",
                    "ProcessManager",
                    &format!(
                        "Applied CPU Affinity Mask 0x{:X} to PID {}: {:?}",
                        target_mask,
                        pid,
                        aff_res.is_ok()
                    ),
                );
            }

            // 3. Disable Windows 11 EcoQoS (PowerThrottling)
            disable_windows_power_throttling(handle);

            // 4. Prioritize Disk I/O (ProcessIoPriority = 3 / High) for faster chunk streaming
            set_process_high_io_priority(handle);

            // 5. Anti-Pagefile Working Set lock (SetProcessWorkingSetSizeEx)
            set_process_working_set_hard_min(handle);

            let _ = CloseHandle(handle);
        } else {
            crate::logger::log(
                "WARN",
                "ProcessManager",
                &format!(
                    "Warning: Failed to OpenProcess for optimization on PID {}",
                    pid
                ),
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
        version: 1,        // PROCESS_POWER_THROTTLING_CURRENT_VERSION
        control_mask: 0x1, // PROCESS_POWER_THROTTLING_EXECUTION_SPEED
        state_mask: 0,     // 0 = Turn off throttling / EcoQoS
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
        &format!(
            "Disabled Windows PowerThrottling (EcoQoS): {:?}",
            ok.as_bool()
        ),
    );
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
fn set_process_high_io_priority(handle: windows::Win32::Foundation::HANDLE) {
    #[link(name = "ntdll")]
    extern "system" {
        fn NtSetInformationProcess(
            ProcessHandle: windows::Win32::Foundation::HANDLE,
            ProcessInformationClass: u32,
            ProcessInformation: *const std::ffi::c_void,
            ProcessInformationLength: u32,
        ) -> i32;
    }

    // ProcessIoPriority = 0x21 (33 in decimal)
    const PROCESS_IO_PRIORITY: u32 = 0x21;
    // IO_PRIORITY_HINT::IoPriorityHigh = 3
    let io_priority: u32 = 3;

    let status = unsafe {
        NtSetInformationProcess(
            handle,
            PROCESS_IO_PRIORITY,
            &io_priority as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        )
    };
    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!(
            "Set High Disk I/O Priority (NtSetInformationProcess 0x21): status 0x{:08X}",
            status
        ),
    );
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
fn set_process_working_set_hard_min(handle: windows::Win32::Foundation::HANDLE) {
    #[link(name = "kernel32")]
    extern "system" {
        fn SetProcessWorkingSetSizeEx(
            hProcess: windows::Win32::Foundation::HANDLE,
            dwMinimumWorkingSetSize: usize,
            dwMaximumWorkingSetSize: usize,
            Flags: u32,
        ) -> windows::Win32::Foundation::BOOL;
    }

    // Flags: QUOTA_LIMITS_HARDWS_MIN_ENABLE (0x1) | QUOTA_LIMITS_HARDWS_MAX_DISABLE (0x8)
    const QUOTA_LIMITS_HARDWS_MIN_ENABLE: u32 = 0x00000001;
    const QUOTA_LIMITS_HARDWS_MAX_DISABLE: u32 = 0x00000008;

    // Minimum working set: 1024 MB (guarantees Java pages are prioritized in physical RAM)
    let min_size: usize = 1024 * 1024 * 1024;
    let max_size: usize = 8usize * 1024 * 1024 * 1024;

    let ok = unsafe {
        SetProcessWorkingSetSizeEx(
            handle,
            min_size,
            max_size,
            QUOTA_LIMITS_HARDWS_MIN_ENABLE | QUOTA_LIMITS_HARDWS_MAX_DISABLE,
        )
    };
    crate::logger::log(
        "INFO",
        "ProcessManager",
        &format!(
            "Locked working set in physical RAM (Anti-pagefile): {:?}",
            ok.as_bool()
        ),
    );
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
pub fn enforce_high_performance_gpu(java_path: &std::path::Path) {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, REG_SZ,
    };

    let canonical = match java_path.canonicalize() {
        Ok(p) => p,
        Err(_) => java_path.to_path_buf(),
    };

    let path_str = canonical.to_string_lossy();
    let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str);

    let subkey: Vec<u16> = "Software\\Microsoft\\DirectX\\UserGpuPreferences\0"
        .encode_utf16()
        .collect();
    let val_name: Vec<u16> = format!("{}\0", clean_path).encode_utf16().collect();
    let val_data: Vec<u16> = "GpuPreference=2;\0".encode_utf16().collect();

    unsafe {
        let mut hkey = HKEY::default();
        let res = RegCreateKeyW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()), &mut hkey);

        if res.is_ok() && !hkey.is_invalid() {
            let data_bytes = std::slice::from_raw_parts(
                val_data.as_ptr() as *const u8,
                val_data.len() * std::mem::size_of::<u16>(),
            );
            let set_res =
                RegSetValueExW(hkey, PCWSTR(val_name.as_ptr()), 0, REG_SZ, Some(data_bytes));
            if set_res.is_ok() {
                crate::logger::log(
                    "INFO",
                    "ProcessManager",
                    &format!(
                        "Forced High Performance GPU (GpuPreference=2) for: {}",
                        clean_path
                    ),
                );
            } else {
                crate::logger::log(
                    "WARN",
                    "ProcessManager",
                    &format!(
                        "Failed to set GpuPreference for {}: {:?}",
                        clean_path, set_res
                    ),
                );
            }
            let _ = RegCloseKey(hkey);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn enforce_high_performance_gpu(_java_path: &std::path::Path) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "Escribe claves reales en HKCU (UserGpuPreferences). Requiere aislamiento."]
    fn test_enforce_high_performance_gpu_smoke() {
        let dummy = std::path::PathBuf::from(r"C:\CrystalTides\fake_javaw.exe");
        enforce_high_performance_gpu(&dummy);
    }

    #[test]
    #[cfg(target_os = "windows")]
    #[ignore = "Modifica la prioridad de proceso y afinidad del runner de tests. Requiere aislamiento."]
    fn test_apply_os_optimizations_smoke() {
        apply_os_optimizations(std::process::id());
    }

    #[test]
    fn test_is_client_shutdown_line() {
        assert!(is_client_shutdown_line(
            "[12:00:01] [Render thread/INFO]: Stopping!"
        ));
        assert!(is_client_shutdown_line(
            "[12:00:01] [Render thread/INFO] [minecraft/Minecraft]: Stopping!\r"
        ));
        // Chat: un jugador escribiendo "Stopping!" no debe disparar el cierre forzado
        assert!(!is_client_shutdown_line(
            "[12:00:01] [Render thread/INFO]: [System] [CHAT] <Steve> Stopping!"
        ));
        assert!(!is_client_shutdown_line(
            "[12:00:01] [Render thread/INFO]: [CHAT] <Steve> ]: Stopping!"
        ));
        assert!(!is_client_shutdown_line(
            "[12:00:01] [Server thread/INFO]: Stopping server"
        ));
        assert!(!is_client_shutdown_line(
            "[12:00:01] [Render thread/WARN]: Stopping!"
        ));
        assert!(!is_client_shutdown_line("Stopping!"));
    }

    #[test]
    fn test_record_shutdown_activity_arms_and_refreshes() {
        let signal = Mutex::new(None);
        record_shutdown_activity(&signal, "[12:00:00] [Render thread/INFO]: Disconnecting");
        assert!(signal.lock().unwrap().is_none());

        record_shutdown_activity(&signal, "[12:00:01] [Render thread/INFO]: Stopping!");
        let armed_at = signal.lock().unwrap().expect("la señal debe armarse");

        thread::sleep(Duration::from_millis(5));
        record_shutdown_activity(&signal, "[12:00:02] [Server thread/INFO]: Saving worlds");
        let refreshed_at = signal.lock().unwrap().expect("la señal sigue armada");
        assert!(refreshed_at > armed_at);
    }

    #[test]
    fn test_is_blocked_shell_binary() {
        assert!(is_blocked_shell_binary("cmd.exe"));
        assert!(is_blocked_shell_binary("cmd"));
        assert!(is_blocked_shell_binary("powershell.exe"));
        assert!(is_blocked_shell_binary("pwsh.exe"));
        assert!(is_blocked_shell_binary("/bin/sh"));
        assert!(is_blocked_shell_binary("/usr/bin/bash"));
        assert!(is_blocked_shell_binary("zsh"));
        assert!(is_blocked_shell_binary("wscript.exe"));
        assert!(is_blocked_shell_binary("cscript.exe"));
        assert!(is_blocked_shell_binary("mshta.exe"));

        assert!(!is_blocked_shell_binary("mangohud"));
        assert!(!is_blocked_shell_binary("gamemoderun"));
        assert!(!is_blocked_shell_binary("optirun"));
        assert!(!is_blocked_shell_binary("my_custom_tool.exe"));
    }

    #[test]
    fn test_is_blocked_env_key() {
        assert!(is_blocked_env_key("JAVA_TOOL_OPTIONS"));
        assert!(is_blocked_env_key("_JAVA_OPTIONS"));
        assert!(is_blocked_env_key("jdk_java_options"));
        assert!(is_blocked_env_key("LD_PRELOAD"));
        assert!(is_blocked_env_key("ld_library_path"));
        assert!(is_blocked_env_key("DYLD_INSERT_LIBRARIES"));
        assert!(is_blocked_env_key("LD_AUDIT"));
        assert!(is_blocked_env_key("dyld_library_path"));
        assert!(is_blocked_env_key("DYLD_FRAMEWORK_PATH"));

        assert!(!is_blocked_env_key("MY_CUSTOM_VAR"));
        assert!(!is_blocked_env_key("OLD_VALUE"));
        assert!(!is_blocked_env_key("PATH"));
        assert!(!is_blocked_env_key("__GL_THREADED_OPTIMIZATIONS"));
    }

    #[test]
    fn test_split_command_line_robustness() {
        assert_eq!(split_command_line(""), Vec::<String>::new());
        assert_eq!(split_command_line("   "), Vec::<String>::new());
        assert_eq!(
            split_command_line("java -jar server.jar --port 25565"),
            vec!["java", "-jar", "server.jar", "--port", "25565"]
        );
        assert_eq!(
            split_command_line(
                "program \"C:\\Program Files\\Java\\bin\\java.exe\" 'arg with spaces'"
            ),
            vec![
                "program",
                "C:\\Program Files\\Java\\bin\\java.exe",
                "arg with spaces"
            ]
        );
        assert_eq!(
            split_command_line("wrapper --title \"Hello \\\"World\\\"\" --path \"C:\\\\escape\""),
            vec![
                "wrapper",
                "--title",
                "Hello \"World\"",
                "--path",
                "C:\\escape"
            ]
        );
        assert_eq!(
            split_command_line("multi \t\t spaced   tokens"),
            vec!["multi", "spaced", "tokens"]
        );
    }

    #[test]
    fn test_is_dangerous_jvm_arg() {
        assert!(is_dangerous_jvm_arg("-agentpath:/path/to/evil.dll"));
        assert!(is_dangerous_jvm_arg("-agentlib:jdwp"));
        assert!(is_dangerous_jvm_arg("-Xrunjdwp:transport=dt_socket"));
        assert!(is_dangerous_jvm_arg("-XX:OnError=\"cmd.exe /c calc\""));
        assert!(is_dangerous_jvm_arg("-XX:OnOutOfMemoryError=\"cmd.exe\""));
        assert!(is_dangerous_jvm_arg("-Djava.security.policy=some.policy"));
        assert!(is_dangerous_jvm_arg("-Djava.security.manager=allow"));
        assert!(is_dangerous_jvm_arg("/agentpath:evil.dll"));

        assert!(!is_dangerous_jvm_arg("-Xmx4G"));
        assert!(!is_dangerous_jvm_arg("-Xms2G"));
        assert!(!is_dangerous_jvm_arg("-XX:+UseG1GC"));
        assert!(!is_dangerous_jvm_arg(
            "-Dminecraft.launcher.brand=crystaltides"
        ));
        assert!(!is_dangerous_jvm_arg("-javaagent:fabric-loader.jar"));
        assert!(!is_dangerous_jvm_arg(
            "-agentpath:C:\\Users\\nacho\\.crystaltides\\instances\\inst-1\\natives\\ct-agent.dll"
        ));
        assert!(!is_dangerous_jvm_arg(
            "-agentpath:\\\\?\\C:\\Users\\nacho\\.crystaltides\\instances\\inst-1\\natives\\ct-agent.dll"
        ));
    }
}
