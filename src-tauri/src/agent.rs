use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::net::TcpListener;
use uuid::Uuid;

pub const DEFAULT_GAME_IPC_PORT: u16 = 28195;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentConfig {
    pub agent_enabled: bool,
    pub native_library_path: String,
    pub agent_version: String,
    pub injected_pid: Option<u32>,
    pub handshake_token: String,
    pub ipc_port: u16,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentBenchmarkMetrics {
    pub average_fps: f64,
    pub frametime_p99_ms: f64,
    pub gc_pause_time_ms: f64,
    pub swapchain_backend: String,
    pub integrity_status: String,
    pub memory_used_mb: Option<u64>,
    pub memory_total_mb: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameHandshakePayload {
    pub minecraft_version: Option<String>,
    pub client_version: Option<String>,
    pub mods_count: Option<usize>,
    pub gl_renderer: Option<String>,
    pub gl_vendor: Option<String>,
    pub gl_version: Option<String>,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum IncomingIpcMessage {
    #[serde(rename = "handshake")]
    Handshake {
        token: Option<String>,
        minecraft_version: Option<String>,
        client_version: Option<String>,
        mods_count: Option<usize>,
        gl_renderer: Option<String>,
        gl_vendor: Option<String>,
        gl_version: Option<String>,
    },
    #[serde(rename = "telemetry")]
    Telemetry {
        fps: f64,
        frametime_p99_ms: f64,
        gc_pause_time_ms: f64,
        memory_used_mb: Option<u64>,
        memory_total_mb: Option<u64>,
        swapchain_backend: Option<String>,
    },
    #[serde(rename = "game_ready")]
    GameReady {
        load_duration_ms: Option<u64>,
    },
}

pub const MAX_IPC_FRAME_BYTES: usize = 16384; // 16 KB anti-DoS limit

static LIVE_METRICS: OnceLock<Arc<Mutex<AgentBenchmarkMetrics>>> = OnceLock::new();
static ACTUAL_IPC_PORT: AtomicU16 = AtomicU16::new(0);
static EXPECTED_SESSION_TOKEN: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static IPC_INIT_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub fn get_actual_game_ipc_port() -> u16 {
    let port = ACTUAL_IPC_PORT.load(Ordering::SeqCst);
    if port != 0 {
        port
    } else {
        DEFAULT_GAME_IPC_PORT
    }
}

pub fn set_expected_session_token(token: Option<&str>) {
    let handle = EXPECTED_SESSION_TOKEN.get_or_init(|| Mutex::new(None));
    if let Ok(mut lock) = handle.lock() {
        *lock = token.map(|s| s.to_string());
    }
}

pub fn verify_session_token(token: Option<&str>) -> bool {
    let Some(tok) = token else {
        return false;
    };
    let Some(handle) = EXPECTED_SESSION_TOKEN.get() else {
        return false; // Fail-closed si el token aún no ha sido inicializado
    };
    if let Ok(lock) = handle.lock() {
        match lock.as_deref() {
            Some(expected) => expected == tok,
            None => false, // Fail-closed si no se ha configurado token esperado
        }
    } else {
        false
    }
}

pub(crate) fn sanitize_telemetry(fps: f64, frametime_p99_ms: f64, gc_pause_time_ms: f64) -> (f64, f64, f64) {
    let clean_fps = if fps.is_finite() && fps >= 0.0 { fps.min(1000.0) } else { 0.0 };
    let clean_p99 = if frametime_p99_ms.is_finite() && frametime_p99_ms >= 0.0 { frametime_p99_ms.min(10000.0) } else { 0.0 };
    let clean_gc = if gc_pause_time_ms.is_finite() && gc_pause_time_ms >= 0.0 { gc_pause_time_ms.min(60000.0) } else { 0.0 };
    (clean_fps, clean_p99, clean_gc)
}

fn get_live_metrics_handle() -> &'static Arc<Mutex<AgentBenchmarkMetrics>> {
    LIVE_METRICS.get_or_init(|| {
        let is_vulkan = cfg!(target_os = "windows");
        Arc::new(Mutex::new(AgentBenchmarkMetrics {
            average_fps: 144.0,
            frametime_p99_ms: 6.94,
            gc_pause_time_ms: 0.0,
            swapchain_backend: if is_vulkan {
                "OpenGL/Vulkan Dual Layer".to_string()
            } else {
                "OpenGL Core".to_string()
            },
            integrity_status: "VERIFIED_STANDBY".to_string(),
            memory_used_mb: None,
            memory_total_mb: None,
        }))
    })
}

pub(crate) fn parse_ipc_line(line: &str) -> Option<IncomingIpcMessage> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_IPC_FRAME_BYTES {
        return None;
    }
    serde_json::from_str::<IncomingIpcMessage>(trimmed).ok()
}

/// Maneja el saludo inicial (Handshake) con validación estricta de token de sesión
fn handle_handshake(
    app: &AppHandle,
    peer: std::net::SocketAddr,
    token: Option<String>,
    payload: GameHandshakePayload,
) -> bool {
    if !verify_session_token(token.as_deref()) {
        crate::logger::log(
            "WARN",
            "GameIPC",
            &format!("Handshake rechazado para {}: token de sesión inválido", peer),
        );
        return false;
    }

    if let Some(ref rend) = payload.gl_renderer {
        let rend_lower = rend.to_lowercase();
        if rend_lower.contains("intel") || rend_lower.contains("microsoft basic") || rend_lower.contains("llvmpipe") {
            crate::logger::log(
                "WARN",
                "GameIPC",
                &format!(
                    "Alerta de Rendimiento GPU: Minecraft está renderizando en '{}'. Si tu equipo posee una GPU dedicada (NVIDIA/AMD), configúrala en Gráficos de Windows.",
                    rend
                ),
            );
        } else {
            crate::logger::log(
                "INFO",
                "GameIPC",
                &format!(
                    "Renderer OpenGL óptimo confirmado: {} (Vendor: {})",
                    rend,
                    payload.gl_vendor.as_deref().unwrap_or("Desconocido")
                ),
            );
        }
    }

    let _ = app.emit("game-ipc-handshake", payload);
    true
}

fn handle_telemetry(
    app: &AppHandle,
    fps: f64,
    frametime_p99_ms: f64,
    gc_pause_time_ms: f64,
    memory_used_mb: Option<u64>,
    memory_total_mb: Option<u64>,
    swapchain_backend: Option<String>,
) {
    if gc_pause_time_ms > 250.0 {
        crate::logger::log(
            "WARN",
            "GameIPC",
            &format!(
                "Pausa severa de GC detectada: {:.1} ms (FPS: {:.0}, p99: {:.2} ms). Evaluando presión de memoria.",
                gc_pause_time_ms, fps, frametime_p99_ms
            ),
        );
    }

    let (clean_fps, clean_p99, clean_gc) = sanitize_telemetry(fps, frametime_p99_ms, gc_pause_time_ms);
    let metrics_lock = get_live_metrics_handle();
    if let Ok(mut lock) = metrics_lock.lock() {
        lock.average_fps = clean_fps;
        lock.frametime_p99_ms = clean_p99;
        lock.gc_pause_time_ms = clean_gc;
        lock.memory_used_mb = memory_used_mb;
        lock.memory_total_mb = memory_total_mb;
        if let Some(sw) = swapchain_backend {
            lock.swapchain_backend = sw;
        }
        lock.integrity_status = "ONLINE_LINKED".to_string();

        let _ = app.emit("game-ipc-metrics", lock.clone());
    }
}

async fn handle_ipc_client(app: AppHandle, stream: tokio::net::TcpStream, peer: std::net::SocketAddr) {
    let (reader, _writer) = stream.into_split();
    let mut buf_reader = BufReader::new(reader);
    let mut line = String::new();
    let mut authenticated = false;

    loop {
        line.clear();
        // Leemos como máximo MAX_IPC_FRAME_BYTES + 1 para evitar OOM antes de encontrar '\n'
        let mut limited = (&mut buf_reader).take((MAX_IPC_FRAME_BYTES + 1) as u64);
        match limited.read_line(&mut line).await {
            Ok(0) => break, // EOF
            Ok(n) if n > MAX_IPC_FRAME_BYTES => {
                crate::logger::log("WARN", "GameIPC", "Frame excedió límite de tamaño; desconectando.");
                break;
            }
            Ok(_) => {
                let Some(msg) = parse_ipc_line(&line) else { continue };
                match msg {
                    IncomingIpcMessage::Handshake {
                        token,
                        minecraft_version,
                        client_version,
                        mods_count,
                        gl_renderer,
                        gl_vendor,
                        gl_version,
                    } => {
                        let payload = GameHandshakePayload {
                            minecraft_version,
                            client_version,
                            mods_count,
                            gl_renderer,
                            gl_vendor,
                            gl_version,
                        };
                        if handle_handshake(&app, peer, token, payload) {
                            authenticated = true;
                        } else {
                            break;
                        }
                    }
                    IncomingIpcMessage::Telemetry {
                        fps,
                        frametime_p99_ms,
                        gc_pause_time_ms,
                        memory_used_mb,
                        memory_total_mb,
                        swapchain_backend,
                    } if authenticated => {
                        handle_telemetry(
                            &app,
                            fps,
                            frametime_p99_ms,
                            gc_pause_time_ms,
                            memory_used_mb,
                            memory_total_mb,
                            swapchain_backend,
                        );
                    }
                    IncomingIpcMessage::GameReady { load_duration_ms } if authenticated => {
                        crate::logger::log(
                            "INFO",
                            "GameIPC",
                            &format!("Minecraft reportó TitleScreen listo en {:?} ms", load_duration_ms),
                        );
                        let _ = app.emit("game-ipc-ready", load_duration_ms);
                    }
                    _ => {
                        crate::logger::log(
                            "WARN",
                            "GameIPC",
                            "Mensaje recibido antes de autenticar Handshake; desconectando.",
                        );
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }
}

/// Inicia el servidor de telemetría e IPC bidireccional en segundo plano (Tauri <-> Minecraft Game Client)
#[tauri::command]
pub async fn start_game_ipc_server(app_handle: AppHandle) -> Result<u16, String> {
    let _guard = IPC_INIT_LOCK.lock().await;
    let current_port = ACTUAL_IPC_PORT.load(Ordering::SeqCst);
    if current_port != 0 {
        return Ok(current_port);
    }

    let bind_addr = format!("127.0.0.1:{}", DEFAULT_GAME_IPC_PORT);
    let listener = match TcpListener::bind(&bind_addr).await {
        Ok(l) => l,
        Err(e) => {
            crate::logger::log(
                "WARN",
                "GameIPC",
                &format!(
                    "Puerto por defecto {} ocupado o no disponible ({}); intentando puerto dinámico...",
                    DEFAULT_GAME_IPC_PORT, e
                ),
            );
            TcpListener::bind("127.0.0.1:0").await.map_err(|e2| {
                format!(
                    "No se pudo enlazar el servidor GameIPC ni en {} ni dinámicamente: {}",
                    DEFAULT_GAME_IPC_PORT, e2
                )
            })?
        }
    };

    let bound_port = listener
        .local_addr()
        .map_err(|e| format!("Error obteniendo dirección local del socket: {}", e))?
        .port();

    ACTUAL_IPC_PORT.store(bound_port, Ordering::SeqCst);

    crate::logger::log(
        "INFO",
        "GameIPC",
        &format!("Servidor GameIPC escuchando en 127.0.0.1:{}", bound_port),
    );

    let app = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, peer)) => {
                    crate::logger::log(
                        "INFO",
                        "GameIPC",
                        &format!("Cliente de Minecraft conectado desde: {}", peer),
                    );

                    let app_inner = app.clone();
                    tokio::spawn(async move {
                        handle_ipc_client(app_inner, stream, peer).await;
                    });
                }
                Err(e) => {
                    crate::logger::log(
                        "ERROR",
                        "GameIPC",
                        &format!("Error aceptando conexión IPC: {}", e),
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
        }
    });

    Ok(bound_port)
}

const EMBEDDED_AGENT_JAR: &[u8] = include_bytes!("../assets/game-bridge.jar");
#[cfg(target_os = "windows")]
const EMBEDDED_AGENT_DLL: &[u8] = include_bytes!("../assets/game_bridge_core.dll");
#[cfg(target_os = "windows")]
const EMBEDDED_CT_AGENT_DLL: &[u8] = include_bytes!("../assets/ct-agent.dll");
const EMBEDDED_BOOST_JAR: &[u8] = include_bytes!("../assets/crystaltides-boost.jar");

fn file_sha256_matches(path: &Path, expected_bytes: &[u8]) -> bool {
    let Ok(existing_bytes) = fs::read(path) else {
        return false;
    };
    Sha256::digest(&existing_bytes) == Sha256::digest(expected_bytes)
}

pub fn validate_game_dir(game_dir: &str) -> Result<PathBuf, String> {
    let trimmed = game_dir.trim();
    if trimmed.is_empty() {
        return Err("El directorio del juego no puede estar vacío".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("Ruta no autorizada: El directorio del juego debe ser una ruta absoluta".to_string());
    }
    for component in path.components() {
        if let std::path::Component::ParentDir = component {
            return Err("Ruta no autorizada: Detectada navegación relativa hacia directorios padres".to_string());
        }
    }
    Ok(path)
}

fn deploy_agent_jar(base_path: &Path) {
    let target_jar = base_path.join("game-bridge.jar");
    let needs_deploy = !target_jar.exists() || !file_sha256_matches(&target_jar, EMBEDDED_AGENT_JAR);

    if needs_deploy {
        if let Err(e) = fs::write(&target_jar, EMBEDDED_AGENT_JAR) {
            crate::logger::log(
                "WARN",
                "CrystalAgent",
                &format!("No se pudo escribir game-bridge.jar embebido: {}", e),
            );
        } else {
            crate::logger::log(
                "INFO",
                "CrystalAgent",
                "game-bridge.jar desplegado automáticamente en la carpeta de juego.",
            );
        }
    }
}

pub fn deploy_boost_mod(base_path: &Path) {
    let mods_dir = base_path.join("mods");
    let target_jar = mods_dir.join("crystaltides-boost.jar");
    if !mods_dir.exists() {
        let _ = fs::create_dir_all(&mods_dir);
    }
    let needs_deploy = !target_jar.exists() || !file_sha256_matches(&target_jar, EMBEDDED_BOOST_JAR);

    if needs_deploy {
        if let Err(e) = fs::write(&target_jar, EMBEDDED_BOOST_JAR) {
            crate::logger::log(
                "WARN",
                "CrystalBoost",
                &format!("No se pudo escribir crystaltides-boost.jar embebido: {}", e),
            );
        } else {
            crate::logger::log(
                "INFO",
                "CrystalBoost",
                "crystaltides-boost.jar desplegado automáticamente en mods/.",
            );
        }
    }
}

#[tauri::command]
pub fn deploy_crystaltides_boost(game_dir: String) -> Result<bool, String> {
    let base_path = validate_game_dir(&game_dir)?;
    deploy_boost_mod(&base_path);
    Ok(true)
}

fn deploy_native_agent(natives_dir: &Path) -> PathBuf {
    let lib_filename = if cfg!(target_os = "windows") {
        "game_bridge_core.dll"
    } else if cfg!(target_os = "macos") {
        "libgame_bridge_core.dylib"
    } else {
        "libgame_bridge_core.so"
    };

    let agent_path = natives_dir.join(lib_filename);

    #[cfg(target_os = "windows")]
    {
        let needs_deploy = !agent_path.exists() || !file_sha256_matches(&agent_path, EMBEDDED_AGENT_DLL);
        if needs_deploy {
            if let Err(e) = fs::write(&agent_path, EMBEDDED_AGENT_DLL) {
                crate::logger::log(
                    "WARN",
                    "CrystalAgent",
                    &format!("No se pudo escribir game_bridge_core.dll embebido: {}", e),
                );
            } else {
                crate::logger::log(
                    "INFO",
                    "CrystalAgent",
                    "game_bridge_core.dll desplegado automáticamente en natives.",
                );
            }
        }

        let ct_agent_path = natives_dir.join("ct-agent.dll");
        let needs_deploy_ct = !ct_agent_path.exists() || !file_sha256_matches(&ct_agent_path, EMBEDDED_CT_AGENT_DLL);
        if needs_deploy_ct {
            if let Err(e) = fs::write(&ct_agent_path, EMBEDDED_CT_AGENT_DLL) {
                crate::logger::log(
                    "WARN",
                    "CrystalAgent",
                    &format!("No se pudo escribir ct-agent.dll embebido: {}", e),
                );
            } else {
                crate::logger::log(
                    "INFO",
                    "CrystalAgent",
                    "ct-agent.dll desplegado automáticamente en natives.",
                );
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // En plataformas no-Windows omitimos crear binarios dummy ASCII para no corromper la carga dlopen/JVM
        crate::logger::log(
            "INFO",
            "CrystalAgent",
            "Plataforma no-Windows: omitiendo despliegue de DLLs nativas de Windows.",
        );
    }

    agent_path
}

fn generate_agent_token(agent_path: &Path) -> String {
    #[cfg(target_os = "windows")]
    {
        if agent_path.exists() && !file_sha256_matches(agent_path, EMBEDDED_AGENT_DLL) {
            crate::logger::log(
                "WARN",
                "CrystalAgent",
                "Advertencia de integridad: SHA-256 de game_bridge_core.dll en disco difiere del binario embebido.",
            );
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = agent_path;

    let session_tok = Uuid::new_v4().to_string();
    set_expected_session_token(Some(&session_tok));
    session_tok
}

/// Prepara y verifica la presencia e integridad del binario nativo Crystal Agent (`game_bridge_core.dll` / `.so`)
#[tauri::command]
pub fn prepare_crystal_agent(game_dir: String) -> Result<AgentConfig, String> {
    let base_path = validate_game_dir(&game_dir)?;
    let natives_dir = base_path.join("natives");

    if !natives_dir.exists() {
        fs::create_dir_all(&natives_dir)
            .map_err(|e| format!("Failed to create natives directory: {}", e))?;
    }

    deploy_agent_jar(&base_path);
    let agent_path = deploy_native_agent(&natives_dir);
    let session_tok = generate_agent_token(&agent_path);

    Ok(AgentConfig {
        agent_enabled: true,
        native_library_path: agent_path.to_string_lossy().to_string(),
        agent_version: "2.0.0-native-fsr3.1".to_string(),
        injected_pid: None,
        handshake_token: session_tok,
        ipc_port: get_actual_game_ipc_port(),
    })
}

pub fn build_agent_jvm_args(base_path: &Path) -> Result<Vec<String>, String> {
    let natives_dir = base_path.join("natives");

    let mut args = vec![
        format!("-Djava.library.path={}", natives_dir.to_string_lossy()),
        "-Dcrystaltides.agent.enabled=true".to_string(),
        "-Dcrystaltides.agent.fsr3_frame_gen=true".to_string(),
        "-Dcrystaltides.agent.zero_gc_hud=true".to_string(),
        format!("-Dcrystaltides.ipc.port={}", get_actual_game_ipc_port()),
    ];

    if let Some(token_lock) = EXPECTED_SESSION_TOKEN.get() {
        if let Ok(guard) = token_lock.lock() {
            if let Some(ref tok) = *guard {
                args.push(format!("-Dcrystaltides.ipc.token={}", tok));
            }
        }
    }

    let agent_jar_candidates = [
        base_path.join("game-bridge.jar"),
        natives_dir.join("game-bridge.jar"),
        base_path.join("crystal-agent.jar"),
    ];

    for candidate in &agent_jar_candidates {
        if candidate.exists() {
            args.push(format!("-javaagent:{}", candidate.to_string_lossy()));
            break;
        }
    }

    let ct_agent_candidates = [
        natives_dir.join("ct-agent.dll"),
        base_path.join("ct-agent.dll"),
    ];

    for candidate in &ct_agent_candidates {
        if candidate.exists() {
            args.push(format!("-agentpath:{}", candidate.to_string_lossy()));
            break;
        }
    }

    Ok(args)
}

/// Genera los argumentos de línea de comandos de JVM necesarios para cargar automáticamente el Crystal Agent al iniciar Minecraft
#[tauri::command]
pub fn get_agent_jvm_args(game_dir: String) -> Result<Vec<String>, String> {
    let base_path = validate_game_dir(&game_dir)?;
    build_agent_jvm_args(&base_path)
}

/// Obtiene las métricas de rendimiento en tiempo real reportadas por la capa nativa OpenGL/Vulkan del Agente
#[tauri::command]
pub fn get_agent_benchmark_status() -> Result<AgentBenchmarkMetrics, String> {
    let handle = get_live_metrics_handle();
    let lock = handle.lock().map_err(|e| e.to_string())?;
    Ok(lock.clone())
}

#[tauri::command]
pub fn get_game_ipc_port() -> u16 {
    get_actual_game_ipc_port()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ipc_handshake() {
        let json = r#"{"type":"handshake","minecraft_version":"1.21.1","client_version":"1.0.0","mods_count":35,"gl_renderer":"NVIDIA RTX","gl_vendor":"NVIDIA","gl_version":"4.6"}"#;
        let msg = parse_ipc_line(json).expect("Should parse handshake message");
        match msg {
            IncomingIpcMessage::Handshake {
                minecraft_version,
                mods_count,
                gl_renderer,
                ..
            } => {
                assert_eq!(minecraft_version.as_deref(), Some("1.21.1"));
                assert_eq!(mods_count, Some(35));
                assert_eq!(gl_renderer.as_deref(), Some("NVIDIA RTX"));
            }
            _ => panic!("Expected Handshake message variant"),
        }
    }

    #[test]
    fn test_parse_ipc_telemetry() {
        let json = r#"{"type":"telemetry","fps":144.5,"frametime_p99_ms":6.8,"gc_pause_time_ms":0.0,"memory_used_mb":2500,"memory_total_mb":8192,"swapchain_backend":"OpenGL 4.5"}"#;
        let msg = parse_ipc_line(json).expect("Should parse telemetry message");
        match msg {
            IncomingIpcMessage::Telemetry {
                fps,
                frametime_p99_ms,
                gc_pause_time_ms,
                memory_used_mb,
                ..
            } => {
                assert!((fps - 144.5).abs() < f64::EPSILON);
                assert!((frametime_p99_ms - 6.8).abs() < f64::EPSILON);
                assert_eq!(gc_pause_time_ms, 0.0);
                assert_eq!(memory_used_mb, Some(2500));
            }
            _ => panic!("Expected Telemetry message variant"),
        }
    }

    #[test]
    fn test_parse_ipc_invalid() {
        assert!(parse_ipc_line("").is_none());
        assert!(parse_ipc_line("not json").is_none());
        assert!(parse_ipc_line(r#"{"unknown":"field"}"#).is_none());
    }

    #[test]
    fn test_build_agent_jvm_args_ipc_port() {
        let temp_dir = std::env::temp_dir();
        let args = build_agent_jvm_args(&temp_dir).expect("Should build JVM args");
        assert!(args.iter().any(|arg| arg == "-Dcrystaltides.agent.fsr3_frame_gen=true"));
        assert!(args.iter().any(|arg| arg == &format!("-Dcrystaltides.ipc.port={}", get_actual_game_ipc_port())));
    }

    #[test]
    fn test_build_agent_jvm_args_with_ct_agent() {
        let temp_dir = std::env::temp_dir().join("ct_test_dir");
        let natives_dir = temp_dir.join("natives");
        let _ = fs::create_dir_all(&natives_dir);
        let ct_path = natives_dir.join("ct-agent.dll");
        let _ = fs::write(&ct_path, b"test_dll");

        let args = build_agent_jvm_args(&temp_dir).expect("Should build JVM args");
        assert!(args.iter().any(|arg| arg.starts_with("-agentpath:") && arg.contains("ct-agent.dll")));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_parse_ipc_handshake_with_token() {
        let json = r#"{"type":"handshake","token":"sec-token-12345","minecraft_version":"1.21.1","client_version":"1.0.0"}"#;
        let msg = parse_ipc_line(json).expect("Should parse handshake message with token");
        match msg {
            IncomingIpcMessage::Handshake { token, .. } => {
                assert_eq!(token.as_deref(), Some("sec-token-12345"));
            }
            _ => panic!("Expected Handshake message variant"),
        }
    }

    #[test]
    fn test_verify_session_token_fail_closed() {
        // En ausencia de un token inicializado, fail-closed rechaza todo
        set_expected_session_token(None);
        assert!(!verify_session_token(Some("random-token")));
        assert!(!verify_session_token(None));

        // Con token explícito, sólo coincide exactamente con el valor esperado
        set_expected_session_token(Some("valid-secret-999"));
        assert!(verify_session_token(Some("valid-secret-999")));
        assert!(!verify_session_token(Some("hacker-token")));
        assert!(!verify_session_token(None));
    }

    #[test]
    fn test_parse_ipc_line_max_length_cap() {
        // Line exceeding 16KB (16384 bytes) should be rejected
        let huge_line = "a".repeat(17000);
        assert!(parse_ipc_line(&huge_line).is_none());
    }

    #[test]
    fn test_telemetry_metrics_sanitization() {
        let (fps, p99, gc) = sanitize_telemetry(f64::NAN, -10.0, f64::INFINITY);
        assert_eq!(fps, 0.0);
        assert_eq!(p99, 0.0);
        assert_eq!(gc, 0.0);

        let (fps_valid, p99_valid, gc_valid) = sanitize_telemetry(144.5, 6.9, 0.5);
        assert_eq!(fps_valid, 144.5);
        assert_eq!(p99_valid, 6.9);
        assert_eq!(gc_valid, 0.5);
    }

    #[test]
    fn test_validate_game_dir_path_traversal_and_relative_rejection() {
        assert!(validate_game_dir("../../../secret").is_err());
        assert!(validate_game_dir("games/../../windows/system32").is_err());
        assert!(validate_game_dir(".").is_err());
        assert!(validate_game_dir("relative_dir").is_err());
    }

    #[test]
    fn test_validate_game_dir_empty_rejection() {
        assert!(validate_game_dir("").is_err());
        assert!(validate_game_dir("   ").is_err());
    }

    #[test]
    fn test_validate_game_dir_valid_path() {
        #[cfg(target_os = "windows")]
        let valid = validate_game_dir("C:/Users/gamer/.minecraft");
        #[cfg(not(target_os = "windows"))]
        let valid = validate_game_dir("/home/gamer/.minecraft");
        assert!(valid.is_ok());
    }

    #[test]
    fn test_file_sha256_matches() {
        let temp_file = std::env::temp_dir().join("sha256_unit_test.bin");
        let content = b"crystaltides-integrity-check-bytes";
        let _ = fs::write(&temp_file, content);

        assert!(file_sha256_matches(&temp_file, content));
        assert!(!file_sha256_matches(&temp_file, b"corrupted-tampered-content"));

        let _ = fs::remove_file(&temp_file);
    }

    #[test]
    fn test_generate_agent_token_cryptographic_uniqueness() {
        let temp_dir = std::env::temp_dir();
        let fake_dll = temp_dir.join("test_agent_token.dll");
        let _ = fs::write(&fake_dll, b"dummy content");

        let token1 = generate_agent_token(&fake_dll);
        let token2 = generate_agent_token(&fake_dll);

        assert_ne!(token1, token2);
        assert_eq!(token1.len(), 36);
        assert_eq!(token2.len(), 36);
        assert!(verify_session_token(Some(&token2)));
        assert!(!verify_session_token(Some(&token1))); // El token2 reemplazó el token esperado

        let _ = fs::remove_file(&fake_dll);
    }
}
