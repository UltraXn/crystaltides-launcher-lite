use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;
use windows::core::{Interface, PCWSTR};
use windows::Win32::Foundation::BOOL;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyW, RegDeleteKeyW, RegOpenKeyW, RegQueryValueExW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, REG_SZ, REG_VALUE_TYPE,
};
use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

struct ComScope;

impl ComScope {
    // SAFETY: Inicializa la biblioteca COM para el hilo actual en modo Single-Threaded Apartment (STA).
    #[allow(unsafe_code)]
    fn new() -> Self {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        }
        ComScope
    }
}

impl Drop for ComScope {
    #[allow(unsafe_code)]
    fn drop(&mut self) {
        // SAFETY: CoUninitialize debe ser llamado de forma balanceada con CoInitializeEx para liberar recursos COM.
        unsafe {
            CoUninitialize();
        }
    }
}

#[allow(unsafe_code)]
fn create_native_shortcut(
    target_exe: &Path,
    work_dir: &Path,
    lnk_path: &Path,
    description: &str,
) -> Result<(), String> {
    let _com = ComScope::new();

    // SAFETY: CoCreateInstance crea la instancia COM de ShellLink. Los punteros UTF-16 pasados a los métodos
    // de IShellLinkW y IPersistFile están garantizados con terminación nula y longitud fija durante la llamada.
    unsafe {
        let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("Error inicializando IShellLinkW: {}", e))?;

        let exe_str = target_exe.to_string_lossy().replace('/', "\\");
        let dir_str = work_dir.to_string_lossy().replace('/', "\\");
        let lnk_str = lnk_path.to_string_lossy().replace('/', "\\");

        let exe_u16: Vec<u16> = format!("{}\0", exe_str).encode_utf16().collect();
        let dir_u16: Vec<u16> = format!("{}\0", dir_str).encode_utf16().collect();
        let desc_u16: Vec<u16> = format!("{}\0", description).encode_utf16().collect();
        let lnk_u16: Vec<u16> = format!("{}\0", lnk_str).encode_utf16().collect();

        shell_link
            .SetPath(PCWSTR(exe_u16.as_ptr()))
            .map_err(|e| format!("Error en SetPath para acceso directo: {}", e))?;
        shell_link
            .SetWorkingDirectory(PCWSTR(dir_u16.as_ptr()))
            .map_err(|e| format!("Error en SetWorkingDirectory: {}", e))?;
        shell_link
            .SetDescription(PCWSTR(desc_u16.as_ptr()))
            .map_err(|e| format!("Error en SetDescription: {}", e))?;

        let persist_file: IPersistFile = shell_link
            .cast()
            .map_err(|e| format!("Error convirtiendo a IPersistFile: {}", e))?;

        if let Some(parent) = lnk_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        persist_file
            .Save(PCWSTR(lnk_u16.as_ptr()), BOOL(1))
            .map_err(|e| format!("Error guardando archivo .lnk: {}", e))?;
    }
    Ok(())
}

#[allow(unsafe_code)]
fn write_uninstall_registry(target_exe: &Path, install_dir: &Path) -> Result<(), String> {
    let subkey_str =
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus\0";
    let subkey_utf16: Vec<u16> = subkey_str.encode_utf16().collect();

    let target_exe_clean = target_exe.to_string_lossy().replace('/', "\\");
    let install_dir_clean = install_dir.to_string_lossy().replace('/', "\\");

    // SAFETY: RegCreateKeyW y RegSetValueExW interactúan con el Registro de Windows del usuario actual (HKCU).
    // Los punteros UTF-16 están terminados en null y hkey se cierra de forma determinista con RegCloseKey.
    unsafe {
        let mut hkey = HKEY::default();
        let res = RegCreateKeyW(HKEY_CURRENT_USER, PCWSTR(subkey_utf16.as_ptr()), &mut hkey);

        if !res.is_ok() || hkey.is_invalid() {
            return Err(format!(
                "No se pudo crear o abrir clave de desinstalación en el Registro: {:?}",
                res
            ));
        }

        let set_value = |key: HKEY, name: &str, val: &str| -> Result<(), String> {
            let name_utf16: Vec<u16> = format!("{}\0", name).encode_utf16().collect();
            let val_utf16: Vec<u16> = format!("{}\0", val).encode_utf16().collect();
            let data_bytes = std::slice::from_raw_parts(
                val_utf16.as_ptr() as *const u8,
                val_utf16.len() * std::mem::size_of::<u16>(),
            );
            RegSetValueExW(
                key,
                PCWSTR(name_utf16.as_ptr()),
                0,
                REG_SZ,
                Some(data_bytes),
            )
            .ok()
            .map_err(|e| format!("Error en RegSetValueExW para {}: {}", name, e))
        };

        let _ = set_value(
            hkey,
            "DisplayName",
            "CrystalTides Launcher - Papyrus Edition",
        );
        let _ = set_value(hkey, "DisplayIcon", &format!("{},0", target_exe_clean));
        let _ = set_value(hkey, "Publisher", "CrystalTides");
        let _ = set_value(hkey, "InstallLocation", &install_dir_clean);
        let _ = set_value(
            hkey,
            "UninstallString",
            &format!("\"{}\" --uninstall", target_exe_clean),
        );
        let _ = set_value(
            hkey,
            "QuietUninstallString",
            &format!("\"{}\" --uninstall --silent", target_exe_clean),
        );
        let _ = set_value(hkey, "DisplayVersion", env!("CARGO_PKG_VERSION"));
        let _ = set_value(hkey, "URLInfoAbout", "https://crystaltides.net");

        let _ = RegCloseKey(hkey);
    }
    Ok(())
}

