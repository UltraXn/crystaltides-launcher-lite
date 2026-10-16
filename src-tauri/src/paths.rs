use std::path::{Component, Path, PathBuf};

/// Retorna la lista de raíces autorizadas en el sistema para CrystalTides.
/// Cualquier acceso a disco (lectura/escritura/borrado/instancias) debe vivir
/// estrictamente dentro de una de estas raíces para evitar evasiones de ruta o path traversal.
pub fn get_authorized_file_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // 1. Directorio de instalación predeterminado (.crystaltides)
    if let Some(install_dir) = crate::sys::get_default_install_dir() {
        if let Ok(c) = install_dir.canonicalize() {
            roots.push(c);
        } else {
            roots.push(install_dir);
        }
    }

    // 2. ~/.crystaltides explícito o CUSTOM vía CRYSTALTIDES_HOME
    if let Some(custom) = std::env::var_os("CRYSTALTIDES_HOME") {
        let trimmed = custom.to_string_lossy().trim().to_string();
        if !trimmed.is_empty() {
            let ct_dir = PathBuf::from(trimmed);
            if let Ok(c) = ct_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(ct_dir);
            }
        }
    }

    // 2.1 Ubicación registrada en el sistema operativo (si existe)
    if let Some(reg_dir) = crate::sys::get_registered_install_location() {
        if let Ok(c) = reg_dir.canonicalize() {
            roots.push(c);
        } else {
            roots.push(reg_dir);
        }
    }

    // 2.2 Directorio de instancias del launcher (en ubicación registrada o por defecto)
    let inst_dir = get_launcher_instances_dir();
    if let Ok(c) = inst_dir.canonicalize() {
        roots.push(c);
    } else {
        roots.push(inst_dir);
    }

    if let Some(home) = dirs::home_dir() {
        let ct_dir = home.join(".crystaltides");
        if let Ok(c) = ct_dir.canonicalize() {
            roots.push(c);
        } else {
            roots.push(ct_dir);
        }

        // 3. Directorio de Minecraft estándar
        #[cfg(target_os = "windows")]
        if let Some(appdata) = dirs::data_dir() {
            let mc_dir = appdata.join(".minecraft");
            if let Ok(c) = mc_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(mc_dir);
            }
        }
        #[cfg(target_os = "linux")]
        {
            let mc_dir = home.join(".minecraft");
            if let Ok(c) = mc_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(mc_dir);
            }
        }
        #[cfg(target_os = "macos")]
        {
            let mc_dir = home.join("Library/Application Support/minecraft");
            if let Ok(c) = mc_dir.canonicalize() {
                roots.push(c);
            } else {
                roots.push(mc_dir);
            }
        }

        // 3.1 Carpetas de instancias de launchers externos conocidos
        let mut external_dirs = vec![home.join("curseforge").join("minecraft").join("Instances")];

        #[cfg(target_os = "windows")]
        {
            let roaming = home.join("AppData").join("Roaming");
            external_dirs.push(
                roaming
                    .join("curseforge")
                    .join("minecraft")
                    .join("Instances"),
            );
            external_dirs.push(roaming.join("ModrinthApp").join("profiles"));
            external_dirs.push(roaming.join("com.modrinth.theseus").join("profiles"));
            external_dirs.push(roaming.join("PrismLauncher").join("instances"));
            external_dirs.push(roaming.join("MultiMC").join("instances"));
        }

        #[cfg(target_os = "macos")]
        {
            let app_sup = home.join("Library").join("Application Support");
            external_dirs.push(
                app_sup
                    .join("curseforge")
                    .join("minecraft")
                    .join("Instances"),
            );
            external_dirs.push(app_sup.join("ModrinthApp").join("profiles"));
            external_dirs.push(app_sup.join("com.modrinth.theseus").join("profiles"));
            external_dirs.push(app_sup.join("PrismLauncher").join("instances"));
            external_dirs.push(app_sup.join("MultiMC").join("instances"));
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let local_share = home.join(".local").join("share");
            external_dirs.push(
                local_share
                    .join("curseforge")
                    .join("minecraft")
                    .join("Instances"),
            );
            external_dirs.push(local_share.join("ModrinthApp").join("profiles"));
            external_dirs.push(local_share.join("com.modrinth.theseus").join("profiles"));
            external_dirs.push(local_share.join("PrismLauncher").join("instances"));
            external_dirs.push(local_share.join("MultiMC").join("instances"));
        }

        for ext in external_dirs {
            if ext.exists() {
                if let Ok(c) = ext.canonicalize() {
                    roots.push(c);
                } else {
                    roots.push(ext);
                }
            }
        }
    }

    // 4. Agregar carpetas de juego autorizadas desde los perfiles guardados en BD
    if let Ok(profiles) = crate::db::get_profiles_sync() {
        for p in profiles {
            if let Some(gd) = p.game_dir {
                let path = PathBuf::from(&gd);
                if path.is_absolute() {
                    if let Ok(c) = path.canonicalize() {
                        roots.push(c);
                    } else {
                        roots.push(path);
                    }
                }
            }
        }
    }

    // 5. Permitir directorios temporales durante pruebas unitarias si temp_dir está aislado
    #[cfg(test)]
    {
        if let Ok(c) = std::env::temp_dir().canonicalize() {
            roots.push(c);
        } else {
            roots.push(std::env::temp_dir());
        }
    }

    roots
}

