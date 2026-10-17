//! Traspaso de auto-actualización del instalador propio (sin NSIS).
//!
//! El release publica el ejecutable crudo como `CrystalTides-Setup.exe`. Al actualizar,
//! `tauri-plugin-updater` lo descarga a `%TEMP%`, lo ejecuta con `/P /UPDATE [/R /ARGS ...]`
//! y cierra el launcher con `exit(0)`. Esa instancia temporal reemplaza el binario instalado
//! (`<install_dir>/bin/CrystalTidesLauncher.exe`) y lo relanza antes de crear ninguna ventana.

use std::fs;
use std::io;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

#[cfg(target_os = "windows")]
const INSTALLED_EXE_NAME: &str = "CrystalTidesLauncher.exe";
#[cfg(not(target_os = "windows"))]
const INSTALLED_EXE_NAME: &str = "CrystalTidesLauncher";

/// El launcher instalado sale justo después de lanzar el instalador; 10 s cubren de sobra
/// el cierre aunque haya antivirus escaneando el binario.
const REPLACE_ATTEMPTS: u32 = 40;
const REPLACE_RETRY_DELAY: Duration = Duration::from_millis(250);

pub fn is_update_handoff(args: &[String]) -> bool {
    args.iter()
        .skip(1)
        .any(|arg| arg.eq_ignore_ascii_case("/update") || arg.eq_ignore_ascii_case("--update"))
}

/// Reemplaza el launcher instalado por el ejecutable actual y lo relanza.
/// Solo retorna si el traspaso no aplica o falla; en caso de éxito termina el proceso.
pub fn perform_update_handoff() {
    let Ok(current_exe) = std::env::current_exe() else {
        return;
    };
    let install_dir = crate::resolve_install_dir(&current_exe);
    if !crate::sys::is_app_installed(&install_dir) {
        crate::logger::log(
            "WARN",
            "SelfUpdate",
            "Actualización solicitada pero no hay instalación previa; se continúa como instalador.",
        );
        return;
    }

    let target = install_dir.join("bin").join(INSTALLED_EXE_NAME);
    if same_file(&current_exe, &target) {
        // Ya es el binario instalado (p. ej. `--update` manual): arranque normal
        return;
    }

    if let Err(e) =
        replace_installed_binary(&current_exe, &target, REPLACE_ATTEMPTS, REPLACE_RETRY_DELAY)
    {
        crate::logger::log(
            "ERROR",
            "SelfUpdate",
            &format!(
                "No se pudo reemplazar {}: {}. Se continúa como instalador.",
                target.display(),
                e
            ),
        );
        return;
    }

    stamp_installed_version(&install_dir);
    crate::logger::log(
        "INFO",
        "SelfUpdate",
        &format!(
            "Launcher actualizado a v{} en {}",
            env!("CARGO_PKG_VERSION"),
            target.display()
        ),
    );

    match Command::new(&target).current_dir(&install_dir).spawn() {
        Ok(_) => std::process::exit(0),
        Err(e) => crate::logger::log(
            "ERROR",
            "SelfUpdate",
            &format!("Binario actualizado pero no se pudo relanzar: {}", e),
        ),
    }
}

fn same_file(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

/// Copia `new_exe` junto a `target` y lo renombra encima, reintentando mientras el binario
/// instalado siga bloqueado por el proceso que se está cerrando. El rename evita dejar un
/// ejecutable truncado si la copia se interrumpe.
pub(crate) fn replace_installed_binary(
    new_exe: &Path,
    target: &Path,
    attempts: u32,
    retry_delay: Duration,
) -> io::Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let staged = target.with_extension("exe.new");
    fs::copy(new_exe, &staged)?;

    let mut last_err = None;
    for attempt in 0..attempts.max(1) {
        match fs::rename(&staged, target) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                if attempt + 1 < attempts {
                    std::thread::sleep(retry_delay);
                }
            }
        }
    }
    let _ = fs::remove_file(&staged);
    Err(last_err.unwrap_or_else(|| io::Error::other("rename no intentado")))
}