pub fn register_system_app(
    target_exe: &Path,
    install_dir: &Path,
    create_desktop_shortcut: bool,
) -> Result<(), String> {
    // 1. Accesos directos (.lnk) nativos en Escritorio y Menú Inicio mediante COM IShellLinkW
    if create_desktop_shortcut {
        if let Some(desktop) = dirs::desktop_dir() {
            let desktop_lnk = desktop.join("CrystalTides Launcher.lnk");
            let _ = create_native_shortcut(
                target_exe,
                install_dir,
                &desktop_lnk,
                "CrystalTides Launcher (Papyrus Edition)",
            );
        }
    }

    if let Some(data_dir) = dirs::data_dir() {
        let start_menu_programs = data_dir
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs")
            .join("CrystalTides");
        let start_menu_lnk = start_menu_programs.join("CrystalTides Launcher.lnk");
        let _ = create_native_shortcut(
            target_exe,
            install_dir,
            &start_menu_lnk,
            "CrystalTides Launcher (Papyrus Edition)",
        );
    }

    // 2. Registro oficial de Windows en HKCU (instantáneo vía Win32 Registry)
    write_uninstall_registry(target_exe, install_dir)?;

    crate::logger::log(
        "INFO",
        "Sys",
        &format!(
            "Aplicación registrada en el sistema de forma nativa: {:?}",
            target_exe
        ),
    );

    Ok(())
}

#[allow(unsafe_code)]
fn delete_uninstall_registry() {
    let parent_subkey = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\0";
    let parent_utf16: Vec<u16> = parent_subkey.encode_utf16().collect();

    // SAFETY: Apertura y eliminación de subclaves de desinstalación de CrystalTides en HKCU.
    // Todas las cadenas están terminadas en null y parent_hkey se cierra con RegCloseKey.
    unsafe {
        let mut parent_hkey = HKEY::default();
        if RegOpenKeyW(
            HKEY_CURRENT_USER,
            PCWSTR(parent_utf16.as_ptr()),
            &mut parent_hkey,
        )
        .is_ok()
            && !parent_hkey.is_invalid()
        {
            for sub in &[
                "CrystalTidesLauncherPapyrus",
                "CrystalTidesLauncher",
                "CTLauncher",
            ] {
                let sub_utf16: Vec<u16> = format!("{}\0", sub).encode_utf16().collect();
                let _ = RegDeleteKeyW(parent_hkey, PCWSTR(sub_utf16.as_ptr()));
            }
            let _ = RegCloseKey(parent_hkey);
        }
    }
}

fn delete_installed_shortcuts() {
    if let Some(desktop) = dirs::desktop_dir() {
        let _ = std::fs::remove_file(desktop.join("CrystalTides Launcher.lnk"));
        let _ = std::fs::remove_file(desktop.join("CTLauncher.lnk"));
    }
    if let Some(data_dir) = dirs::data_dir() {
        let start_menu_dir = data_dir
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        let _ = std::fs::remove_file(start_menu_dir.join("CrystalTides Launcher.lnk"));
        let _ = std::fs::remove_dir_all(start_menu_dir.join("CrystalTides"));
    }
}