/// Valida y normaliza una ruta de archivo asegurando que esté dentro de una raíz autorizada.
/// Protege estrictamente contra:
/// - Rutas relativas
/// - Path traversal (`..`)
/// - Prefijos de dispositivos no autorizados
/// - Simbólicos que apunten fuera de las raíces seguras
pub fn validate_safe_file_path(path_str: &str) -> Result<PathBuf, String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err("Ruta de archivo vacía.".to_string());
    }

    let raw_path = PathBuf::from(trimmed);
    if !raw_path.is_absolute() {
        return Err(format!(
            "Ruta no autorizada: debe ser una ruta absoluta ('{}')",
            trimmed
        ));
    }

    for component in raw_path.components() {
        if let Component::ParentDir = component {
            return Err(
                "Ruta no autorizada: Detectada navegación relativa hacia directorios padres."
                    .to_string(),
            );
        }
    }

    // Resolver ruta canónica para evitar evasiones con symlinks o aliasing
    let target_canonical = if raw_path.exists() {
        raw_path
            .canonicalize()
            .map_err(|e| format!("Error canonicalizando ruta: {}", e))?
    } else {
        let mut ancestor = raw_path.as_path();
        while !ancestor.exists() {
            match ancestor.parent() {
                Some(p) => ancestor = p,
                None => return Err("Ruta no válida: ancestro inexistente.".to_string()),
            }
        }
        let canonical_ancestor = ancestor
            .canonicalize()
            .map_err(|e| format!("Error canonicalizando ancestro: {}", e))?;
        let relative = raw_path.strip_prefix(ancestor).unwrap_or(Path::new(""));
        canonical_ancestor.join(relative)
    };

    let authorized_roots = get_authorized_file_roots();
    let is_authorized = authorized_roots
        .iter()
        .any(|root| target_canonical.starts_with(root));

    if !is_authorized {
        return Err("Acceso denegado: La ruta se encuentra fuera de los directorios autorizados de CrystalTides (.crystaltides, .minecraft o perfiles registrados).".to_string());
    }

    Ok(target_canonical)
}

/// Obtiene el directorio de instancias del launcher, respetando si la instalación
/// se realizó en una ruta registrada alternativa (ej: disco D:\), en CRYSTALTIDES_HOME,
/// o por defecto en ~/.crystaltides/instances.
pub fn get_launcher_instances_dir() -> PathBuf {
    if let Some(reg_dir) = crate::sys::get_registered_install_location() {
        return reg_dir.join("instances");
    }
    if let Some(custom) = std::env::var_os("CRYSTALTIDES_HOME") {
        let trimmed = custom.to_string_lossy().trim().to_string();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("instances");
        }
    }
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent_root) = current_exe.parent().and_then(|p| p.parent()) {
            if crate::sys::is_app_installed(parent_root)
                || parent_root.join(".installed.json").exists()
            {
                return parent_root.join("instances");
            }
        }
    }
    if let Some(home) = dirs::home_dir() {
        home.join(".crystaltides").join("instances")
    } else {
        PathBuf::from(".crystaltides").join("instances")
    }
}

