use std::path::{Component, Path, PathBuf};

/// Retorna la lista de raíces autorizadas en el sistema para CrystalTides, ya normalizadas
/// (ver `normalize_for_compare`). Cualquier acceso a disco (lectura/escritura/borrado/instancias)
/// debe vivir estrictamente dentro de una de estas raíces para evitar evasiones de ruta o path
/// traversal. Se descarta cualquier raíz demasiado amplia o protegida (`DirPolicy`), venga de un
/// perfil, del registro o de `CRYSTALTIDES_HOME`.
pub fn get_authorized_file_roots() -> Vec<PathBuf> {
    authorized_roots(&DirPolicy::current())
}

fn authorized_roots(policy: &DirPolicy) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // 1. Directorio de instalación predeterminado (.crystaltides o CRYSTALTIDES_HOME)
    roots.extend(crate::sys::get_default_install_dir());

    // 2. Ubicación registrada en el sistema operativo (si existe)
    roots.extend(crate::sys::get_registered_install_location());

    // 3. Directorio de instancias del launcher (en ubicación registrada o por defecto)
    roots.push(get_launcher_instances_dir());

    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".crystaltides"));
        roots.extend(minecraft_dir(&home));
        roots.extend(
            external_launcher_dirs(&home)
                .into_iter()
                .filter(|dir| dir.exists()),
        );
    }

    // 4. Carpetas de juego de los perfiles guardados en BD (la política se aplica más abajo,
    //    también a los perfiles guardados antes de validarse al guardar)
    if let Ok(profiles) = crate::db::get_profiles_sync() {
        roots.extend(
            profiles
                .into_iter()
                .filter_map(|p| p.game_dir)
                .filter_map(|gd| require_absolute_path(&gd).ok()),
        );
    }

    // 5. Permitir directorios temporales durante pruebas unitarias
    #[cfg(test)]
    roots.push(std::env::temp_dir());

    roots
        .iter()
        .map(|root| normalize_for_compare(root))
        .filter(|root| policy.check_dedicated(root).is_ok())
        .collect()
}

/// Directorio de Minecraft estándar de la plataforma.
fn minecraft_dir(home: &Path) -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        dirs::data_dir().map(|appdata| appdata.join(".minecraft"))
    } else if cfg!(target_os = "macos") {
        Some(home.join("Library/Application Support/minecraft"))
    } else {
        Some(home.join(".minecraft"))
    }
}

/// Carpetas de instancias de launchers externos conocidos.
fn external_launcher_dirs(home: &Path) -> Vec<PathBuf> {
    let base = if cfg!(target_os = "windows") {
        home.join("AppData").join("Roaming")
    } else if cfg!(target_os = "macos") {
        home.join("Library").join("Application Support")
    } else {
        home.join(".local").join("share")
    };

    vec![
        home.join("curseforge").join("minecraft").join("Instances"),
        base.join("curseforge").join("minecraft").join("Instances"),
        base.join("ModrinthApp").join("profiles"),
        base.join("com.modrinth.theseus").join("profiles"),
        base.join("PrismLauncher").join("instances"),
        base.join("MultiMC").join("instances"),
    ]
}

/// Ruta absoluta, no vacía y sin `..`: base común de toda ruta recibida del frontend.
pub(crate) fn require_absolute_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("La ruta no puede estar vacía.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(format!(
            "Ruta no autorizada: debe ser una ruta absoluta ('{}').",
            trimmed
        ));
    }
    if path.components().any(|c| c == Component::ParentDir) {
        return Err(
            "Ruta no autorizada: Detectada navegación relativa hacia directorios padres."
                .to_string(),
        );
    }
    Ok(path)
}

/// Forma comparable de una ruta: symlinks resueltos (aunque no exista todavía) y sin el prefijo
/// `\\?\` que añade `canonicalize` en Windows. Raíces, rutas y carpetas protegidas se normalizan
/// igual antes de compararse con `is_within_root`.
pub(crate) fn normalize_for_compare(path: &Path) -> PathBuf {
    let resolved = canonicalize_lenient(path).unwrap_or_else(|_| path.to_path_buf());
    strip_verbatim_prefix(&resolved)
}

