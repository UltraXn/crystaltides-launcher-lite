use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::net::TcpListener;
use uuid::Uuid;

use crate::boost_jars::{BoostJar, BOOST_JARS, BOOST_VERSION};

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
    /// `None` cuando no hay fuente de frames (instancia sin crystaltides-boost); `Some(0.0)`
    /// es un dato real (p. ej. ventana minimizada).
    pub average_fps: Option<f64>,
    pub frametime_p99_ms: Option<f64>,
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
        fps: Option<f64>,
        frametime_p99_ms: Option<f64>,
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

/// Descarta valores no finitos o negativos y acota a `max`.
fn sanitize_metric(value: f64, max: f64) -> Option<f64> {
    (value.is_finite() && value >= 0.0).then(|| value.min(max))
}

pub(crate) fn sanitize_telemetry(
    fps: Option<f64>,
    frametime_p99_ms: Option<f64>,
    gc_pause_time_ms: f64,
) -> (Option<f64>, Option<f64>, f64) {
    // Un menú sin límite de FPS puede superar los 1000 FPS reales: el tope solo filtra basura
    let clean_fps = fps.and_then(|v| sanitize_metric(v, 100_000.0));
    let clean_p99 = frametime_p99_ms.and_then(|v| sanitize_metric(v, 10_000.0));
    let clean_gc = sanitize_metric(gc_pause_time_ms, 60_000.0).unwrap_or(0.0);
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
    fps: Option<f64>,
    frametime_p99_ms: Option<f64>,
    gc_pause_time_ms: f64,
    memory_used_mb: Option<u64>,
    memory_total_mb: Option<u64>,
    swapchain_backend: Option<String>,
) {
    let (clean_fps, clean_p99, clean_gc) =
        sanitize_telemetry(fps, frametime_p99_ms, gc_pause_time_ms);

    if clean_gc > 250.0 {
        let fmt_opt = |v: Option<f64>, decimals: usize| {
            v.map_or_else(|| "n/d".to_string(), |v| format!("{:.*}", decimals, v))
        };
        crate::logger::log(
            "WARN",
            "GameIPC",
            &format!(
                "Pausa severa de GC detectada: {:.1} ms (FPS: {}, p99: {} ms). Evaluando presión de memoria.",
                clean_gc,
                fmt_opt(clean_fps, 0),
                fmt_opt(clean_p99, 2)
            ),
        );
    }

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
/// Nombre con el que se despliega CrystalTides Boost en mods/, sea cual sea el jar: al cambiar la
/// versión de Minecraft de la instancia se sustituye en vez de quedar dos copias del mod.
const BOOST_MOD_FILE: &str = "crystaltides-boost.jar";
/// SHA-256 de builds de crystaltides-boost.jar desplegados por versiones anteriores del launcher.
/// scripts/sync-launcher-assets.mjs (monorepo) añade aquí el hash de cada jar embebido que sustituye
/// o retira, para que el launcher pueda seguir retirándolos de instancias existentes.
const LEGACY_BOOST_JAR_SHA256: &[&str] = &[
    "8b87d7242e7e37b57dde2997914bb69884fd253378c8856bddbcfbff27bfcfd8",
    "55fbe3a673d0efdc614464c996d5a57d1c36b8a6afcb4f5b09bfd52a1f68917a", // fabric 1.0.0 (sin agent bridge)
    "d667f0b8fa70d1dec49fc546fd3a5a2ce6589ac0ad86d206c1516bdc59568461", // neoforge 1.0.0 (sin agent bridge)
    "9c39a75d0ad8c87c84b1f56522a47575f8ecb5d280aea0e562a1443b6f4740a7", // crystaltides-boost-fabric.jar previo (sync 2026-10-16)
    "e53774d3b5aa9227920d421515a6eae5a4b5ca2ee8e3233203948f6387d739e2", // crystaltides-boost-neoforge.jar previo (sync 2026-10-16)
    "4512f6021b5af028fec4ceb8e484632b985259d63677eaa5b3ae9481afdeac81", // crystaltides-boost-fabric.jar previo (sync 2026-10-16)
    "f194c8c377502029a8d58e3f1f66e38c5bf8b2bb374ee20c50d6c54a04d26f2c", // crystaltides-boost-neoforge.jar previo (sync 2026-10-16)
    "155ee7d83e79eab6e1414e428f9dbd71ea15463f600a91447e22506f1303df23", // crystaltides-boost-fabric.jar previo (sync 2026-10-17)
    "7f4999068fbe0a01c1b3a06aadbcc0501e3d460fb65a21878f028027d16f9130", // crystaltides-boost-neoforge.jar previo (sync 2026-10-17)
];

fn is_known_boost_jar(bytes: &[u8]) -> bool {
    use sha2::Digest;

    let sha256 = hex::encode(sha2::Sha256::digest(bytes));
    BOOST_JARS.iter().any(|jar| jar.sha256 == sha256)
        || LEGACY_BOOST_JAR_SHA256.contains(&sha256.as_str())
}

/// Jar embebido de CrystalTides Boost para el loader y la versión de Minecraft de una instancia.
/// Quilt usa el de Fabric. La versión tiene que ser una de las de un grupo: una posterior a las
/// soportadas (p. ej. 26.4) o un snapshot no recibe ningún jar.
fn boost_jar_for(loader_type: &str, mc_version: &str) -> Option<&'static BoostJar> {
    let loader = match loader_type.trim().to_lowercase().as_str() {
        "fabric" | "quilt" => "fabric",
        "neoforge" => "neoforge",
        _ => return None,
    };
    let mc_version = mc_version.trim();
    BOOST_JARS
        .iter()
        .find(|jar| jar.loader == loader && jar.mc_releases.contains(&mc_version))
}

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

