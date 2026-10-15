use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn encode_base64(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut buf = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triplet = (b0 << 16) | (b1 << 8) | b2;

        buf.push(CHARSET[((triplet >> 18) & 0x3F) as usize] as char);
        buf.push(CHARSET[((triplet >> 12) & 0x3F) as usize] as char);

        if chunk.len() > 1 {
            buf.push(CHARSET[((triplet >> 6) & 0x3F) as usize] as char);
        } else {
            buf.push('=');
        }

        if chunk.len() > 2 {
            buf.push(CHARSET[(triplet & 0x3F) as usize] as char);
        } else {
            buf.push('=');
        }
    }
    buf
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

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        shortcut_ps,
    ])
    .env("CT_EXE_PATH", &target_exe_clean)
    .env("CT_WORK_DIR", &install_dir_clean)
    .env("CT_CREATE_DESKTOP", if create_desktop_shortcut { "1" } else { "0" });

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = cmd.output();

    // 2. Registro oficial de Windows (Panel de Control y Configuración > Aplicaciones)
    let reg_ps = "\
        $registryPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus'; \
        if (!(Test-Path -LiteralPath $registryPath)) { New-Item -Path $registryPath -Force | Out-Null }; \
        New-ItemProperty -Path $registryPath -Name 'DisplayName' -Value 'CrystalTides Launcher - Papyrus Edition' -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'DisplayIcon' -Value ($env:CT_EXE_PATH + ',0') -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'Publisher' -Value 'CrystalTides' -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'InstallLocation' -Value $env:CT_INSTALL_DIR -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'UninstallString' -Value ('\"' + $env:CT_EXE_PATH + '\" --uninstall') -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'QuietUninstallString' -Value ('\"' + $env:CT_EXE_PATH + '\" --uninstall --silent') -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'DisplayVersion' -Value '1.0.0' -PropertyType String -Force | Out-Null; \
        New-ItemProperty -Path $registryPath -Name 'URLInfoAbout' -Value 'https://crystaltides.net' -PropertyType String -Force | Out-Null;";

    let mut reg_cmd = Command::new("powershell");
    reg_cmd.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        reg_ps,
    ])
    .env("CT_EXE_PATH", &target_exe_clean)
    .env("CT_INSTALL_DIR", &install_dir_clean);

    #[cfg(target_os = "windows")]
    reg_cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = reg_cmd.output();

    Ok(())
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    // 1. Eliminar entradas de registro
    let reg_ps = "$ErrorActionPreference = 'SilentlyContinue'; \
         Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus' -Recurse -Force; \
         Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncher' -Recurse -Force; \
         Remove-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CTLauncher' -Recurse -Force";

    let mut reg_cmd = Command::new("powershell");
    reg_cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", reg_ps]);

    #[cfg(target_os = "windows")]
    reg_cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = reg_cmd.output();

    // 2. Eliminar accesos directos
    let shortcut_ps = "$ErrorActionPreference = 'SilentlyContinue'; \
         $Desktop = [Environment]::GetFolderPath('Desktop'); \
         $StartMenu = [Environment]::GetFolderPath('StartMenu'); \
         Remove-Item -LiteralPath (Join-Path $Desktop 'CrystalTides Launcher.lnk') -Force; \
         Remove-Item -LiteralPath (Join-Path $Desktop 'CTLauncher.lnk') -Force; \
         Remove-Item -LiteralPath (Join-Path $StartMenu 'Programs\\CrystalTides') -Recurse -Force";

    let mut shortcut_cmd = Command::new("powershell");
    shortcut_cmd.args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", shortcut_ps]);

    #[cfg(target_os = "windows")]
    shortcut_cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = shortcut_cmd.output();

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

    let mut cmd = Command::new("powershell");
    cmd.args([
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
    .env("CT_ROOT_DIR", &target_dir_clean);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = cmd.spawn();

    Ok(())
}

pub fn build_defender_exclusion_script(clean_path: &str) -> String {
    let b64 = encode_base64(clean_path.as_bytes());
    format!(
        "try {{ \
            $p = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{b64}')); \
            $innerScript = '$p = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(''{b64}'')); Add-MpPreference -ExclusionPath $p'; \
            $bytes = [System.Text.Encoding]::Unicode.GetBytes($innerScript); \
            $encoded = [System.Convert]::ToBase64String($bytes); \
            $proc = Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', $encoded) -Wait -PassThru -ErrorAction Stop; \
            if ($proc.ExitCode -ne 0) {{ [Environment]::Exit($proc.ExitCode) }} \
        }} catch {{ \
            [Environment]::Exit(1) \
        }}",
        b64 = b64
    )
}

pub fn add_defender_exclusion(folder_path: &Path) -> Result<(), String> {
    if !folder_path.exists() {
        return Err("El directorio a excluir de Windows Defender no existe.".to_string());
    }

    let canonical = folder_path.canonicalize().map_err(|e| format!("Ruta inválida: {}", e))?;
    let path_str = canonical.to_string_lossy();
    let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str).replace('/', "\\");

    let script = build_defender_exclusion_script(&clean_path);

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        &script,
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd
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
    fn test_encode_base64() {
        assert_eq!(encode_base64(b""), "");
        assert_eq!(encode_base64(b"f"), "Zg==");
        assert_eq!(encode_base64(b"fo"), "Zm8=");
        assert_eq!(encode_base64(b"foo"), "Zm9v");
        assert_eq!(encode_base64(b"C:\\Program Files\\CrystalTides"), "QzpcUHJvZ3JhbSBGaWxlc1xDcnlzdGFsVGlkZXM=");
    }

    #[test]
    fn test_build_defender_exclusion_script_no_injection() {
        let malicious_path = r#"C:\Games\Minecraft'; Start-Process calc; '"#;
        let script = build_defender_exclusion_script(malicious_path);

        let expected_b64 = encode_base64(malicious_path.as_bytes());
        assert!(script.contains(&expected_b64));
        assert!(!script.contains(r#"ExclusionPath 'C:\Games\Minecraft'"#));
    }

    #[test]
    fn test_build_defender_exclusion_script_with_special_characters() {
        let special_path = r#"C:\Users\User\App Data\$(calc.exe)`\"' ; &"#;
        let script = build_defender_exclusion_script(special_path);

        let expected_b64 = encode_base64(special_path.as_bytes());
        assert!(script.contains(&expected_b64));
        assert!(!script.contains("calc.exe"));
    }
}