/// Actualiza `version`/`updatedAt` en `.installed.json` (best-effort, escritura atómica).
fn stamp_installed_version(install_dir: &Path) {
    let installed_file = install_dir.join(".installed.json");
    let Ok(content) = fs::read_to_string(&installed_file) else {
        return;
    };
    let Ok(mut metadata) = serde_json::from_str::<serde_json::Value>(&content) else {
        return;
    };
    let Some(obj) = metadata.as_object_mut() else {
        return;
    };
    obj.insert("version".into(), env!("CARGO_PKG_VERSION").into());
    obj.insert("updatedAt".into(), crate::chrono_now().into());

    let tmp_file = install_dir.join(".installed.json.tmp");
    if fs::write(&tmp_file, metadata.to_string()).is_ok() {
        let _ = fs::rename(&tmp_file, &installed_file);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn test_is_update_handoff_matches_tauri_updater_args() {
        // Lo que pasa tauri-plugin-updater 2.11 a un instalador .exe (installMode passive)
        assert!(is_update_handoff(&args(&[
            "C:\\Temp\\CrystalTides Launcher Lite-0.2.0-installer.exe",
            "/P",
            "/UPDATE",
            "/R",
            "/ARGS"
        ])));
        assert!(is_update_handoff(&args(&["launcher.exe", "--update"])));
        assert!(!is_update_handoff(&args(&["launcher.exe"])));
        assert!(!is_update_handoff(&args(&["launcher.exe", "--install"])));
        // argv[0] nunca cuenta, aunque la ruta contenga "update"
        assert!(!is_update_handoff(&args(&["/update"])));
    }

    #[test]
    fn test_replace_installed_binary_creates_and_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        let new_exe = dir.path().join("CrystalTides-Setup.exe");
        let target = dir
            .path()
            .join("install")
            .join("bin")
            .join(INSTALLED_EXE_NAME);
        fs::write(&new_exe, b"v2").unwrap();

        replace_installed_binary(&new_exe, &target, 1, Duration::ZERO).unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"v2");

        fs::write(&new_exe, b"v3").unwrap();
        replace_installed_binary(&new_exe, &target, 1, Duration::ZERO).unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"v3");
        assert!(!target.with_extension("exe.new").exists());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_replace_installed_binary_waits_for_locked_target() {
        use std::os::windows::fs::OpenOptionsExt;

        let dir = tempfile::tempdir().unwrap();
        let new_exe = dir.path().join("new.exe");
        let target = dir.path().join(INSTALLED_EXE_NAME);
        fs::write(&new_exe, b"new").unwrap();
        fs::write(&target, b"old").unwrap();

        // Sin compartir: simula el launcher viejo aún en ejecución
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&target)
            .unwrap();
        let releaser = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(400));
            drop(lock);
        });

        replace_installed_binary(&new_exe, &target, 40, Duration::from_millis(50)).unwrap();
        releaser.join().unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"new");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_replace_installed_binary_gives_up_and_cleans_staging() {
        use std::os::windows::fs::OpenOptionsExt;

        let dir = tempfile::tempdir().unwrap();
        let new_exe = dir.path().join("new.exe");
        let target = dir.path().join(INSTALLED_EXE_NAME);
        fs::write(&new_exe, b"new").unwrap();
        fs::write(&target, b"old").unwrap();
        let _lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&target)
            .unwrap();

        assert!(replace_installed_binary(&new_exe, &target, 3, Duration::from_millis(10)).is_err());
        assert!(!target.with_extension("exe.new").exists());
    }

    #[test]
    fn test_stamp_installed_version_preserves_other_fields() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join(".installed.json");
        fs::write(
            &file,
            r#"{"installed":true,"version":"0.0.1","executable":"C:\\x\\bin\\CrystalTidesLauncher.exe"}"#,
        )
        .unwrap();

        stamp_installed_version(dir.path());

        let json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&file).unwrap()).unwrap();
        assert_eq!(json["version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(json["installed"], true);
        assert!(json["executable"]
            .as_str()
            .unwrap()
            .ends_with("CrystalTidesLauncher.exe"));
        assert!(json.get("updatedAt").is_some());
    }
}
