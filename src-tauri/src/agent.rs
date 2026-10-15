use serde::{Deserialize, Serialize};
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
        #[serde(default)]
        fps: f64,
        #[serde(default)]
        frametime_p99_ms: f64,
        gc_pause_time_ms: f64,
        memory_used_mb: Option<u64>,
        memory_total_mb: Option<u64>,
        swapchain_backend: Option<String>,
    },
    #[serde(rename = "game_ready")]
    GameReady { load_duration_ms: Option<u64> },
}

pub const MAX_IPC_FRAME_BYTES: usize = 16384; // 16 KB anti-DoS limit

static LIVE_METRICS: OnceLock<Arc<Mutex<Option<AgentBenchmarkMetrics>>>> = OnceLock::new();
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

pub(crate) fn sanitize_telemetry(
    fps: f64,
    frametime_p99_ms: f64,
    gc_pause_time_ms: f64,
) -> (f64, f64, f64) {
    let clean_fps = if fps.is_finite() && fps >= 0.0 {
        fps.min(1000.0)
    } else {
        0.0
    };
    let clean_p99 = if frametime_p99_ms.is_finite() && frametime_p99_ms >= 0.0 {
        frametime_p99_ms.min(10000.0)
    } else {
        0.0
    };
    let clean_gc = if gc_pause_time_ms.is_finite() && gc_pause_time_ms >= 0.0 {
        gc_pause_time_ms.min(60000.0)
    } else {
        0.0
    };
    (clean_fps, clean_p99, clean_gc)
}

fn get_live_metrics_handle() -> &'static Arc<Mutex<Option<AgentBenchmarkMetrics>>> {
    LIVE_METRICS.get_or_init(|| Arc::new(Mutex::new(None)))
}

