//! Marca en disco de la partida en curso.
//!
//! Al cerrarse, el launcher deja Minecraft abierto (ver `ProcessJobGuard`), así que al reabrirlo
//! `GAME_SESSION` está vacía aunque el juego siga en marcha y nada impedía lanzar otra instancia
//! sobre la misma carpeta. La marca guarda el PID y la hora de arranque del proceso: el PID solo no
//! basta, porque el sistema lo reutiliza en cuanto el proceso muere.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MARKER_FILE: &str = "running_game.json";

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
struct GameMarker {
    pid: u32,
    start_time: u64,
}

fn marker_path() -> Option<PathBuf> {
    crate::sys::get_default_install_dir().map(|dir| dir.join(MARKER_FILE))
}

/// Hora de arranque del proceso en segundos desde epoch, o `None` si ya no existe.
fn process_start_time(pid: u32) -> Option<u64> {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
    let pid = Pid::from_u32(pid);
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::nothing(),
    );
    sys.process(pid).map(|process| process.start_time())
}

fn read_marker(path: &Path) -> Option<GameMarker> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn record_at(path: &Path, pid: u32) -> Result<(), String> {
    let start_time =
        process_start_time(pid).ok_or_else(|| format!("el proceso {pid} ya no existe"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&GameMarker { pid, start_time }).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

/// PID de la partida marcada si sigue viva. Una marca ilegible o de un proceso que ya terminó
/// (o cuyo PID ocupa ahora otro proceso) se borra: en la duda se permite lanzar.
fn running_pid_at(path: &Path) -> Option<u32> {
    let marker = read_marker(path)?;
    if process_start_time(marker.pid) == Some(marker.start_time) {
        return Some(marker.pid);
    }
    let _ = fs::remove_file(path);
    None
}

/// Solo borra la marca de este PID: el monitor de una partida que acaba de terminar no debe
/// llevarse la de un lanzamiento nuevo que ya la sobrescribió.
fn clear_at(path: &Path, pid: u32) {
    if read_marker(path).is_some_and(|marker| marker.pid == pid) {
        let _ = fs::remove_file(path);
    }
}

pub fn record(pid: u32) {
    let Some(path) = marker_path() else {
        return;
    };
    if let Err(e) = record_at(&path, pid) {
        crate::logger::log(
            "WARN",
            "GameMarker",
            &format!("No se pudo guardar la marca de la partida en curso: {e}"),
        );
    }
}

pub fn clear_if(pid: u32) {
    if let Some(path) = marker_path() {
        clear_at(&path, pid);
    }
}

/// Falla si sigue abierta una partida lanzada por una sesión anterior del launcher.
pub fn check_no_orphaned_game() -> Result<(), String> {
    let Some(pid) = marker_path().and_then(|path| running_pid_at(&path)) else {
        return Ok(());
    };
    crate::logger::log(
        "WARN",
        "GameMarker",
        &format!(
            "Lanzamiento bloqueado: Minecraft de una sesión anterior sigue abierto (PID {pid})."
        ),
    );
    Err(format!(
        "Minecraft sigue abierto desde una sesión anterior del launcher (PID {pid}). Ciérralo antes \
         de volver a jugar; si no ves su ventana, termina ese proceso desde el Administrador de tareas."
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exited_child_pid() -> u32 {
        let mut child = std::process::Command::new(std::env::current_exe().unwrap())
            .arg("--list")
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap();
        let pid = child.id();
        child.wait().unwrap();
        pid
    }

    #[test]
    fn test_marker_of_live_process_blocks_until_cleared() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(MARKER_FILE);
        let pid = std::process::id();

        record_at(&path, pid).unwrap();
        assert_eq!(running_pid_at(&path), Some(pid));

        clear_at(&path, pid);
        assert!(!path.exists());
        assert_eq!(running_pid_at(&path), None);
    }

    #[test]
    fn test_marker_of_exited_process_is_stale() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(MARKER_FILE);
        let pid = exited_child_pid();
        fs::write(
            &path,
            serde_json::to_string(&GameMarker { pid, start_time: 1 }).unwrap(),
        )
        .unwrap();

        assert_eq!(running_pid_at(&path), None);
        assert!(!path.exists(), "la marca obsoleta se borra");
    }

    /// El PID existe pero lo ocupa otro proceso que arrancó a otra hora (PID reutilizado)
    #[test]
    fn test_marker_with_reused_pid_is_stale() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(MARKER_FILE);
        let pid = std::process::id();
        let start_time = process_start_time(pid).unwrap();
        let marker = GameMarker {
            pid,
            start_time: start_time - 3600,
        };
        fs::write(&path, serde_json::to_string(&marker).unwrap()).unwrap();

        assert_eq!(running_pid_at(&path), None);
    }

    #[test]
    fn test_corrupt_marker_does_not_block() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(MARKER_FILE);
        fs::write(&path, "{ pid: ").unwrap();

        assert_eq!(running_pid_at(&path), None);
    }

    #[test]
    fn test_clear_keeps_marker_of_newer_launch() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(MARKER_FILE);
        let pid = std::process::id();
        record_at(&path, pid).unwrap();

        clear_at(&path, pid.wrapping_add(1));

        assert_eq!(running_pid_at(&path), Some(pid));
    }
}
