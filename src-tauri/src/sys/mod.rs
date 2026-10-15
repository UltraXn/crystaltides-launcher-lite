use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

pub fn get_default_install_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".crystaltides"))
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
mod sys_tests {
    use super::*;

    #[test]
    fn test_sanitize_windows_path_string() {
        let raw_path = "C:/Program Files/CrystalTides/Launcher.exe";
        let cleaned = raw_path.replace('/', "\\");
        assert_eq!(cleaned, r"C:\Program Files\CrystalTides\Launcher.exe");
    }

    #[test]
    fn test_strip_unc_prefix() {
        let path_str = r"\\?\C:\Users\Test\AppData\Local\CrystalTides";
        let clean = path_str.strip_prefix(r"\\?\").unwrap_or(path_str).replace('/', "\\");
        assert_eq!(clean, r"C:\Users\Test\AppData\Local\CrystalTides");
    }
}
