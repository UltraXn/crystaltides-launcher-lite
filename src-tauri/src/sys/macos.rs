use std::fs;
use std::path::Path;
use std::process::Command;

pub fn register_system_app(target_exe: &Path, install_dir: &Path, _create_desktop_shortcut: bool) -> Result<(), String> {
    let _ = Command::new("chmod")
        .args(["+x", &target_exe.to_string_lossy()])
        .output();

    let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine", &install_dir.to_string_lossy()])
        .output();

    Ok(())
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    // 1. Limpieza de archivos en disco (conservando datos de usuario si remove_user_data es false)
    super::cleanup_install_dir(install_dir, remove_user_data);

    // 2. Limpieza de bundle de macOS si existiera
    if let Some(home) = dirs::home_dir() {
        let app_bundle = home.join("Applications/CrystalTides Launcher.app");
        if app_bundle.exists() {
            let _ = fs::remove_dir_all(app_bundle);
        }
    }

    Ok(())
}

pub fn schedule_self_deletion(target_dir: &Path) -> Result<(), String> {
    let bin_dir = target_dir.join("bin");
    let root_exe = target_dir.join("CrystalTidesLauncher");

    let bin_dir_str = bin_dir.to_string_lossy().to_string();
    let root_exe_str = root_exe.to_string_lossy().to_string();
    let target_dir_str = target_dir.to_string_lossy().to_string();

    let script = "sleep 2; \
        [ -d \"$1\" ] && rm -rf -- \"$1\"; \
        [ -f \"$2\" ] && rm -f -- \"$2\"; \
        [ -d \"$3\" ] && rmdir \"$3\" 2>/dev/null || true";

    let _ = Command::new("sh")
        .args(["-c", script, "self_delete"])
        .arg(&bin_dir_str)
        .arg(&root_exe_str)
        .arg(&target_dir_str)
        .spawn();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_schedule_self_deletion_handles_special_characters() {
        let path = std::path::PathBuf::from("/tmp/test_dir_with \"quotes\" & $vars");
        assert!(schedule_self_deletion(&path).is_ok());
    }
}