pub fn unregister_system_app(install_dir: &Path, remove_user_data: bool) -> Result<(), String> {
    // 1-2. Registro y accesos directos: solo si pertenecen a esta instalación
    let registered = get_registered_install_location();
    if super::owns_system_registration(install_dir, registered.as_deref()) {
        delete_uninstall_registry();
        delete_installed_shortcuts();
    } else {
        crate::logger::log(
            "WARN",
            "Sys",
            &format!(
                "{:?} no es la instalación registrada ({:?}); se conservan registro y accesos directos.",
                install_dir, registered
            ),
        );
    }

    // 3. Limpieza de archivos en disco (conservando datos de usuario si remove_user_data es false)
    super::cleanup_install_dir(install_dir, remove_user_data);

    crate::logger::log(
        "INFO",
        "Sys",
        &format!(
            "Aplicación desregistrada del sistema nativamente: {:?}",
            install_dir
        ),
    );

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

/// Contenido de una cadena PowerShell entre comillas simples. PowerShell acepta como comilla
/// simple la ASCII y las tipográficas `‘ ’ ‚ ‛` (U+2018–U+201B); se duplican todas, como hace
/// `CodeGeneration.EscapeSingleQuotedStringContent`. Escapar solo `'` dejaba inyectar código en el
/// proceso elevado con una carpeta que contuviera `’`.
fn escape_ps_single_quoted(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        if matches!(c, '\'' | '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}') {
            out.push(c);
        }
        out.push(c);
    }
    out
}

/// Comando `<cmdlet> -ExclusionPath '<ruta>'` para el PowerShell elevado. Va como un único
/// argumento entre comillas dobles (`ELEVATED_ARG_LINE`), así que no puede contener `"`; una ruta
/// de Windows nunca lo tiene, pero se comprueba igualmente.
fn defender_exclusion_command(cmdlet: &str, path: &str) -> Result<String, String> {
    if path.contains('"') {
        return Err("Ruta inválida para la exclusión de Defender.".to_string());
    }
    Ok(format!(
        "{cmdlet} -ExclusionPath '{}'",
        escape_ps_single_quoted(path)
    ))
}

/// Línea de argumentos del PowerShell elevado, con `$env:CT_EXCLUSION_CMD` como un solo argumento
/// `-Command` entre comillas: `Start-Process` une `-ArgumentList` sin comillas y partía o colapsaba
/// los espacios de la ruta. Sin `-EncodedCommand`: Base64 + `Add-MpPreference` es un patrón que
/// AMSI/Defender trata como manipulación de defensas. `[char]34` evita comillas dobles en el script.
const ELEVATED_ARG_LINE: &str = "$argLine = '-NoProfile -NonInteractive -WindowStyle Hidden -Command ' + [char]34 + $env:CT_EXCLUSION_CMD + [char]34;";

pub fn add_defender_exclusion(folder_path: &Path) -> Result<(), String> {
    if !folder_path.exists() {
        return Err("El directorio a excluir de Windows Defender no existe.".to_string());
    }

    let canonical = folder_path
        .canonicalize()
        .map_err(|e| format!("Ruta inválida: {}", e))?;
    let path_str = canonical.to_string_lossy();
    let clean_path = path_str
        .strip_prefix(r"\\?\")
        .unwrap_or(&path_str)
        .replace('/', "\\");

    let exclusion_cmd = defender_exclusion_command("Add-MpPreference", &clean_path)?;
    let script = format!(
        "try {{ {ELEVATED_ARG_LINE} \
            $p = Start-Process powershell -Verb RunAs -ArgumentList $argLine -Wait -PassThru -ErrorAction Stop; \
            if ($p.ExitCode -ne 0) {{ exit $p.ExitCode }} \
        }} catch {{ \
            exit 1 \
        }}"
    );

    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .env("CT_EXCLUSION_CMD", &exclusion_cmd)
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
        Err(
            "El usuario canceló la elevación o falló el comando de exclusión de Defender"
                .to_string(),
        )
    }
}