/// Despliega en mods/ el jar de CrystalTides Boost para el loader y la versión de Minecraft de la
/// instancia y devuelve si queda en su sitio. Si no hay build para esa combinación, retira el que el
/// launcher hubiera desplegado antes (p. ej. al cambiar la versión de la instancia), nunca uno ajeno.
pub fn deploy_boost_mod(base_path: &Path, loader_type: &str, mc_version: &str) -> bool {
    let Some(jar) = boost_jar_for(loader_type, mc_version) else {
        crate::logger::log(
            "INFO",
            "CrystalBoost",
            &format!(
                "CrystalTides Boost no tiene build para {:?} {:?}. Despliegue omitido.",
                loader_type, mc_version
            ),
        );
        let _ = remove_boost_mod(base_path);
        return false;
    };

    let mods_dir = base_path.join("mods");
    let target_jar = mods_dir.join(BOOST_MOD_FILE);
    if !mods_dir.exists() {
        let _ = fs::create_dir_all(&mods_dir);
    }
    if target_jar.exists() && file_sha256_matches(&target_jar, jar.bytes) {
        return true;
    }

    if let Err(e) = fs::write(&target_jar, jar.bytes) {
        crate::logger::log(
            "WARN",
            "CrystalBoost",
            &format!("No se pudo escribir crystaltides-boost.jar embebido: {}", e),
        );
        return false;
    }
    crate::logger::log(
        "INFO",
        "CrystalBoost",
        &format!(
            "crystaltides-boost.jar desplegado automáticamente en mods/ ({}, CrystalTides Boost {}).",
            jar.file_name, BOOST_VERSION
        ),
    );
    true
}