/// Carpetas en las que el launcher nunca escribe ni borra, aunque una raíz autorizada las
/// contuviera: las del sistema y las que el SO usa para arrancar programas o guardar credenciales
/// del usuario (p. ej. la carpeta Startup, dentro de `%APPDATA%\Microsoft`).
fn protected_dirs() -> Vec<PathBuf> {
    let mut protected = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let env_dir = |var: &str, default: &str| {
            std::env::var_os(var)
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(default))
        };
        protected.push(env_dir("SystemRoot", r"C:\Windows"));
        protected.push(env_dir("ProgramFiles", r"C:\Program Files"));
        protected.push(env_dir("ProgramFiles(x86)", r"C:\Program Files (x86)"));
        protected.push(env_dir("ProgramData", r"C:\ProgramData"));
        protected.extend(
            [dirs::data_dir(), dirs::data_local_dir()]
                .into_iter()
                .flatten()
                .map(|dir| dir.join("Microsoft")),
        );
    }

    #[cfg(not(target_os = "windows"))]
    {
        protected.extend(
            [
                "/etc", "/usr", "/bin", "/sbin", "/lib", "/lib64", "/boot", "/dev", "/proc",
                "/sys", "/System",
            ]
            .map(PathBuf::from),
        );
        if let Some(home) = dirs::home_dir() {
            protected.extend(
                [
                    ".ssh",
                    ".gnupg",
                    ".config/autostart",
                    "Library/LaunchAgents",
                ]
                .map(|dir| home.join(dir)),
            );
        }
    }

    protected
        .iter()
        .map(|dir| normalize_for_compare(dir))
        .collect()
}

/// Qué carpetas no puede tocar el launcher. Se calcula una vez por validación: cada carpeta
/// se normaliza, lo que cuesta un acceso a disco.
struct DirPolicy {
    /// No se escribe dentro de ellas.
    protected: Vec<PathBuf>,
    /// Un directorio dedicado no puede ser ninguna de ellas ni contenerla: autorizarlo abriría
    /// de golpe todo lo que cuelga de ella. Incluye las protegidas.
    broad: Vec<PathBuf>,
}

impl DirPolicy {
    fn current() -> Self {
        let protected = protected_dirs();
        let user_dirs = [
            dirs::home_dir(),
            dirs::desktop_dir(),
            dirs::document_dir(),
            dirs::download_dir(),
            dirs::data_dir(),
            dirs::data_local_dir(),
            dirs::config_dir(),
        ];
        let broad = user_dirs
            .into_iter()
            .flatten()
            .map(|dir| normalize_for_compare(&dir))
            .chain(protected.iter().cloned())
            .collect();
        Self { protected, broad }
    }

    /// `target` ya normalizada.
    fn is_protected(&self, target: &Path) -> bool {
        self.protected.iter().any(|dir| is_within_root(target, dir))
    }

    /// Un directorio dedicado (instancia, perfil, instalación) no es la raíz de un disco, no está
    /// dentro de una carpeta protegida y no es ni contiene una carpeta amplia. `target` ya
    /// normalizada.
    fn check_dedicated(&self, target: &Path) -> Result<(), String> {
        if self.is_protected(target) {
            return Err(format!(
                "Directorio no autorizado: '{}' está dentro de una carpeta protegida del sistema.",
                target.display()
            ));
        }
        let is_too_broad =
            target.parent().is_none() || self.broad.iter().any(|dir| is_within_root(dir, target));
        if is_too_broad {
            return Err(format!(
                "Directorio no autorizado: '{}' es demasiado amplio (raíz del disco, carpeta personal o del sistema).",
                target.display()
            ));
        }
        Ok(())
    }
}

/// Valida que `path` sirva como directorio dedicado de CrystalTides (ver `DirPolicy`).
pub(crate) fn check_dedicated_dir(path: &Path) -> Result<(), String> {
    DirPolicy::current().check_dedicated(&normalize_for_compare(path))
}

