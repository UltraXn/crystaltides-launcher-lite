use std::fs;
use std::path::Path;
use std::process::Command;

pub fn register_system_app(target_exe: &Path, install_dir: &Path) -> Result<(), String> {
    let target_exe_str = target_exe.to_string_lossy().replace('\\', "/");
    let install_dir_str = install_dir.to_string_lossy().replace('\\', "/");

    // 1. Accesos directos (.lnk) en Escritorio y Menú Inicio
    let shortcut_ps = format!(
        "$WshShell = New-Object -ComObject WScript.Shell; \
         $DesktopPath = [Environment]::GetFolderPath('Desktop'); \
         $Shortcut = $WshShell.CreateShortcut(\"$DesktopPath\\CrystalTides Launcher.lnk\"); \
         $Shortcut.TargetPath = \"{}\"; \
         $Shortcut.WorkingDirectory = \"{}\"; \
         $Shortcut.Description = \"CrystalTides Launcher (Papyrus Edition)\"; \
         $Shortcut.Save(); \
         $StartMenuPath = [Environment]::GetFolderPath('StartMenu'); \
         $ProgramDir = \"$StartMenuPath\\Programs\\CrystalTides\"; \
         if (!(Test-Path $ProgramDir)) {{ New-Item -ItemType Directory -Path $ProgramDir -Force | Out-Null }}; \
         $ShortcutSM = $WshShell.CreateShortcut(\"$ProgramDir\\CrystalTides Launcher.lnk\"); \
         $ShortcutSM.TargetPath = \"{}\"; \
         $ShortcutSM.WorkingDirectory = \"{}\"; \
         $ShortcutSM.Description = \"CrystalTides Launcher (Papyrus Edition)\"; \
         $ShortcutSM.Save()",
        target_exe_str, install_dir_str, target_exe_str, install_dir_str
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &shortcut_ps])
        .output();

    // 2. Registro oficial de Windows (Panel de Control y Configuración > Aplicaciones)
    let reg_ps = format!(
        "$registryPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus'; \
         if (!(Test-Path $registryPath)) {{ New-Item -Path $registryPath -Force | Out-Null }}; \
         New-ItemProperty -Path $registryPath -Name 'DisplayName' -Value 'CrystalTides Launcher - Papyrus Edition' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'DisplayIcon' -Value '{},0' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'Publisher' -Value 'CrystalTides' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'InstallLocation' -Value '{}' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'UninstallString' -Value '\"{}\" --uninstall' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'QuietUninstallString' -Value '\"{}\" --uninstall --silent' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'DisplayVersion' -Value '1.0.0' -PropertyType String -Force | Out-Null; \
         New-ItemProperty -Path $registryPath -Name 'URLInfoAbout' -Value 'https://crystaltides.net' -PropertyType String -Force | Out-Null",
        target_exe_str, install_dir_str, target_exe_str, target_exe_str
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &reg_ps])
        .output();

    Ok(())
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    // 1. Eliminar entradas de registro
    let reg_ps = "$ErrorActionPreference = 'SilentlyContinue'; \
         Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus' -Recurse -Force; \
         Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncher' -Recurse -Force; \
         Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CTLauncher' -Recurse -Force";

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", reg_ps])
        .output();

    // 2. Eliminar accesos directos
    let shortcut_ps = "$ErrorActionPreference = 'SilentlyContinue'; \
         $Desktop = [Environment]::GetFolderPath('Desktop'); \
         $StartMenu = [Environment]::GetFolderPath('StartMenu'); \
         Remove-Item (Join-Path $Desktop 'CrystalTides Launcher.lnk') -Force; \
         Remove-Item (Join-Path $Desktop 'CTLauncher.lnk') -Force; \
         Remove-Item (Join-Path $StartMenu 'Programs\\CrystalTides') -Recurse -Force";

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", shortcut_ps])
        .output();

    // 3. Limpieza de archivos en disco
    if install_dir.exists() {
        if remove_user_data {
            let _ = fs::remove_dir_all(install_dir.join("mods"));
            let _ = fs::remove_dir_all(install_dir.join("profiles"));
            let _ = fs::remove_dir_all(install_dir.join("runtimes"));
            let _ = fs::remove_dir_all(install_dir.join("assets"));
            let _ = fs::remove_file(install_dir.join(".installed.json"));
        } else {
            let _ = fs::remove_file(install_dir.join(".installed.json"));
        }
    }

    Ok(())
}

pub fn schedule_self_deletion(target_dir: &Path) -> Result<(), String> {
    let escaped = target_dir.to_string_lossy().replace('"', "\"\"");
    let script = format!(
        "Start-Sleep -Seconds 2; Remove-Item -LiteralPath \"{}\" -Recurse -Force -ErrorAction SilentlyContinue",
        escaped
    );

    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .spawn();

    Ok(())
}