/// Devuelve si el jar de CrystalTides Boost queda en mods/: false si no hay build para esa versión
/// de Minecraft (ver `deploy_boost_mod`).
#[tauri::command]
pub async fn deploy_crystaltides_boost(
    game_dir: String,
    loader_type: Option<String>,
    mc_version: String,
) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let base_path = validate_game_dir(&game_dir)?;
        let loader = loader_type.unwrap_or_else(|| "fabric".to_string());
        Ok(deploy_boost_mod(&base_path, &loader, &mc_version))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Retira mods/crystaltides-boost.jar si lo desplegó el launcher (el jar embebido de cualquier grupo
/// o el de una versión anterior) y devuelve si lo retiró. Uno ajeno con ese nombre se deja.
fn remove_boost_mod(base_path: &Path) -> Result<bool, String> {
    let target_jar = base_path.join("mods").join(BOOST_MOD_FILE);

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

    if is_known_boost_jar(&existing_bytes) {
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
}

#[tauri::command]
pub async fn remove_crystaltides_boost(game_dir: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let base_path = validate_game_dir(&game_dir)?;
        remove_boost_mod(&base_path)
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

        for subdir in &["jna", "lwjgl", "netty", "java"] {
            let _ = fs::create_dir_all(natives_dir.join(subdir));
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

fn clean_path_for_jvm(path: &Path) -> String {
    let s = path.to_string_lossy();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        stripped.to_string()
    } else {
        s.to_string()
    }
}

pub fn build_agent_jvm_args(base_path: &Path) -> Result<Vec<String>, String> {
    let natives_dir = base_path.join("natives");
    let mc_version = resolve_instance_mc_version(base_path);

    let mut args = vec![
        format!("-Djava.library.path={}", clean_path_for_jvm(&natives_dir)),
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
            args.push(format!("-javaagent:{}", clean_path_for_jvm(candidate)));
            break;
        }
    }

    let ct_agent_candidates = [
        natives_dir.join("ct-agent.dll"),
        base_path.join("ct-agent.dll"),
    ];

    for candidate in &ct_agent_candidates {
        if candidate.exists() {
            args.push(format!("-agentpath:{}", clean_path_for_jvm(candidate)));
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
                assert_eq!(fps, Some(144.5));
                assert_eq!(frametime_p99_ms, Some(6.8));
                assert_eq!(gc_pause_time_ms, 0.0);
                assert_eq!(memory_used_mb, Some(2500));
            }
            _ => panic!("Expected Telemetry message variant"),
        }
    }

    #[test]
    fn test_parse_ipc_game_bridge_wire_format() {
        // Líneas exactas que emite IpcClient.java (game-bridge): sin fps/p99 ni datos GL
        let handshake = r#"{"type":"handshake","token":"tok-1","minecraft_version":"1.21.1","client_version":"CrystalAgent-v2.0 (Windows 10, Java 21)","mods_count":0}"#;
        match parse_ipc_line(handshake) {
            Some(IncomingIpcMessage::Handshake {
                token,
                mods_count,
                gl_renderer,
                ..
            }) => {
                assert_eq!(token.as_deref(), Some("tok-1"));
                assert_eq!(mods_count, Some(0));
                assert!(gl_renderer.is_none());
            }
            other => panic!("Expected Handshake, got {:?}", other),
        }

        let telemetry = r#"{"type":"telemetry","gc_pause_time_ms":12.0,"memory_used_mb":2048,"memory_total_mb":4096,"swapchain_backend":"OpenGL/LWJGL"}"#;
        match parse_ipc_line(telemetry) {
            Some(IncomingIpcMessage::Telemetry {
                fps,
                frametime_p99_ms,
                gc_pause_time_ms,
                memory_total_mb,
                swapchain_backend,
                ..
            }) => {
                // Sin crystaltides-boost no hay fuente de frames: ausencia, no 0
                assert_eq!(fps, None);
                assert_eq!(frametime_p99_ms, None);
                assert_eq!(gc_pause_time_ms, 12.0);
                assert_eq!(memory_total_mb, Some(4096));
                assert_eq!(swapchain_backend.as_deref(), Some("OpenGL/LWJGL"));
            }
            other => panic!("Expected Telemetry, got {:?}", other),
        }

        // Con crystaltides-boost presente el agente añade fps y p99 (FrameStats)
        let telemetry_with_frames = r#"{"type":"telemetry","fps":114.8,"frametime_p99_ms":10.06,"gc_pause_time_ms":0.0,"memory_used_mb":4,"memory_total_mb":8172,"swapchain_backend":"OpenGL/LWJGL"}"#;
        match parse_ipc_line(telemetry_with_frames) {
            Some(IncomingIpcMessage::Telemetry {
                fps,
                frametime_p99_ms,
                ..
            }) => {
                assert_eq!(fps, Some(114.8));
                assert_eq!(frametime_p99_ms, Some(10.06));
            }
            other => panic!("Expected Telemetry, got {:?}", other),
        }

        // PrintWriter.println en Windows termina con \r\n
        match parse_ipc_line("{\"type\":\"game_ready\",\"load_duration_ms\":8123}\r\n") {
            Some(IncomingIpcMessage::GameReady { load_duration_ms }) => {
                assert_eq!(load_duration_ms, Some(8123));
            }
            other => panic!("Expected GameReady, got {:?}", other),
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
        // Basura -> sin dato (la UI muestra "—"), nunca un número inventado
        let (fps, p99, gc) = sanitize_telemetry(Some(f64::NAN), Some(-10.0), f64::INFINITY);
        assert_eq!(fps, None);
        assert_eq!(p99, None);
        assert_eq!(gc, 0.0);

        let (fps_valid, p99_valid, gc_valid) = sanitize_telemetry(Some(144.5), Some(6.9), 0.5);
        assert_eq!(fps_valid, Some(144.5));
        assert_eq!(p99_valid, Some(6.9));
        assert_eq!(gc_valid, 0.5);

        // Sin fuente de frames: se conserva la ausencia; 0 FPS (minimizado) es un dato real
        assert_eq!(sanitize_telemetry(None, None, 1.0), (None, None, 1.0));
        assert_eq!(sanitize_telemetry(Some(0.0), Some(0.0), 0.0).0, Some(0.0));
        // Menús sin límite de FPS superan 1000 legítimamente
        assert_eq!(sanitize_telemetry(Some(2400.0), None, 0.0).0, Some(2400.0));
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
    fn test_is_known_boost_jar_accepts_embedded_and_previous_builds() {
        for jar in BOOST_JARS {
            assert!(
                is_known_boost_jar(jar.bytes),
                "{} no se reconoce",
                jar.file_name
            );
        }
        assert!(!is_known_boost_jar(
            b"some-other-mod-named-crystaltides-boost"
        ));
        assert!(!is_known_boost_jar(&[]));
        for legacy in LEGACY_BOOST_JAR_SHA256 {
            assert_eq!(legacy.len(), 64, "SHA-256 legacy mal formado: {}", legacy);
        }
    }

    #[test]
    fn test_boost_jar_for_picks_the_group_of_the_minecraft_version() {
        let file = |loader: &str, mc: &str| boost_jar_for(loader, mc).map(|jar| jar.file_name);
        assert_eq!(
            file("fabric", "1.21"),
            Some("crystaltides-boost-fabric-1.21.1.jar")
        );
        assert_eq!(
            file("neoforge", "1.21.2"),
            Some("crystaltides-boost-neoforge-1.21.3.jar")
        );
        assert_eq!(
            file("NeoForge", " 1.21.1 "),
            Some("crystaltides-boost-neoforge-1.21.1.jar")
        );
        // Quilt ejecuta los jars de Fabric
        assert_eq!(
            file("quilt", "1.21.1"),
            Some("crystaltides-boost-fabric-1.21.1.jar")
        );
        // Sin build: versiones fuera de los grupos, snapshots y loaders sin soporte
        assert_eq!(file("fabric", "1.20.1"), None);
        assert_eq!(file("fabric", "99.1"), None);
        assert_eq!(file("fabric", "1.21.1-pre1"), None);
        assert_eq!(file("fabric", ""), None);
        assert_eq!(file("forge", "1.21.1"), None);
        assert_eq!(file("vanilla", "1.21.1"), None);
    }

    #[test]
    fn test_boost_jars_cover_each_minecraft_version_once_per_loader() {
        for loader in ["fabric", "neoforge"] {
            let mut versions = std::collections::HashSet::new();
            for jar in BOOST_JARS.iter().filter(|jar| jar.loader == loader) {
                assert!(
                    !jar.mc_releases.is_empty(),
                    "{} no cubre ninguna versión",
                    jar.file_name
                );
                for mc in jar.mc_releases {
                    assert!(versions.insert(*mc), "{} {} está en dos jars", loader, mc);
                    assert_eq!(
                        boost_jar_for(loader, mc).map(|found| found.file_name),
                        Some(jar.file_name)
                    );
                }
            }
            assert!(
                versions.contains("1.21.1"),
                "{}: falta Minecraft 1.21.1",
                loader
            );
        }
    }

    #[test]
    fn test_deploy_boost_mod_swaps_and_retires_the_launcher_jar() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let base = temp.path();
        let target = base.join("mods").join(BOOST_MOD_FILE);
        let embedded = |loader, mc| boost_jar_for(loader, mc).expect("jar embebido").bytes;

        assert!(deploy_boost_mod(base, "fabric", "1.21.1"));
        assert_eq!(
            fs::read(&target).expect("read jar"),
            embedded("fabric", "1.21.1")
        );

        // Otra versión de Minecraft sustituye el jar en vez de añadir otro
        assert!(deploy_boost_mod(base, "quilt", "1.21.2"));
        assert_eq!(
            fs::read(&target).expect("read jar"),
            embedded("fabric", "1.21.2")
        );
        assert_eq!(
            fs::read_dir(base.join("mods")).expect("read mods").count(),
            1
        );

        // Sin build para la versión se retira el jar del launcher...
        assert!(!deploy_boost_mod(base, "neoforge", "1.20.1"));
        assert!(!target.exists());

        // ...pero nunca uno ajeno con el mismo nombre
        fs::write(&target, b"jar ajeno").expect("write foreign jar");
        assert!(!deploy_boost_mod(base, "fabric", "1.20.1"));
        assert_eq!(fs::read(&target).expect("read jar"), b"jar ajeno");
    }

    /// Extrae el checksum (última columna) de la fila de `file_name` en assets/MANIFEST.md
    fn manifest_sha256_for(file_name: &str) -> Option<String> {
        let manifest = include_str!("../assets/MANIFEST.md");
        let row_prefix = format!("| `{}` |", file_name);
        manifest
            .lines()
            .find(|line| line.starts_with(&row_prefix))
            .and_then(|line| line.trim_end().trim_end_matches('|').rsplit('|').next())
            .map(|cell| cell.trim().trim_matches('`').to_string())
    }

    #[test]
    fn test_embedded_assets_sha256_manifest_integrity() {
        use sha2::Digest;
        for jar in BOOST_JARS {
            let hash = hex::encode(sha2::Sha256::digest(jar.bytes));
            assert_eq!(hash, jar.sha256, "boost_jars.rs: hash de {}", jar.file_name);
            assert_eq!(
                manifest_sha256_for(&format!("boost/{}", jar.file_name)).as_deref(),
                Some(hash.as_str()),
                "MANIFEST.md: hash de boost/{}",
                jar.file_name
            );
        }

        let bridge_jar_hash = hex::encode(sha2::Sha256::digest(EMBEDDED_AGENT_JAR));
        assert_eq!(
            bridge_jar_hash,
            "24055194ace5737417eb716cdc9f8a6c0dfa010049dffe90a282588408a93684"
        );
        assert_eq!(
            manifest_sha256_for("game-bridge.jar").as_deref(),
            Some(bridge_jar_hash.as_str())
        );

        #[cfg(target_os = "windows")]
        {
            let ct_agent_hash = hex::encode(sha2::Sha256::digest(EMBEDDED_CT_AGENT_DLL));
            assert_eq!(
                ct_agent_hash,
                "ba1aa3c7b9eb074a6be5480087216fbe32d73654eab695f2a676d5a84f94d6e8"
            );
            assert_eq!(
                manifest_sha256_for("ct-agent.dll").as_deref(),
                Some(ct_agent_hash.as_str())
            );
        }
    }
}