/// Valida el `game_dir` de un perfil. Cada perfil se convierte en raíz autorizada, así que tiene
/// que ser un directorio dedicado: ni la raíz de un disco, ni el home del usuario o una carpeta
/// que lo contenga, ni Escritorio/Documentos/AppData, ni nada dentro de las carpetas del
/// sistema. Se comprueba su destino real, porque un symlink podría apuntar a una de ellas.
pub fn validate_profile_game_dir(game_dir: &str) -> Result<PathBuf, String> {
    let path = require_absolute_path(game_dir)?;
    check_dedicated_dir(&path)?;
    Ok(path)
}

/// Normaliza `raw` y exige que quede dentro de una raíz autorizada y fuera de las carpetas
/// protegidas. Ruta y raíces se normalizan igual y se comparan por componentes: así
/// `.crystaltides-otra` no cuela como `.crystaltides`, ni un symlink dentro de una raíz que
/// apunte fuera de ella. Devuelve la ruta normalizada.
fn authorize_path(raw: &str) -> Result<PathBuf, String> {
    let target = normalize_for_compare(&require_absolute_path(raw)?);
    let policy = DirPolicy::current();
    if policy.is_protected(&target) {
        return Err(
            "Acceso denegado: la ruta está dentro de una carpeta protegida del sistema."
                .to_string(),
        );
    }
    let is_authorized = authorized_roots(&policy)
        .iter()
        .any(|root| is_within_root(&target, root));
    if !is_authorized {
        return Err("Acceso denegado: La ruta se encuentra fuera de los directorios autorizados de CrystalTides (.crystaltides, .minecraft o perfiles registrados).".to_string());
    }
    Ok(target)
}