/// Canonicaliza una ruta que puede no existir todavía: resuelve el ancestro existente más
/// cercano y le añade el resto. Si no existe ninguno (p. ej. un disco ausente), la deja igual.
fn canonicalize_lenient(path: &Path) -> std::io::Result<PathBuf> {
    let mut ancestor = path;
    while !ancestor.exists() {
        match ancestor.parent() {
            Some(p) => ancestor = p,
            None => return Ok(path.to_path_buf()),
        }
    }
    let relative = path.strip_prefix(ancestor).unwrap_or(Path::new(""));
    Ok(ancestor.canonicalize()?.join(relative))
}

/// Quita el prefijo verbatim que añade `canonicalize` en Windows (`\\?\C:\` y `\\?\UNC\`).
fn strip_verbatim_prefix(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if let Some(unc) = s.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{}", unc))
    } else if let Some(disk) = s.strip_prefix(r"\\?\") {
        PathBuf::from(disk)
    } else {
        path.to_path_buf()
    }
}

/// `path` está dentro de `root` (o es `root`), comparando componente a componente. En Windows y
/// macOS el sistema de archivos no distingue mayúsculas, así que la comparación tampoco.
fn is_within_root(path: &Path, root: &Path) -> bool {
    let same = |a: Component, b: Component| {
        if cfg!(any(target_os = "windows", target_os = "macos")) {
            a.as_os_str().to_string_lossy().to_lowercase()
                == b.as_os_str().to_string_lossy().to_lowercase()
        } else {
            a == b
        }
    };
    // Una raíz vacía o relativa no tiene componentes que comparar y lo autorizaría todo
    if !root.is_absolute() {
        return false;
    }
    let mut parts = path.components();
    root.components()
        .all(|r| parts.next().is_some_and(|p| same(p, r)))
}

