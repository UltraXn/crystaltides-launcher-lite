use std::fs;
use std::path::Path;
use std::process::Command;

pub fn register_system_app(target_exe: &Path, install_dir: &Path) -> Result<(), String> {
    if let Some(home) = dirs::home_dir() {
        let desktop_dir = home.join(".local/share/applications");
        let _ = fs::create_dir_all(&desktop_dir);
        let desktop_file = desktop_dir.join("crystaltides-launcher.desktop");
        let content = format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Name=CrystalTides Launcher\n\
             GenericName=Minecraft Launcher\n\
             Comment=CrystalTides Launcher - Papyrus Edition\n\
             Exec=\"{}\"\n\
             Path=\"{}\"\n\
             Terminal=false\n\
             Categories=Game;ActionGame;\n\
             StartupWMClass=net.crystaltides.launcher\n",
            target_exe.to_string_lossy(),
            install_dir.to_string_lossy()
        );
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
