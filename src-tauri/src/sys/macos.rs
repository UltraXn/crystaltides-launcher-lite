use std::fs;
use std::path::Path;
use std::process::Command;

pub fn register_system_app(target_exe: &Path, install_dir: &Path) -> Result<(), String> {
    let _ = Command::new("chmod")
        .args(["+x", &target_exe.to_string_lossy()])
        .output();

    let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine", &install_dir.to_string_lossy()])
        .output();

    Ok(())
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    if let Some(home) = dirs::home_dir() {
        let app_bundle = home.join("Applications/CrystalTides Launcher.app");
        let _ = fs::remove_dir_all(app_bundle);
    }

    if install_dir.exists() && remove_user_data {
        let _ = fs::remove_dir_all(install_dir);
    }

    Ok(())
}

pub fn schedule_self_deletion(target_dir: &Path) -> Result<(), String> {
    let escaped = target_dir.to_string_lossy().replace('"', "\\\"");
    let script = format!("sleep 2 && rm -rf \"{}\"", escaped);
    let _ = Command::new("sh")
        .args(["-c", &script])
        .spawn();

    Ok(())
}