#[allow(unsafe_code)]
pub fn get_registered_install_location() -> Option<std::path::PathBuf> {
    let subkey_str =
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CrystalTidesLauncherPapyrus\0";
    let subkey_utf16: Vec<u16> = subkey_str.encode_utf16().collect();
    let val_name: Vec<u16> = "InstallLocation\0".encode_utf16().collect();

    // SAFETY: Consultar la clave InstallLocation en el registro del usuario (HKCU).
    unsafe {
        let mut hkey = HKEY::default();
        let res = RegOpenKeyW(HKEY_CURRENT_USER, PCWSTR(subkey_utf16.as_ptr()), &mut hkey);
        if !res.is_ok() || hkey.is_invalid() {
            return None;
        }

        let mut buf = [0u16; 1024];
        let mut len = (buf.len() * std::mem::size_of::<u16>()) as u32;
        let mut val_type = REG_VALUE_TYPE(0);

        let query_res = RegQueryValueExW(
            hkey,
            PCWSTR(val_name.as_ptr()),
            None,
            Some(&mut val_type),
            Some(buf.as_mut_ptr() as *mut u8),
            Some(&mut len),
        );

        let _ = RegCloseKey(hkey);

        if query_res.is_ok() && val_type == REG_SZ {
            let u16_len = (len as usize) / std::mem::size_of::<u16>();
            let slice = if u16_len > 0 && buf[u16_len - 1] == 0 {
                &buf[..u16_len - 1]
            } else {
                &buf[..u16_len]
            };
            let s = String::from_utf16_lossy(slice).trim().to_string();
            if !s.is_empty() {
                return Some(std::path::PathBuf::from(s));
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escape_duplica_todas_las_comillas_simples_de_powershell() {
        assert_eq!(escape_ps_single_quoted("C:\\Juegos"), "C:\\Juegos");
        assert_eq!(escape_ps_single_quoted("a'b"), "a''b");
        assert_eq!(
            escape_ps_single_quoted("\u{2018}\u{2019}\u{201A}\u{201B}"),
            "\u{2018}\u{2018}\u{2019}\u{2019}\u{201A}\u{201A}\u{201B}\u{201B}"
        );
    }

    #[test]
    fn comando_de_exclusion_rechaza_comillas_dobles() {
        assert_eq!(
            defender_exclusion_command("Add-MpPreference", "C:\\a'b").unwrap(),
            "Add-MpPreference -ExclusionPath 'C:\\a''b'"
        );
        assert!(defender_exclusion_command("Add-MpPreference", "C:\\a\"b").is_err());
    }

    /// Lanza el comando por la misma vía que la exclusión real (`ELEVATED_ARG_LINE` y
    /// `Start-Process`), pero sin elevar y con un cmdlet ficticio que comprueba la ruta recibida:
    /// así no se toca Defender ni se dispara AMSI. Devuelve la salida del proceso hijo, que solo es
    /// "OK" si la ruta llegó intacta y no se ejecutó nada más.
    fn run_like_elevated(path: &str) -> String {
        let probe = "function Test-CtPreference { param([string]$ExclusionPath) if ($ExclusionPath -ceq $env:CT_EXPECTED) { 'OK' } else { 'MISMATCH' } };";
        let cmd = format!(
            "{probe} {}",
            defender_exclusion_command("Test-CtPreference", path).unwrap()
        );
        let out_file = tempfile::NamedTempFile::new().expect("tempfile");
        let script = format!(
            "{ELEVATED_ARG_LINE} \
             Start-Process powershell -ArgumentList $argLine -NoNewWindow -Wait -RedirectStandardOutput $env:CT_OUT"
        );
        let out = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .env("CT_EXCLUSION_CMD", &cmd)
            .env("CT_EXPECTED", path)
            .env("CT_OUT", out_file.path())
            .output()
            .expect("powershell");
        let child = std::fs::read_to_string(out_file.path()).unwrap_or_default();
        if child.trim().is_empty() {
            return format!(
                "sin salida; stderr: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
        child.trim().to_string()
    }

    #[test]
    fn comando_elevado_resiste_comillas_tipograficas() {
        // ’ (U+2019) también cierra cadenas en PowerShell: con el escape anterior esto inyectaba
        let path = "C:\\Juegos\\x\u{2019}; Write-Output INYECTADO; \u{2019}";
        assert_eq!(run_like_elevated(path), "OK");
        assert_eq!(
            run_like_elevated("C:\\a'b\u{2018}c\u{201A}d\u{201B}e"),
            "OK"
        );
    }

    #[test]
    fn comando_elevado_conserva_espacios_consecutivos() {
        assert_eq!(run_like_elevated("C:\\Mis  Juegos\\Crystal   Tides"), "OK");
        assert_eq!(run_like_elevated("C:\\Program Files\\CT\\"), "OK");
    }
}
