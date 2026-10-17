use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(any(target_os = "linux", test))]
mod desktop_entry;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

pub fn get_default_install_dir() -> Option<PathBuf> {
    if let Some(custom) = std::env::var_os("CRYSTALTIDES_HOME") {
        let trimmed = custom.to_string_lossy().trim().to_string();
        if !trimmed.is_empty() {
            return Some(PathBuf::from(trimmed));
        }
    }
    dirs::home_dir().map(|home| home.join(".crystaltides"))
}

#[cfg(not(target_os = "windows"))]
pub fn get_registered_install_location() -> Option<PathBuf> {
    None
}

pub fn is_app_installed(install_dir: &Path) -> bool {
    let metadata_file = install_dir.join(".installed.json");
    if metadata_file.exists() {
        return true;
    }

    #[cfg(target_os = "windows")]
    {
        install_dir.join("bin/CrystalTidesLauncher.exe").exists()
            || install_dir.join("CrystalTidesLauncher.exe").exists()
    }

    #[cfg(not(target_os = "windows"))]
    {
        install_dir.join("bin/CrystalTidesLauncher").exists()
            || install_dir.join("CrystalTidesLauncher").exists()
    }
}

#[cfg(not(target_os = "windows"))]
pub fn add_defender_exclusion(_folder_path: &Path) -> Result<(), String> {
    Ok(())
}

/// El registro del sistema (clave de desinstalación y accesos directos) es único y global.
/// Una instalación solo puede retirarlo si es la registrada (o si no hay ninguna registrada),
/// para que desinstalar una copia secundaria o aislada no desregistre la principal.
pub(crate) fn owns_system_registration(install_dir: &Path, registered: Option<&Path>) -> bool {
    registered.is_none_or(|registered| same_dir(install_dir, registered))
}

fn same_dir(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => {
            let normalize = |p: &Path| {
                p.to_string_lossy()
                    .replace('\\', "/")
                    .trim_end_matches('/')
                    .to_lowercase()
            };
            normalize(a) == normalize(b)
        }
    }
}

pub(crate) fn cleanup_install_dir(install_dir: &Path, remove_user_data: bool) {
    if !install_dir.exists() {
        return;
    }

    let _ = std::fs::remove_file(install_dir.join(".installed.json"));

    if remove_user_data {
        let dirs_to_remove = [
            "mods",
            "profiles",
            "runtimes",
            "assets",
            "logs",
            "versions",
            "libraries",
            "natives",
            ".temp",
        ];
        for d in &dirs_to_remove {
            let _ = std::fs::remove_dir_all(install_dir.join(d));
        }

        let files_to_remove = [
            "crystaltides.db",
            "crystaltides.db-wal",
            "crystaltides.db-shm",
            "hardware_config.json",
            "game-bridge.jar",
            "ct-agent.dll",
        ];
        for f in &files_to_remove {
            let _ = std::fs::remove_file(install_dir.join(f));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_owns_system_registration() {
        let installed = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();

        assert!(owns_system_registration(installed.path(), None));
        assert!(owns_system_registration(
            installed.path(),
            Some(installed.path())
        ));
        assert!(!owns_system_registration(
            installed.path(),
            Some(other.path())
        ));

        // Mismo directorio escrito distinto (separadores, barra final, mayúsculas, inexistente)
        let a = Path::new("C:\\Users\\Someone\\.crystaltides\\");
        let b = Path::new("c:/users/someone/.crystaltides");
        assert!(owns_system_registration(a, Some(b)));
    }
}
