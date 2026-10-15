use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[allow(dead_code)]
fn set_registry_uninstall_entries(target_exe_clean: &str, install_dir_clean: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, REG_SZ,
    };

    let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus\0"
        .encode_utf16()
        .collect();

    let write_val = |hkey: HKEY, name: &str, value: &str| {
        let name_utf16: Vec<u16> = format!("{}\0", name).encode_utf16().collect();
        let val_utf16: Vec<u16> = format!("{}\0", value).encode_utf16().collect();
        let bytes = unsafe {
            std::slice::from_raw_parts(
                val_utf16.as_ptr() as *const u8,
                val_utf16.len() * std::mem::size_of::<u16>(),
            )
        };
        unsafe {
            let _ = RegSetValueExW(
                hkey,
                PCWSTR(name_utf16.as_ptr()),
                0,
                REG_SZ,
                Some(bytes),
            );
        }
    };

    unsafe {
        let mut hkey = HKEY::default();
        let res = RegCreateKeyW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()), &mut hkey);
        if res.is_ok() && !hkey.is_invalid() {
            write_val(hkey, "DisplayName", "CrystalTides Launcher - Papyrus Edition");
            write_val(hkey, "DisplayIcon", &format!("{},0", target_exe_clean));
            write_val(hkey, "Publisher", "CrystalTides");
            write_val(hkey, "InstallLocation", install_dir_clean);
            write_val(hkey, "UninstallString", &format!("\"{}\" --uninstall", target_exe_clean));
            write_val(hkey, "QuietUninstallString", &format!("\"{}\" --uninstall --silent", target_exe_clean));
            write_val(hkey, "DisplayVersion", "1.0.0");
            write_val(hkey, "URLInfoAbout", "https://crystaltides.net");
            let _ = RegCloseKey(hkey);
            Ok(())
        } else {
            Err("Fallo al crear la entrada de registro de desinstalación.".to_string())
        }
    }
}

#[allow(dead_code)]
fn delete_registry_uninstall_entries() {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{RegDeleteTreeW, HKEY_CURRENT_USER};

    let keys = [
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus\0",
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncher\0",
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CTLauncher\0",
    ];

    for k in keys {
        let subkey: Vec<u16> = k.encode_utf16().collect();
        unsafe {
            let _ = RegDeleteTreeW(HKEY_CURRENT_USER, PCWSTR(subkey.as_ptr()));
        }
    }
}

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
        if (!(Test-Path -LiteralPath $ProgramDir)) { New-Item -ItemType Directory -Path $ProgramDir -Force | Out-Null }; \
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

    // 2. Registro oficial de Windows nativo (Panel de Control y Configuración > Aplicaciones)
    set_registry_uninstall_entries(&target_exe_clean, &install_dir_clean)?;

    Ok(())
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    // 1. Eliminar entradas de registro nativas
    delete_registry_uninstall_entries();

    // 2. Eliminar accesos directos
    let shortcut_ps = "$ErrorActionPreference = 'SilentlyContinue'; \
         $Desktop = [Environment]::GetFolderPath('Desktop'); \
         $StartMenu = [Environment]::GetFolderPath('StartMenu'); \
         Remove-Item -LiteralPath (Join-Path $Desktop 'CrystalTides Launcher.lnk') -Force -ErrorAction SilentlyContinue; \
         Remove-Item -LiteralPath (Join-Path $Desktop 'CTLauncher.lnk') -Force -ErrorAction SilentlyContinue; \
         $ProgramDir = Join-Path $StartMenu 'Programs\\CrystalTides'; \
         if (Test-Path -LiteralPath $ProgramDir) { Remove-Item -LiteralPath $ProgramDir -Recurse -Force -ErrorAction SilentlyContinue }";

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
            $cmd = 'Add-MpPreference -ExclusionPath $env:CT_EXCLUSION_PATH'; \
            $p = Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', $cmd) -Wait -PassThru -ErrorAction Stop; \
            if ($p.ExitCode -ne 0) { [Environment]::Exit($p.ExitCode) } \
        } catch { \
            [Environment]::Exit(1) \
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_path_clean_formatting() {
        let raw_path = Path::new("C:/Program Files/CrystalTides/Launcher.exe");
        let cleaned = raw_path.to_string_lossy().replace('/', "\\");
        assert_eq!(cleaned, r"C:\Program Files\CrystalTides\Launcher.exe");
        assert!(!cleaned.contains('/'));
    }

    #[test]
    fn test_defender_exclusion_path_stripping() {
        let path_str = r"\\?\C:\Users\Test\AppData\Local\CrystalTides";
        let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(path_str).replace('/', "\\");
        assert_eq!(clean_path, r"C:\Users\Test\AppData\Local\CrystalTides");
    }
}
