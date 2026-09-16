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
    dirs::home_dir().map(|home| {
        #[cfg(target_os = "windows")]
        {
            home.join(".crystaltides")
        }

        #[cfg(target_os = "linux")]
        {
            home.join(".local/share/crystaltides-papyrus")
        }

        #[cfg(target_os = "macos")]
        {
            home.join("Applications/CrystalTides")
        }

        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            home.join(".crystaltides")
        }
    })
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
