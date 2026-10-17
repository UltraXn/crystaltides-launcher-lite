use std::fs;
use std::path::Path;
use std::process::Command;

pub fn register_system_app(
    target_exe: &Path,
    install_dir: &Path,
    _create_desktop_shortcut: bool,
) -> Result<(), String> {
    if let Some(home) = dirs::home_dir() {
        let desktop_dir = home.join(".local/share/applications");
        let _ = fs::create_dir_all(&desktop_dir);
        let desktop_file = desktop_dir.join("crystaltides-launcher.desktop");
        let content = super::desktop_entry::render(target_exe, install_dir);
        let _ = fs::write(&desktop_file, content);

        let _ = Command::new("chmod")
            .args(["+x", &target_exe.to_string_lossy()])
            .output();

        let _ = Command::new("update-desktop-database")
            .arg(desktop_dir.to_string_lossy().to_string())
            .output();
    }
    Ok(())
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    if let Some(home) = dirs::home_dir() {
        let desktop_app = home.join(".local/share/applications/crystaltides-launcher.desktop");
        let desktop_user = home.join("Desktop/crystaltides-launcher.desktop");
        let _ = fs::remove_file(desktop_app);
        let _ = fs::remove_file(desktop_user);
    }

    super::cleanup_install_dir(install_dir, remove_user_data);

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
