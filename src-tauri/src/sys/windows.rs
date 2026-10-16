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

    let script = "\
        try { \
            $esc = [Management.Automation.Language.CodeGeneration]::EscapeSingleQuotedStringContent($env:CT_EXCLUSION_PATH); \
            $cmd = \"Add-MpPreference -ExclusionPath '$esc'\"; \
            $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($cmd)); \
            $p = Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', $encoded) -Wait -PassThru -ErrorAction Stop; \
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