pub fn reset_live_metrics() {
    let handle = get_live_metrics_handle();
    if let Ok(mut lock) = handle.lock() {
        *lock = None;
    }
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
            &format!(
                "Handshake rechazado para {}: token de sesión inválido",
                peer
            ),
        );
        return false;
    }

    if let Some(ref rend) = payload.gl_renderer {
        let rend_lower = rend.to_lowercase();
        if rend_lower.contains("intel")
            || rend_lower.contains("microsoft basic")
            || rend_lower.contains("llvmpipe")
        {
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

    let (clean_fps, clean_p99, clean_gc) =
        sanitize_telemetry(fps, frametime_p99_ms, gc_pause_time_ms);
    let metrics_lock = get_live_metrics_handle();
    if let Ok(mut lock) = metrics_lock.lock() {
        let current_sw = swapchain_backend.unwrap_or_else(|| {
            lock.as_ref()
                .map(|m| m.swapchain_backend.clone())
                .unwrap_or_else(|| "OpenGL".to_string())
        });

        let updated = AgentBenchmarkMetrics {
            average_fps: clean_fps,
            frametime_p99_ms: clean_p99,
            gc_pause_time_ms: clean_gc,
            swapchain_backend: current_sw,
            integrity_status: "ONLINE_LINKED".to_string(),
            memory_used_mb,
            memory_total_mb,
        };
        *lock = Some(updated.clone());

        let _ = app.emit("game-ipc-metrics", updated);
    }
}

async fn handle_ipc_client(
    app: AppHandle,
    stream: tokio::net::TcpStream,
    peer: std::net::SocketAddr,
) {
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
                crate::logger::log(
                    "WARN",
                    "GameIPC",
                    "Frame excedió límite de tamaño; desconectando.",
                );
                break;
            }
            Ok(_) => {
                let Some(msg) = parse_ipc_line(&line) else {
                    continue;
                };
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
                            &format!(
                                "Minecraft reportó TitleScreen listo en {:?} ms",
                                load_duration_ms
                            ),
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
const EMBEDDED_CT_AGENT_DLL: &[u8] = include_bytes!("../assets/ct-agent.dll");
const EMBEDDED_BOOST_FABRIC_JAR: &[u8] = include_bytes!("../assets/crystaltides-boost-fabric.jar");
const EMBEDDED_BOOST_NEOFORGE_JAR: &[u8] =
    include_bytes!("../assets/crystaltides-boost-neoforge.jar");
const LEGACY_BOOST_JAR_SHA256: &str =
    "8b87d7242e7e37b57dde2997914bb69884fd253378c8856bddbcfbff27bfcfd8";

fn file_sha256_matches(path: &Path, expected_bytes: &[u8]) -> bool {
    let Ok(existing_bytes) = fs::read(path) else {
        return false;
    };
    existing_bytes == expected_bytes
}

pub fn validate_game_dir(game_dir: &str) -> Result<PathBuf, String> {
    crate::paths::validate_game_dir(game_dir)
}

fn deploy_agent_jar(base_path: &Path) {
    let target_jar = base_path.join("game-bridge.jar");
    let needs_deploy =
        !target_jar.exists() || !file_sha256_matches(&target_jar, EMBEDDED_AGENT_JAR);

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

pub fn deploy_boost_mod(base_path: &Path, loader_type: &str) {
    let loader = loader_type.to_lowercase();
    let jar_bytes: Option<&[u8]> = match loader.as_str() {
        "fabric" | "quilt" => Some(EMBEDDED_BOOST_FABRIC_JAR),
        "neoforge" => Some(EMBEDDED_BOOST_NEOFORGE_JAR),
        _ => None,
    };

    let Some(bytes) = jar_bytes else {
        crate::logger::log(
            "WARN",
            "CrystalBoost",
            &format!(
                "Loader '{}' no es compatible con CrystalTides Boost. Despliegue omitido.",
                loader_type
            ),
        );
        return;
    };

    let mods_dir = base_path.join("mods");
    let target_jar = mods_dir.join("crystaltides-boost.jar");
    if !mods_dir.exists() {
        let _ = fs::create_dir_all(&mods_dir);
    }
    let needs_deploy = !target_jar.exists() || !file_sha256_matches(&target_jar, bytes);

    if needs_deploy {
        if let Err(e) = fs::write(&target_jar, bytes) {
            crate::logger::log(
                "WARN",
                "CrystalBoost",
                &format!("No se pudo escribir crystaltides-boost.jar embebido: {}", e),
            );
        } else {
            crate::logger::log(
                "INFO",
                "CrystalBoost",
                &format!(
                    "crystaltides-boost.jar ({}) desplegado automáticamente en mods/.",
                    loader_type
                ),
            );
        }
    }
}

#[tauri::command]
pub async fn deploy_crystaltides_boost(
    game_dir: String,
    loader_type: Option<String>,
) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let base_path = validate_game_dir(&game_dir)?;
        let loader = loader_type.unwrap_or_else(|| "fabric".to_string());
        deploy_boost_mod(&base_path, &loader);
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_crystaltides_boost(game_dir: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        use sha2::Digest;

        let base_path = validate_game_dir(&game_dir)?;
        let mods_dir = base_path.join("mods");
        let target_jar = mods_dir.join("crystaltides-boost.jar");

        if !target_jar.exists() {
            return Ok(false);
        }

        let existing_bytes = match fs::read(&target_jar) {
            Ok(b) => b,
            Err(e) => {
                crate::logger::log(
                    "WARN",
                    "CrystalBoost",
                    &format!(
                        "No se pudo leer crystaltides-boost.jar para verificar antes de borrar: {}",
                        e
                    ),
                );
                return Err(format!("No se pudo leer crystaltides-boost.jar: {}", e));
            }
        };

        let existing_sha256 = hex::encode(sha2::Sha256::digest(&existing_bytes));
        let is_known_boost_jar = existing_bytes == EMBEDDED_BOOST_FABRIC_JAR
            || existing_bytes == EMBEDDED_BOOST_NEOFORGE_JAR
            || existing_sha256 == LEGACY_BOOST_JAR_SHA256;

        if is_known_boost_jar {
            if let Err(e) = fs::remove_file(&target_jar) {
                crate::logger::log(
                    "WARN",
                    "CrystalBoost",
                    &format!("No se pudo eliminar crystaltides-boost.jar: {}", e),
                );
                return Err(format!("No se pudo eliminar crystaltides-boost.jar: {}", e));
            }
            crate::logger::log(
                "INFO",
                "CrystalBoost",
                "crystaltides-boost.jar obsoleto/no aplicable eliminado de mods/.",
            );
            Ok(true)
        } else {
            crate::logger::log(
                "WARN",
                "CrystalBoost",
                "crystaltides-boost.jar detectado en mods/, pero no coincide byte a byte con los binarios embebidos del launcher. No se eliminará.",
            );
            Ok(false)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn deploy_native_agent(natives_dir: &Path) -> PathBuf {
    let ct_agent_path = natives_dir.join("ct-agent.dll");

    #[cfg(target_os = "windows")]
    {
        let needs_deploy_ct =
            !ct_agent_path.exists() || !file_sha256_matches(&ct_agent_path, EMBEDDED_CT_AGENT_DLL);
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

    ct_agent_path
}

fn generate_agent_token(agent_path: &Path) -> String {
    #[cfg(target_os = "windows")]
    {
        if agent_path.exists() && !file_sha256_matches(agent_path, EMBEDDED_CT_AGENT_DLL) {
            crate::logger::log(
                "WARN",
                "CrystalAgent",
                "Advertencia de integridad: SHA-256 de ct-agent.dll en disco difiere del binario embebido.",
            );
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = agent_path;

    let session_tok = Uuid::new_v4().to_string();
    set_expected_session_token(Some(&session_tok));
    session_tok
}

/// Prepara y verifica la presencia e integridad del binario nativo Crystal Agent (`ct-agent.dll`)
#[tauri::command]
pub async fn prepare_crystal_agent(game_dir: String) -> Result<AgentConfig, String> {
    tokio::task::spawn_blocking(move || {
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
            agent_version: "2.0.0-native".to_string(),
            injected_pid: None,
            handshake_token: session_tok,
            ipc_port: get_actual_game_ipc_port(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn resolve_instance_mc_version(base_path: &Path) -> String {
    let cf_path = base_path.join("minecraftinstance.json");
    if let Ok(content) = fs::read_to_string(&cf_path) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(v) = val
                .get("minecraftVersion")
                .and_then(|v| v.as_str())
                .or_else(|| {
                    val.get("manifest")
                        .and_then(|m| m.get("minecraft"))
                        .and_then(|mc| mc.get("version"))
                        .and_then(|v| v.as_str())
                })
            {
                return v.to_string();
            }
        }
    }
    let mr_path = base_path.join("profile.json");
    if let Ok(content) = fs::read_to_string(&mr_path) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(v) = val.get("game_version").and_then(|v| v.as_str()) {
                return v.to_string();
            }
        }
    }
    let cfg_path = base_path.join("instance.cfg");
    if let Ok(content) = fs::read_to_string(&cfg_path) {
        for line in content.lines() {
            if let Some(rest) = line.strip_prefix("IntendedVersion=") {
                let v = rest.trim();
                if !v.is_empty() {
                    return v.to_string();
                }
            }
        }
    }
    let versions_dir = base_path.join("versions");
    if let Ok(entries) = fs::read_dir(&versions_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    if !name.is_empty() {
                        return name.to_string();
                    }
                }
            }
        }
    }
    "1.21.1".to_string()
}

pub fn build_agent_jvm_args(base_path: &Path) -> Result<Vec<String>, String> {
    let natives_dir = base_path.join("natives");
    let mc_version = resolve_instance_mc_version(base_path);

    let mut args = vec![
        format!("-Djava.library.path={}", natives_dir.to_string_lossy()),
        "-Dcrystaltides.agent.enabled=true".to_string(),
        format!("-Dcrystaltides.minecraft.version={}", mc_version),
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
pub fn get_agent_benchmark_status() -> Result<Option<AgentBenchmarkMetrics>, String> {
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
        assert!(args
            .iter()
            .any(|arg| arg.starts_with("-Dcrystaltides.minecraft.version=")));
        assert!(args
            .iter()
            .any(|arg| arg == &format!("-Dcrystaltides.ipc.port={}", get_actual_game_ipc_port())));
    }

    #[test]
    fn test_build_agent_jvm_args_with_ct_agent() {
        let temp_dir = std::env::temp_dir().join("ct_test_dir");
        let natives_dir = temp_dir.join("natives");
        let _ = fs::create_dir_all(&natives_dir);
        let ct_path = natives_dir.join("ct-agent.dll");
        let _ = fs::write(&ct_path, b"test_dll");

        let args = build_agent_jvm_args(&temp_dir).expect("Should build JVM args");
        assert!(args
            .iter()
            .any(|arg| arg.starts_with("-agentpath:") && arg.contains("ct-agent.dll")));

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
    #[serial_test::serial]
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
        if let Some(home) = dirs::home_dir() {
            let valid_ct = home.join(".crystaltides");
            assert!(validate_game_dir(&valid_ct.to_string_lossy()).is_ok());
        }
        let temp = tempfile::tempdir().unwrap();
        assert!(validate_game_dir(&temp.path().to_string_lossy()).is_ok());
    }

    #[test]
    fn test_file_sha256_matches() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let temp_file = temp_dir.path().join("sha256_unit_test.bin");
        let content = b"crystaltides-integrity-check-bytes";
        let _ = fs::write(&temp_file, content);

        assert!(file_sha256_matches(&temp_file, content));
        assert!(!file_sha256_matches(
            &temp_file,
            b"corrupted-tampered-content"
        ));
    }

    #[test]
    #[serial_test::serial]
    fn test_generate_agent_token_cryptographic_uniqueness() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let fake_dll = temp_dir.path().join("test_agent_token.dll");
        let _ = fs::write(&fake_dll, b"dummy content");

        let token1 = generate_agent_token(&fake_dll);
        let token2 = generate_agent_token(&fake_dll);

        assert_ne!(token1, token2);
        assert_eq!(token1.len(), 36);
        assert_eq!(token2.len(), 36);
        assert!(verify_session_token(Some(&token2)));
        assert!(!verify_session_token(Some(&token1))); // El token2 reemplazó el token esperado
    }

    #[test]
    #[serial_test::serial]
    fn test_live_metrics_initially_none_and_resettable() {
        reset_live_metrics();
        let handle = get_live_metrics_handle();
        let lock = handle.lock().expect("lock metrics");
        assert!(
            lock.is_none(),
            "Live metrics must be None by default when disconnected"
        );
    }

    #[test]
    fn test_embedded_assets_sha256_manifest_integrity() {
        use sha2::Digest;
        let fabric_boost_hash = hex::encode(sha2::Sha256::digest(EMBEDDED_BOOST_FABRIC_JAR));
        assert_eq!(
            fabric_boost_hash,
            "55fbe3a673d0efdc614464c996d5a57d1c36b8a6afcb4f5b09bfd52a1f68917a"
        );

        let neoforge_boost_hash = hex::encode(sha2::Sha256::digest(EMBEDDED_BOOST_NEOFORGE_JAR));
        assert_eq!(
            neoforge_boost_hash,
            "d667f0b8fa70d1dec49fc546fd3a5a2ce6589ac0ad86d206c1516bdc59568461"
        );

        let bridge_jar_hash = hex::encode(sha2::Sha256::digest(EMBEDDED_AGENT_JAR));
        assert_eq!(
            bridge_jar_hash,
            "7da11c27e1550c67cde46bd383a247872c26d5012ac431565fab52d9d34d63d5"
        );

        #[cfg(target_os = "windows")]
        {
            let ct_agent_hash = hex::encode(sha2::Sha256::digest(EMBEDDED_CT_AGENT_DLL));
            assert_eq!(
                ct_agent_hash,
                "ba1aa3c7b9eb074a6be5480087216fbe32d73654eab695f2a676d5a84f94d6e8"
            );
        }
    }
}