/// Valida y normaliza la ruta de un archivo asegurando que esté dentro de una raíz autorizada.
/// Protege contra rutas relativas, path traversal (`..`), carpetas del sistema y symlinks que
/// apunten fuera de las raíces seguras.
pub fn validate_safe_file_path(path_str: &str) -> Result<PathBuf, String> {
    authorize_path(path_str)
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
    if relative.as_os_str().is_empty() {
        ancestor.canonicalize()
    } else {
        Ok(ancestor.canonicalize()?.join(relative))
    }
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
pub(crate) fn is_within_root(path: &Path, root: &Path) -> bool {
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

/// Valida un directorio de juego, de instancia o de runtimes: mismas reglas que
/// `validate_safe_file_path` (ruta absoluta, sin `..`, dentro de una raíz autorizada y fuera de
/// las carpetas protegidas). Devuelve la ruta normalizada.
pub fn validate_game_dir(game_dir: &str) -> Result<PathBuf, String> {
    authorize_path(game_dir)
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
    fn test_validate_profile_game_dir_rechaza_carpetas_amplias() {
        assert!(validate_profile_game_dir("").is_err());
        assert!(validate_profile_game_dir("relativa/instancia").is_err());

        let home = dirs::home_dir().expect("home");
        assert!(validate_profile_game_dir(&home.to_string_lossy()).is_err());
        assert!(validate_profile_game_dir(&home.parent().unwrap().to_string_lossy()).is_err());
        let root = home.ancestors().last().unwrap();
        assert!(validate_profile_game_dir(&root.to_string_lossy()).is_err());

        #[cfg(target_os = "windows")]
        {
            assert!(validate_profile_game_dir(r"C:\Windows\System32").is_err());
            let upper = home.to_string_lossy().to_uppercase();
            assert!(validate_profile_game_dir(&upper).is_err());
        }
        #[cfg(not(target_os = "windows"))]
        assert!(validate_profile_game_dir("/etc/minecraft").is_err());

        // Carpetas concretas de instancias, dentro o fuera del home, se aceptan
        let instancia = home.join(".crystaltides").join("instances").join("x");
        assert!(validate_profile_game_dir(&instancia.to_string_lossy()).is_ok());
        let temp = tempfile::tempdir().expect("tempdir");
        assert!(validate_profile_game_dir(&temp.path().to_string_lossy()).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn test_validate_profile_game_dir_rechaza_symlink_a_carpeta_amplia() {
        let temp = tempfile::tempdir().expect("tempdir");
        let link = temp.path().join("todo");
        std::os::unix::fs::symlink("/", &link).expect("symlink");
        assert!(validate_profile_game_dir(&link.to_string_lossy()).is_err());
    }

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
    fn test_validate_safe_file_path_does_not_add_trailing_slash_to_existing_file() {
        let temp = tempfile::tempdir().expect("tempdir");
        let test_file = temp.path().join("version.json");
        std::fs::write(&test_file, b"{\"id\":\"test\"}").expect("write test file");
        let validated = validate_safe_file_path(&test_file.to_string_lossy()).expect("valid path");
        assert!(
            !validated.to_string_lossy().ends_with('\\')
                && !validated.to_string_lossy().ends_with('/')
        );
        let content = std::fs::read_to_string(&validated);
        assert!(content.is_ok());
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

    #[test]
    fn test_require_absolute_path() {
        assert!(require_absolute_path("").is_err());
        assert!(require_absolute_path("   ").is_err());
        assert!(require_absolute_path("relativa/x").is_err());
        let temp = tempfile::tempdir().expect("tempdir");
        assert!(require_absolute_path(&temp.path().join("..").to_string_lossy()).is_err());
        assert_eq!(
            require_absolute_path(&format!("  {}  ", temp.path().display())).unwrap(),
            temp.path()
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_perfil_rechaza_carpetas_protegidas_y_amplias_de_windows() {
        let roaming = dirs::data_dir().expect("APPDATA");
        let startup = roaming.join(r"Microsoft\Windows\Start Menu\Programs\Startup");
        let program_files = std::env::var("ProgramFiles").unwrap_or(r"C:\Program Files".into());

        for dir in [
            startup.clone(),
            PathBuf::from(&program_files).join("CrystalTides"),
            PathBuf::from(r"c:\windows\temp\x"),
            roaming.clone(),
            roaming.parent().unwrap().to_path_buf(), // AppData
            dirs::desktop_dir().expect("desktop"),
            dirs::document_dir().expect("documents"),
        ] {
            assert!(
                validate_profile_game_dir(&dir.to_string_lossy()).is_err(),
                "debe rechazar {}",
                dir.display()
            );
        }

        // Carpetas dedicadas dentro de las amplias sí valen
        let desktop_instance = dirs::desktop_dir().unwrap().join("MiInstancia");
        assert!(validate_profile_game_dir(&desktop_instance.to_string_lossy()).is_ok());
        assert!(validate_profile_game_dir(&roaming.join(".minecraft").to_string_lossy()).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn test_perfil_rechaza_carpetas_protegidas_de_unix() {
        let home = dirs::home_dir().expect("home");
        for dir in [
            home.join(".ssh"),
            home.join(".config/autostart/x"),
            "/usr/lib/x".into(),
        ] {
            assert!(
                validate_profile_game_dir(&dir.to_string_lossy()).is_err(),
                "debe rechazar {}",
                dir.display()
            );
        }
    }

    #[test]
    fn test_politica_descarta_raices_amplias() {
        let policy = DirPolicy::current();
        let home = normalize_for_compare(&dirs::home_dir().expect("home"));
        // Una raíz que llegara por el registro o por un perfil antiguo nunca se acepta
        assert!(policy.check_dedicated(&home).is_err());
        assert!(policy
            .check_dedicated(home.ancestors().last().unwrap())
            .is_err());
        assert!(policy.check_dedicated(&home.join(".crystaltides")).is_ok());
        // Las raíces autorizadas actuales cumplen la política
        for root in get_authorized_file_roots() {
            assert!(policy.check_dedicated(&root).is_ok(), "{}", root.display());
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_validate_safe_file_path_ignora_mayusculas_y_prefijo_verbatim() {
        let temp = tempfile::tempdir().expect("tempdir");
        let file = temp.path().join("Config.json");
        std::fs::write(&file, b"{}").expect("write");

        let upper = file.to_string_lossy().to_uppercase();
        let validated = validate_safe_file_path(&upper).expect("misma ruta en mayúsculas");
        assert!(!validated.to_string_lossy().starts_with(r"\\?\"));

        let verbatim = format!(r"\\?\{}", file.display());
        assert!(validate_safe_file_path(&verbatim).is_ok());
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
