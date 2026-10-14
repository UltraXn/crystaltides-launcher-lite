use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn register_system_app(target_exe: &Path, install_dir: &Path, create_desktop_shortcut: bool) -> Result<(), String> {
    let target_exe_clean = target_exe.to_string_lossy().replace('/', "\\");
    let install_dir_clean = install_dir.to_string_lossy().replace('/', "\\");

    // 1. Accesos directos (.lnk) en Escritorio y Menú Inicio con WScript.Shell
    let shortcut_ps = "\
        $WshShell = New-Object -ComObject WScript.Shell; \
        if ($env:CT_CREATE_DESKTOP -eq '1') { \
            $DesktopPath = [Environment]::GetFolderPath('Desktop'); \
            $Shortcut = $WshShell.CreateShortcut((Join-Path $DesktopPath 'CrystalTides Launcher.lnk')); \
            $Shortcut.TargetPath = $env:CT_EXE_PATH; \
            $Shortcut.WorkingDirectory = $env:CT_WORK_DIR; \
            $Shortcut.Description = 'CrystalTides Launcher (Papyrus Edition)'; \
            $Shortcut.Save(); \
        }; \
        $StartMenuPath = [Environment]::GetFolderPath('StartMenu'); \
        $ProgramDir = Join-Path $StartMenuPath 'Programs\\CrystalTides'; \
        if (!(Test-Path $ProgramDir)) { New-Item -ItemType Directory -Path $ProgramDir -Force | Out-Null }; \
        $ShortcutSM = $WshShell.CreateShortcut((Join-Path $ProgramDir 'CrystalTides Launcher.lnk')); \
        $ShortcutSM.TargetPath = $env:CT_EXE_PATH; \
        $ShortcutSM.WorkingDirectory = $env:CT_WORK_DIR; \
        $ShortcutSM.Description = 'CrystalTides Launcher (Papyrus Edition)'; \
        $ShortcutSM.Save();";

    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            shortcut_ps,
        ])
        .env("CT_EXE_PATH", &target_exe_clean)
        .env("CT_WORK_DIR", &install_dir_clean)
        .env("CT_CREATE_DESKTOP", if create_desktop_shortcut { "1" } else { "0" })
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // 2. Registro oficial de Windows (Panel de Control y Configuración > Aplicaciones)
    let reg_ps = "\
        $registryPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus'; \
        if (!(Test-Path $registryPath)) { New-Item -Path $registryPath -Force | Out-Null }; \
        New-ItemProperty -Path $registryPath -Name 'DisplayName' -Value 'CrystalTides Launcher - Papyrus Edition' -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'DisplayIcon' -Value \"$($env:CT_EXE_PATH),0\" -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'Publisher' -Value 'CrystalTides' -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'InstallLocation' -Value $env:CT_INSTALL_DIR -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'UninstallString' -Value \"`\"$($env:CT_EXE_PATH)`\" --uninstall\" -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'QuietUninstallString' -Value \"`\"$($env:CT_EXE_PATH)`\" --uninstall --silent\" -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'DisplayVersion' -Value '1.0.0' -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'URLInfoAbout' -Value 'https://crystaltides.net' -PropertyType String -Force | Out-Null;";

    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            reg_ps,
        ])
        .env("CT_EXE_PATH", &target_exe_clean)
        .env("CT_INSTALL_DIR", &install_dir_clean)
        .creation_flags(CREATE_NO_WINDOW)
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
        .creation_flags(CREATE_NO_WINDOW)
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
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // 3. Limpieza de archivos en disco (conservando datos de usuario si remove_user_data es false)
    super::cleanup_install_dir(install_dir, remove_user_data);

    Ok(())
}

pub fn schedule_self_deletion(target_dir: &Path) -> Result<(), String> {
    let bin_dir = target_dir.join("bin");
    let root_exe = target_dir.join("CrystalTidesLauncher.exe");

    let bin_dir_clean = bin_dir.to_string_lossy().replace('/', "\\");
    let root_exe_clean = root_exe.to_string_lossy().replace('/', "\\");
    let target_dir_clean = target_dir.to_string_lossy().replace('/', "\\");

    let script = "\
        Start-Sleep -Seconds 2; \
        if (Test-Path -LiteralPath $env:CT_BIN_DIR) { Remove-Item -LiteralPath $env:CT_BIN_DIR -Recurse -Force -ErrorAction SilentlyContinue }; \
        if (Test-Path -LiteralPath $env:CT_ROOT_EXE) { Remove-Item -LiteralPath $env:CT_ROOT_EXE -Force -ErrorAction SilentlyContinue }; \
        if (Test-Path -LiteralPath $env:CT_ROOT_DIR) { \
            $items = Get-ChildItem -LiteralPath $env:CT_ROOT_DIR -Force -ErrorAction SilentlyContinue; \
            if ($null -eq $items -or $items.Count -eq 0) { \
                Remove-Item -LiteralPath $env:CT_ROOT_DIR -Force -ErrorAction SilentlyContinue \
            } \
        }";

    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env("CT_BIN_DIR", &bin_dir_clean)
        .env("CT_ROOT_EXE", &root_exe_clean)
        .env("CT_ROOT_DIR", &target_dir_clean)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();

    Ok(())
}

pub fn add_defender_exclusion(folder_path: &Path) -> Result<(), String> {
    if !folder_path.exists() {
        return Err("El directorio a excluir de Windows Defender no existe.".to_string());
    }

    let canonical = folder_path.canonicalize().map_err(|e| format!("Ruta inválida: {}", e))?;
    let path_str = canonical.to_string_lossy();
    let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str).replace('/', "\\");

    let script = "\
        try { \
            $esc = $env:CT_EXCLUSION_PATH.Replace('''', ''''''); \
            $cmd = \"Add-MpPreference -ExclusionPath '$esc'\"; \
            $p = Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', $cmd) -Wait -PassThru -ErrorAction Stop; \
            if ($p.ExitCode -ne 0) { exit $p.ExitCode } \
        } catch { \
            exit 1 \
        }";

    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env("CT_EXCLUSION_PATH", &clean_path)
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("Error ejecutando PowerShell para Windows Defender: {}", e))?;

    if status.success() {
        crate::logger::log(
            "INFO",
            "Sys",
            &format!("Exclusión de Windows Defender añadida para: {}", clean_path),
        );
        Ok(())
    } else {
        Err("El usuario canceló la elevación o falló el comando de exclusión de Defender".to_string())
    }
}