/// Valida un directorio de juego de Minecraft o instancia.
/// Debe ser una ruta absoluta, sin componentes `..`, y no vacía.
pub fn validate_game_dir(game_dir: &str) -> Result<PathBuf, String> {
    let trimmed = game_dir.trim();
    if trimmed.is_empty() {
        return Err("El directorio del juego no puede estar vacío".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(
            "Ruta no autorizada: El directorio del juego debe ser una ruta absoluta".to_string(),
        );
    }
    for component in path.components() {
        if let Component::ParentDir = component {
            return Err(
                "Ruta no autorizada: Detectada navegación relativa hacia directorios padres"
                    .to_string(),
            );
        }
    }

    // Prohibir explícitamente directorios protegidos del sistema operativo
    #[cfg(target_os = "windows")]
    {
        let lower = trimmed.to_lowercase();
        if lower.starts_with("c:\\windows") || lower.starts_with("c:/windows") {
            return Err(
                "Ruta no autorizada: Directorio protegido del sistema operativo.".to_string(),
            );
        }
        if let Ok(sys_drive) = std::env::var("SystemDrive") {
            let win_dir = PathBuf::from(format!("{}\\Windows", sys_drive));
            if path.starts_with(&win_dir) {
                return Err(
                    "Ruta no autorizada: Directorio protegido del sistema operativo.".to_string(),
                );
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let forbidden = [
            Path::new("/etc"),
            Path::new("/usr"),
            Path::new("/bin"),
            Path::new("/sbin"),
        ];
        for f in &forbidden {
            if path.starts_with(f) {
                return Err(
                    "Ruta no autorizada: Directorio protegido del sistema operativo.".to_string(),
                );
            }
        }
    }

    let target_canonical = canonicalize_lenient(&path)
        .map_err(|e| format!("Error canonicalizando ruta de juego: {}", e))?;

    // Ruta y raíces se normalizan igual (symlinks resueltos, sin `\\?\`) y se comparan por
    // componentes: así `.crystaltides-otra` no cuela como `.crystaltides`, ni un symlink
    // dentro de una raíz que apunte fuera de ella.
    let target_cmp = strip_verbatim_prefix(&target_canonical);
    let is_authorized = get_authorized_file_roots().iter().any(|root| {
        canonicalize_lenient(root)
            .map(|r| is_within_root(&target_cmp, &strip_verbatim_prefix(&r)))
            .unwrap_or(false)
    });

    if !is_authorized {
        return Err("Acceso denegado: El directorio del juego se encuentra fuera de las raíces autorizadas (.crystaltides, .minecraft o instancias registradas).".to_string());
    }

    Ok(target_canonical)
}

/// Newtype `SafeId` para garantizar que los identificadores (instancias, perfiles, mods)
/// cumplen con el formato seguro `^[A-Za-z0-9._+-]{1,64}$` y rechazan traversal.
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct SafeId(String);

impl SafeId {
    pub fn parse(raw: impl Into<String>) -> Result<Self, String> {
        let s = raw.into();
        let trimmed = s.trim();
        if trimmed.is_empty() {
            return Err("El identificador no puede estar vacío.".to_string());
        }
        if trimmed.len() > 64 {
            return Err("El identificador no puede superar los 64 caracteres.".to_string());
        }
        if trimmed == "." || trimmed == ".." {
            return Err("Identificador inválido (no se permite navegación relativa).".to_string());
        }
        let valid = trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.' || c == '+');
        if !valid {
            return Err("El identificador contiene caracteres no permitidos. Solo se admiten caracteres alfanuméricos, guiones, puntos, barras bajas y signos más.".to_string());
        }
        Ok(Self(trimmed.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for SafeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::ops::Deref for SafeId {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_id_validation() {
        assert!(SafeId::parse("official").is_ok());
        assert!(SafeId::parse("instance_123").is_ok());
        assert!(SafeId::parse("forge-1.20.1+build.4").is_ok());

        assert!(SafeId::parse("").is_err());
        assert!(SafeId::parse("   ").is_err());
        assert!(SafeId::parse(".").is_err());
        assert!(SafeId::parse("..").is_err());
        assert!(SafeId::parse("instance/traversal").is_err());
        assert!(SafeId::parse("instance\\escape").is_err());
        assert!(SafeId::parse("id*bad").is_err());
        assert!(SafeId::parse("a".repeat(65)).is_err());
    }

    #[test]
    fn test_validate_safe_file_path_rejects_relative() {
        assert!(validate_safe_file_path("relative/path.txt").is_err());
        assert!(validate_safe_file_path(".").is_err());
        assert!(validate_safe_file_path("").is_err());
    }

    #[test]
    fn test_validate_safe_file_path_rejects_parent_dir() {
        #[cfg(target_os = "windows")]
        {
            assert!(validate_safe_file_path("C:/Users/gamer/../secret.txt").is_err());
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert!(validate_safe_file_path("/home/gamer/../etc/passwd").is_err());
        }
    }

    #[test]
    fn test_validate_safe_file_path_rejects_system_dirs() {
        #[cfg(target_os = "windows")]
        {
            assert!(validate_safe_file_path("C:/Windows/System32/cmd.exe").is_err());
            assert!(validate_safe_file_path("C:/Program Files/malicious.dll").is_err());
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert!(validate_safe_file_path("/etc/shadow").is_err());
            assert!(validate_safe_file_path("/bin/sh").is_err());
        }
    }

    #[test]
    fn test_validate_safe_file_path_accepts_temp_dir() {
        let temp = tempfile::tempdir().expect("tempdir");
        let test_file = temp.path().join("config.json");
        let validated = validate_safe_file_path(&test_file.to_string_lossy());
        assert!(validated.is_ok());
    }

    #[test]
    fn test_validate_game_dir() {
        assert!(validate_game_dir("").is_err());
        assert!(validate_game_dir("relative").is_err());
        assert!(validate_game_dir("../traversal").is_err());

        #[cfg(target_os = "windows")]
        assert!(validate_game_dir("C:/Windows/System32").is_err());
        #[cfg(not(target_os = "windows"))]
        assert!(validate_game_dir("/etc").is_err());

        if let Some(home) = dirs::home_dir() {
            let valid_ct = home.join(".crystaltides");
            assert!(validate_game_dir(&valid_ct.to_string_lossy()).is_ok());
        }
        let temp = tempfile::tempdir().unwrap();
        assert!(validate_game_dir(&temp.path().to_string_lossy()).is_ok());
    }

    #[test]
    #[serial_test::serial]
    #[allow(unsafe_code)]
    fn test_validate_game_dir_custom_drive_and_reject_system32() {
        #[cfg(target_os = "windows")]
        {
            assert!(validate_game_dir("C:\\Windows\\System32").is_err());
            assert!(validate_game_dir("C:/Windows/System32").is_err());
            assert!(validate_game_dir("C:/Windows/System32/drivers").is_err());
        }

        // `D:\...` solo es absoluta en Windows; en el resto se usa un directorio fuera de $HOME
        #[cfg(target_os = "windows")]
        let custom_home = PathBuf::from("D:\\Juegos\\CrystalTides");
        #[cfg(not(target_os = "windows"))]
        let temp = tempfile::tempdir().expect("tempdir");
        #[cfg(not(target_os = "windows"))]
        let custom_home = temp.path().join("CrystalTides");

        unsafe {
            std::env::set_var("CRYSTALTIDES_HOME", &custom_home);
        }
        let custom_instance = custom_home.join("instances").join("MiInstanciaCustom");
        let result = validate_game_dir(&custom_instance.to_string_lossy());
        unsafe {
            std::env::remove_var("CRYSTALTIDES_HOME");
        }

        assert!(
            result.is_ok(),
            "Debe aceptar la ruta de instancia en un disco distinto registrada en el launcher: {:?}",
            result
        );
        #[cfg(target_os = "windows")]
        assert!(validate_game_dir("C:\\Windows\\System32").is_err());
    }

    #[test]
    fn test_is_within_root_compara_componentes_no_prefijos_de_texto() {
        #[cfg(target_os = "windows")]
        let root = Path::new(r"C:\Users\ana\.crystaltides");
        #[cfg(not(target_os = "windows"))]
        let root = Path::new("/home/ana/.crystaltides");

        assert!(is_within_root(root, root));
        assert!(is_within_root(&root.join("instances").join("x"), root));
        assert!(!is_within_root(
            &root.with_file_name(".crystaltides-otra"),
            root
        ));
        assert!(!is_within_root(
            &root.with_file_name(".crystaltidesX").join("mods"),
            root
        ));
        assert!(!is_within_root(root.parent().unwrap(), root));
        // Raíces vacías o relativas nunca autorizan nada
        assert!(!is_within_root(root, Path::new("")));
        assert!(!is_within_root(root, Path::new("relativa")));
    }

    #[test]
    fn test_is_within_root_mayusculas_segun_sistema() {
        #[cfg(target_os = "windows")]
        assert!(is_within_root(
            Path::new(r"c:\USERS\Ana\.CrystalTides\instances"),
            Path::new(r"C:\Users\ana\.crystaltides")
        ));
        #[cfg(target_os = "linux")]
        assert!(!is_within_root(
            Path::new("/home/ana/.CrystalTides/instances"),
            Path::new("/home/ana/.crystaltides")
        ));
    }

    #[test]
    fn test_strip_verbatim_prefix() {
        assert_eq!(
            strip_verbatim_prefix(Path::new(r"\\?\C:\a\b")),
            PathBuf::from(r"C:\a\b")
        );
        assert_eq!(
            strip_verbatim_prefix(Path::new(r"\\?\UNC\srv\share\x")),
            PathBuf::from(r"\\srv\share\x")
        );
        assert_eq!(
            strip_verbatim_prefix(Path::new("/home/ana")),
            PathBuf::from("/home/ana")
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_game_dir_acepta_otra_capitalizacion_en_windows() {
        let temp = tempfile::tempdir().expect("tempdir");
        let upper = temp
            .path()
            .join("Instancia")
            .to_string_lossy()
            .to_uppercase();
        assert!(validate_game_dir(&upper).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn test_validate_game_dir_rechaza_symlink_que_sale_de_la_raiz() {
        let temp = tempfile::tempdir().expect("tempdir");
        let link = temp.path().join("escape");
        std::os::unix::fs::symlink("/etc", &link).expect("symlink");
        // La ruta "cruda" vive en una raíz autorizada (temp), pero resuelve a /etc
        assert!(validate_game_dir(&link.to_string_lossy()).is_err());
        assert!(validate_game_dir(&link.join("nuevo").to_string_lossy()).is_err());
    }
}
