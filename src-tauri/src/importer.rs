use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ImportableInstance {
    pub id: String,
    pub source: String, // "mojang", "curseforge", "modrinth", "prism", "custom"
    pub source_name: String, // "Minecraft Oficial", "CurseForge", "Modrinth App", "Prism Launcher", "Personalizada"
    pub name: String,
    pub mc_version: String,
    pub loader_type: String, // "vanilla", "neoforge", "forge", "fabric", "quilt"
    pub loader_version: Option<String>,
    pub game_dir: String,
    pub mods_count: usize,
    pub icon: Option<String>,
    #[serde(default)]
    pub min_ram_gb: Option<f64>,
    #[serde(default)]
    pub max_ram_gb: Option<f64>,
    #[serde(default)]
    pub jvm_args: Option<String>,
    #[serde(default)]
    pub resolution_width: Option<u32>,
    #[serde(default)]
    pub resolution_height: Option<u32>,
    #[serde(default)]
    pub has_omitted_jvm_args: Option<bool>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeBaseModLoader {
    pub name: Option<String>,
    pub forge_version: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurseForgeInstanceManifest {
    pub name: Option<String>,
    pub minecraft_version: Option<String>,
    pub base_mod_loader: Option<CurseForgeBaseModLoader>,
}

impl CurseForgeInstanceManifest {
    pub fn parse(content: &str) -> Option<Self> {
        serde_json::from_str(content).ok()
    }

    pub fn loader_info(&self) -> (String, Option<String>) {
        if let Some(bml) = &self.base_mod_loader {
            let loader_name = bml.name.as_deref().unwrap_or("").to_lowercase();
            let forge_ver = bml.forge_version.clone();
            if loader_name.contains("neoforge") {
                ("neoforge".to_string(), forge_ver)
            } else if loader_name.contains("fabric") {
                ("fabric".to_string(), forge_ver)
            } else if loader_name.contains("quilt") {
                ("quilt".to_string(), forge_ver)
            } else if loader_name.contains("forge") {
                ("forge".to_string(), forge_ver)
            } else {
                ("vanilla".to_string(), None)
            }
        } else {
            ("vanilla".to_string(), None)
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
pub struct MmcComponent {
    pub uid: Option<String>,
    pub version: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct MmcPackManifest {
    #[serde(default)]
    pub components: Vec<MmcComponent>,
}

impl MmcPackManifest {
    pub fn parse(content: &str) -> Option<Self> {
        serde_json::from_str(content).ok()
    }

    pub fn extract_versions(&self) -> (Option<String>, String, Option<String>) {
        let mut mc_ver = None;
        let mut loader = "vanilla".to_string();
        let mut loader_ver = None;

        for comp in &self.components {
            let uid = comp.uid.as_deref().unwrap_or("");
            let ver = comp.version.clone();
            if uid == "net.minecraft" {
                if let Some(v) = ver {
                    mc_ver = Some(v);
                }
            } else if uid == "net.fabricmc.fabric-loader" {
                loader = "fabric".to_string();
                loader_ver = ver;
            } else if uid == "org.quiltmc.quilt-loader" {
                loader = "quilt".to_string();
                loader_ver = ver;
            } else if uid == "net.neoforged" {
                loader = "neoforge".to_string();
                loader_ver = ver;
            } else if uid == "net.minecraftforge" {
                loader = "forge".to_string();
                loader_ver = ver;
            }
        }

        (mc_ver, loader, loader_ver)
    }
}

#[derive(Deserialize, Debug, Clone)]
pub struct ModrinthMetadata {
    pub name: Option<String>,
    pub game_version: Option<String>,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ModrinthProfileManifest {
    pub name: Option<String>,
    pub game_version: Option<String>,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
    pub metadata: Option<ModrinthMetadata>,
}

impl ModrinthProfileManifest {
    pub fn parse(content: &str) -> Option<Self> {
        serde_json::from_str(content).ok()
    }

    pub fn resolved_name<'a>(&'a self, fallback: &'a str) -> &'a str {
        self.name
            .as_deref()
            .or_else(|| self.metadata.as_ref().and_then(|m| m.name.as_deref()))
            .unwrap_or(fallback)
    }

    pub fn resolved_mc_version(&self) -> &str {
        self.game_version
            .as_deref()
            .or_else(|| {
                self.metadata
                    .as_ref()
                    .and_then(|m| m.game_version.as_deref())
            })
            .unwrap_or("1.21.1")
    }

    pub fn resolved_loader(&self) -> String {
        self.loader
            .as_deref()
            .or_else(|| self.metadata.as_ref().and_then(|m| m.loader.as_deref()))
            .unwrap_or("fabric")
            .to_lowercase()
    }

    pub fn resolved_loader_version(&self) -> Option<String> {
        self.loader_version.clone().or_else(|| {
            self.metadata
                .as_ref()
                .and_then(|m| m.loader_version.clone())
        })
    }
}

fn count_mods_in_dir(game_dir: &Path) -> usize {
    let mods_dir = game_dir.join("mods");
    if !mods_dir.is_dir() {
        return 0;
    }
    if let Ok(entries) = fs::read_dir(mods_dir) {
        entries
            .flatten()
            .filter(|e| {
                if let Ok(meta) = e.metadata() {
                    if meta.is_file() {
                        let name = e.file_name().to_string_lossy().to_lowercase();
                        return name.ends_with(".jar");
                    }
                }
                false
            })
            .count()
    } else {
        0
    }
}

fn read_inherits_from_version_json(mc_dir: &Path, ver_id: &str) -> Option<String> {
    let json_path = mc_dir
        .join("versions")
        .join(ver_id)
        .join(format!("{}.json", ver_id));
    if json_path.exists() {
        if let Ok(content) = fs::read_to_string(&json_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(inherits) = val.get("inheritsFrom").and_then(|v| v.as_str()) {
                    let trimmed = inherits.trim();
                    if !trimmed.is_empty() {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }
    }
    None
}

fn parse_version_string(
    ver_str: &str,
    inherits_from: Option<&str>,
) -> (String, String, Option<String>) {
    let clean = ver_str.trim();
    let authoritative_mc = inherits_from
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    if clean.starts_with("quilt-loader-") {
        let parts: Vec<&str> = clean.split('-').collect();
        let loader_ver = parts.get(2).map(|s| s.to_string());
        let mc_ver =
            authoritative_mc.unwrap_or_else(|| parts.last().unwrap_or(&"1.21.1").to_string());
        ("quilt".to_string(), mc_ver, loader_ver)
    } else if clean.starts_with("fabric-loader-") {
        let parts: Vec<&str> = clean.split('-').collect();
        let loader_ver = parts.get(2).map(|s| s.to_string());
        let mc_ver =
            authoritative_mc.unwrap_or_else(|| parts.last().unwrap_or(&"1.21.1").to_string());
        ("fabric".to_string(), mc_ver, loader_ver)
    } else if clean.starts_with("neoforge-") {
        let parts: Vec<&str> = clean.split('-').collect();
        let loader_ver = parts.get(1).map(|s| s.to_string());
        let mc_ver = authoritative_mc.unwrap_or_else(|| {
            if let Some(ref lv) = loader_ver {
                let segs: Vec<&str> = lv.split('.').collect();
                if segs.len() >= 2 {
                    let major = segs[0];
                    let minor = segs[1];
                    if minor == "0" {
                        format!("1.{}", major)
                    } else {
                        format!("1.{}.{}", major, minor)
                    }
                } else {
                    "1.21.1".to_string()
                }
            } else {
                "1.21.1".to_string()
            }
        });
        ("neoforge".to_string(), mc_ver, loader_ver)
    } else if clean.contains("-forge-") {
        let parts: Vec<&str> = clean.split("-forge-").collect();
        let mc_ver =
            authoritative_mc.unwrap_or_else(|| parts.first().unwrap_or(&"1.20.1").to_string());
        let loader_ver = parts.get(1).map(|s| s.to_string());
        ("forge".to_string(), mc_ver, loader_ver)
    } else {
        let mc = authoritative_mc.unwrap_or_else(|| {
            if clean == "latest-release" {
                "1.21.1".to_string()
            } else if clean == "latest-snapshot" {
                "26.2".to_string()
            } else {
                clean.to_string()
            }
        });
        ("vanilla".to_string(), mc, None)
    }
}

pub fn parse_memory_spec(val: &str) -> Option<f64> {
    let clean = val.trim();
    if clean.is_empty() {
        return None;
    }
    let last = clean.chars().last()?;
    if last == 'G' || last == 'g' {
        clean[..clean.len() - 1].parse::<f64>().ok()
    } else if last == 'M' || last == 'm' {
        clean[..clean.len() - 1]
            .parse::<f64>()
            .ok()
            .map(|m| (m / 1024.0 * 10.0).round() / 10.0)
    } else if let Ok(num) = clean.parse::<f64>() {
        if num >= 512.0 {
            Some((num / 1024.0 * 10.0).round() / 10.0)
        } else {
            Some(num)
        }
    } else {
        None
    }
}

pub fn parse_ram_from_jvm_args(args: &str) -> (Option<f64>, Option<f64>) {
    let mut min_ram = None;
    let mut max_ram = None;
    for token in args.split_whitespace() {
        if let Some(val_str) = token.strip_prefix("-Xms") {
            min_ram = parse_memory_spec(val_str);
        } else if let Some(val_str) = token.strip_prefix("-Xmx") {
            max_ram = parse_memory_spec(val_str);
        }
    }
    (min_ram, max_ram)
}

/// Filtra argumentos de JVM importados: solo conserva los inofensivos (-Xmx/-Xms, -XX: de rendimiento, -D…)
/// y descarta argumentos peligrosos (-javaagent, -agentpath, -agentlib, -Xbootclasspath, jdwp, etc.).
/// Retorna `(Option<String>, bool)` donde el booleano indica si se omitió algún argumento.
pub fn sanitize_jvm_args(args: &str) -> (Option<String>, bool) {
    let mut safe_tokens = Vec::new();
    let mut has_omitted = false;

    for token in args.split_whitespace() {
        let lower = token.to_lowercase();
        if lower.starts_with("-javaagent")
            || lower.starts_with("-agentpath")
            || lower.starts_with("-agentlib")
            || lower.starts_with("-xbootclasspath")
            || lower.contains("jdwp")
            || lower.starts_with("-xdebug")
            || lower.starts_with("-xrunjdwp")
        {
            has_omitted = true;
            continue;
        }

        // Flags inofensivos permitidos:
        // -X (ej. -Xmx, -Xms, -Xmn, -Xss)
        // -XX: (ej. -XX:+UseG1GC, -XX:+UnlockExperimentalVMOptions)
        // -D (propiedades de sistema Java, ej. -Djava.net.preferIPv4Stack=true)
        // -server, -client
        if token.starts_with("-X")
            || token.starts_with("-XX:")
            || token.starts_with("-D")
            || token == "-server"
            || token == "-client"
        {
            safe_tokens.push(token);
        } else {
            has_omitted = true;
        }
    }

    let sanitized = if safe_tokens.is_empty() {
        None
    } else {
        Some(safe_tokens.join(" "))
    };

    (sanitized, has_omitted)
}

#[derive(Default, Debug, Clone)]
pub struct ImportedConfig {
    pub min_ram_gb: Option<f64>,
    pub max_ram_gb: Option<f64>,
    pub jvm_args: Option<String>,
    pub resolution_width: Option<u32>,
    pub resolution_height: Option<u32>,
    pub has_omitted_jvm_args: Option<bool>,
}

pub fn parse_prism_config(content: &str) -> ImportedConfig {
    let mut config = ImportedConfig::default();
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("MinMemAlloc=") {
            if let Ok(mb) = val.trim().parse::<f64>() {
                config.min_ram_gb = Some((mb / 1024.0 * 10.0).round() / 10.0);
            }
        } else if let Some(val) = trimmed.strip_prefix("MaxMemAlloc=") {
            if let Ok(mb) = val.trim().parse::<f64>() {
                config.max_ram_gb = Some((mb / 1024.0 * 10.0).round() / 10.0);
            }
        } else if let Some(val) = trimmed.strip_prefix("JvmArgs=") {
            let s = val.trim();
            if !s.is_empty() {
                let (safe_args, omitted) = sanitize_jvm_args(s);
                config.jvm_args = safe_args;
                if omitted {
                    config.has_omitted_jvm_args = Some(true);
                }
            }
        } else if let Some(val) = trimmed.strip_prefix("WindowWidth=") {
            if let Ok(w) = val.trim().parse::<u32>() {
                config.resolution_width = Some(w);
            }
        } else if let Some(val) = trimmed.strip_prefix("WindowHeight=") {
            if let Ok(h) = val.trim().parse::<u32>() {
                config.resolution_height = Some(h);
            }
        }
    }
    config
}

pub fn parse_curseforge_config(content: &str) -> ImportedConfig {
    let mut config = ImportedConfig::default();
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
        config.max_ram_gb = val
            .get("allocatedMemory")
            .and_then(|m| m.as_f64())
            .map(|mb| (mb / 1024.0 * 10.0).round() / 10.0);
        if let Some(raw_args) = val
            .get("customJavaArgs")
            .or_else(|| val.get("jvmArgs"))
            .and_then(|a| a.as_str())
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            let (safe_args, omitted) = sanitize_jvm_args(raw_args);
            config.jvm_args = safe_args;
            if omitted {
                config.has_omitted_jvm_args = Some(true);
            }
        }
        config.resolution_width = val
            .get("resolution")
            .and_then(|r| r.get("width"))
            .or_else(|| val.get("resolutionWidth"))
            .and_then(|w| w.as_u64())
            .map(|w| w as u32);
        config.resolution_height = val
            .get("resolution")
            .and_then(|r| r.get("height"))
            .or_else(|| val.get("resolutionHeight"))
            .and_then(|h| h.as_u64())
            .map(|h| h as u32);
    }
    config
}

pub fn parse_modrinth_config(content: &str) -> ImportedConfig {
    let mut config = ImportedConfig::default();
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
        config.max_ram_gb = val
            .get("memory")
            .and_then(|m| m.as_f64())
            .map(|mb| (mb / 1024.0 * 10.0).round() / 10.0);
        if let Some(raw_args) = val
            .get("java_args")
            .and_then(|a| a.as_str())
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            let (safe_args, omitted) = sanitize_jvm_args(raw_args);
            config.jvm_args = safe_args;
            if omitted {
                config.has_omitted_jvm_args = Some(true);
            }
        }
        config.resolution_width = val
            .get("resolution")
            .and_then(|r| r.get("width"))
            .and_then(|w| w.as_u64())
            .map(|w| w as u32);
        config.resolution_height = val
            .get("resolution")
            .and_then(|r| r.get("height"))
            .and_then(|h| h.as_u64())
            .map(|h| h as u32);
    }
    config
}

/// Escanea perfiles del Launcher Oficial de Minecraft (.minecraft)
fn scan_mojang_instances(home: &Path, results: &mut Vec<ImportableInstance>) {
    let mc_dir = {
        #[cfg(target_os = "windows")]
        {
            home.join("AppData").join("Roaming").join(".minecraft")
        }
        #[cfg(target_os = "macos")]
        {
            home.join("Library/Application Support/minecraft")
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            home.join(".minecraft")
        }
    };
    if !mc_dir.is_dir() {
        return;
    }

    let profiles_files = [
        mc_dir.join("launcher_profiles.json"),
        mc_dir.join("launcher_profiles_microsoft_store.json"),
    ];

    for pf in &profiles_files {
        if !pf.exists() {
            continue;
        }
        if let Ok(content) = fs::read_to_string(pf) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(profiles) = json.get("profiles").and_then(|p| p.as_object()) {
                    for (key, val) in profiles {
                        let name_raw = val.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let ver_raw = val
                            .get("lastVersionId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("1.21.1");
                        let custom_game_dir = val
                            .get("gameDir")
                            .and_then(|g| g.as_str())
                            .map(PathBuf::from)
                            .unwrap_or_else(|| mc_dir.clone());

                        let inherits_from = read_inherits_from_version_json(&mc_dir, ver_raw);
                        let (loader, mc_ver, loader_ver) =
                            parse_version_string(ver_raw, inherits_from.as_deref());
                        let name = if name_raw.trim().is_empty() {
                            format!("Perfil {}", ver_raw)
                        } else {
                            name_raw.trim().to_string()
                        };

                        let (sanitized_args, has_omitted) = val
                            .get("javaArgs")
                            .and_then(|a| a.as_str())
                            .map(|s| s.trim())
                            .filter(|s| !s.is_empty())
                            .map(sanitize_jvm_args)
                            .unwrap_or((None, false));
                        let (min_ram_gb, max_ram_gb) = val
                            .get("javaArgs")
                            .and_then(|a| a.as_str())
                            .map(parse_ram_from_jvm_args)
                            .unwrap_or((None, None));
                        let resolution_width = val
                            .get("resolution")
                            .and_then(|r| r.get("width"))
                            .and_then(|w| w.as_u64())
                            .map(|w| w as u32);
                        let resolution_height = val
                            .get("resolution")
                            .and_then(|r| r.get("height"))
                            .and_then(|h| h.as_u64())
                            .map(|h| h as u32);

                        let mods_count = count_mods_in_dir(&custom_game_dir);
                        results.push(ImportableInstance {
                            id: format!("mojang-{}", key),
                            source: "mojang".to_string(),
                            source_name: "Minecraft Oficial".to_string(),
                            name,
                            mc_version: mc_ver,
                            loader_type: loader,
                            loader_version: loader_ver,
                            game_dir: custom_game_dir.to_string_lossy().to_string(),
                            mods_count,
                            icon: Some("cube".to_string()),
                            min_ram_gb,
                            max_ram_gb,
                            jvm_args: sanitized_args,
                            resolution_width,
                            resolution_height,
                            has_omitted_jvm_args: if has_omitted { Some(true) } else { None },
                        });
                    }
                }
            }
        }
    }
}

/// Escanea instancias de CurseForge (%USERPROFILE%/curseforge/minecraft/Instances)
fn scan_curseforge_instances(home: &Path, results: &mut Vec<ImportableInstance>) {
    let mut candidates = vec![home.join("curseforge").join("minecraft").join("Instances")];
    #[cfg(target_os = "windows")]
    {
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("curseforge")
                .join("minecraft")
                .join("Instances"),
        );
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push(home.join("Library/Application Support/curseforge/minecraft/Instances"));
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        candidates.push(home.join(".local/share/curseforge/minecraft/Instances"));
    }

    for instances_dir in &candidates {
        if !instances_dir.is_dir() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(instances_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let manifest_file = path.join("minecraftinstance.json");
                if manifest_file.exists() {
                    if let Ok(content) = fs::read_to_string(&manifest_file) {
                        if let Some(manifest) = CurseForgeInstanceManifest::parse(&content) {
                            let fallback_name = path
                                .file_name()
                                .and_then(|f| f.to_str())
                                .unwrap_or("CurseForge Instancia");
                            let name = manifest
                                .name
                                .as_deref()
                                .unwrap_or(fallback_name)
                                .to_string();
                            let mc_ver = manifest
                                .minecraft_version
                                .as_deref()
                                .unwrap_or("1.21.1")
                                .to_string();
                            let (loader, loader_ver) = manifest.loader_info();
                            let cfg = parse_curseforge_config(&content);
                            let min_ram_gb = cfg.min_ram_gb;
                            let max_ram_gb = cfg.max_ram_gb;
                            let jvm_args = cfg.jvm_args;
                            let resolution_width = cfg.resolution_width;
                            let resolution_height = cfg.resolution_height;

                            let mods_count = count_mods_in_dir(&path);
                            results.push(ImportableInstance {
                                id: format!(
                                    "cf-{}",
                                    path.file_name().and_then(|f| f.to_str()).unwrap_or("inst")
                                ),
                                source: "curseforge".to_string(),
                                source_name: "CurseForge".to_string(),
                                name,
                                mc_version: mc_ver,
                                loader_type: loader,
                                loader_version: loader_ver,
                                game_dir: path.to_string_lossy().to_string(),
                                mods_count,
                                icon: Some("flame".to_string()),
                                min_ram_gb,
                                max_ram_gb,
                                jvm_args,
                                resolution_width,
                                resolution_height,
                                has_omitted_jvm_args: cfg.has_omitted_jvm_args,
                            });
                        }
                    }
                }
            }
        }
    }
}

/// Escanea perfiles de Modrinth App (%APPDATA%/ModrinthApp/profiles o com.modrinth.theseus)
fn scan_modrinth_instances(home: &Path, results: &mut Vec<ImportableInstance>) {
    let mut candidates = Vec::new();
    #[cfg(target_os = "windows")]
    {
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("ModrinthApp")
                .join("profiles"),
        );
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("com.modrinth.theseus")
                .join("profiles"),
        );
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push(home.join("Library/Application Support/ModrinthApp/profiles"));
        candidates.push(home.join("Library/Application Support/com.modrinth.theseus/profiles"));
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        candidates.push(home.join(".local/share/ModrinthApp/profiles"));
        candidates.push(home.join(".local/share/com.modrinth.theseus/profiles"));
        candidates.push(home.join(".var/app/com.modrinth.ModrinthApp/data/ModrinthApp/profiles"));
    }

    for profiles_dir in &candidates {
        if !profiles_dir.is_dir() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(profiles_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let folder_name = path
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("Modrinth Instancia")
                    .to_string();

                let mut name = folder_name.clone();
                let mut mc_ver = "1.21.1".to_string();
                let mut loader = "fabric".to_string();
                let mut loader_ver = None;

                let mut min_ram_gb = None;
                let mut max_ram_gb = None;
                let mut jvm_args = None;
                let mut resolution_width = None;
                let mut resolution_height = None;
                let mut has_omitted_jvm_args = None;

                let profile_json = path.join("profile.json");
                if profile_json.exists() {
                    if let Ok(content) = fs::read_to_string(&profile_json) {
                        if let Some(manifest) = ModrinthProfileManifest::parse(&content) {
                            name = manifest.resolved_name(&folder_name).to_string();
                            mc_ver = manifest.resolved_mc_version().to_string();
                            loader = manifest.resolved_loader();
                            loader_ver = manifest.resolved_loader_version();
                        }
                        let cfg = parse_modrinth_config(&content);
                        min_ram_gb = cfg.min_ram_gb;
                        max_ram_gb = cfg.max_ram_gb;
                        jvm_args = cfg.jvm_args;
                        resolution_width = cfg.resolution_width;
                        resolution_height = cfg.resolution_height;
                        has_omitted_jvm_args = cfg.has_omitted_jvm_args;
                    }
                }

                let mods_count = count_mods_in_dir(&path);
                results.push(ImportableInstance {
                    id: format!("mr-{}", folder_name),
                    source: "modrinth".to_string(),
                    source_name: "Modrinth App".to_string(),
                    name,
                    mc_version: mc_ver,
                    loader_type: loader,
                    loader_version: loader_ver,
                    game_dir: path.to_string_lossy().to_string(),
                    mods_count,
                    icon: Some("feather".to_string()),
                    min_ram_gb,
                    max_ram_gb,
                    jvm_args,
                    resolution_width,
                    resolution_height,
                    has_omitted_jvm_args,
                });
            }
        }
    }
}

/// Escanea instancias de Prism Launcher / MultiMC (%APPDATA%/PrismLauncher/instances)
fn scan_prism_instances(home: &Path, results: &mut Vec<ImportableInstance>) {
    let mut candidates = Vec::new();
    #[cfg(target_os = "windows")]
    {
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("PrismLauncher")
                .join("instances"),
        );
        candidates.push(
            home.join("AppData")
                .join("Roaming")
                .join("MultiMC")
                .join("instances"),
        );
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push(home.join("Library/Application Support/PrismLauncher/instances"));
        candidates.push(home.join("Library/Application Support/MultiMC/instances"));
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        candidates.push(home.join(".local/share/PrismLauncher/instances"));
        candidates.push(home.join(".local/share/multimc/instances"));
        candidates.push(
            home.join(".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/instances"),
        );
    }

    for inst_dir in &candidates {
        if !inst_dir.is_dir() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(inst_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let cfg_file = path.join("instance.cfg");
                if !cfg_file.exists() {
                    continue;
                }

                let folder_name = path
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("Prism Instancia")
                    .to_string();

                let mut name = folder_name.clone();
                let mut mc_ver = "1.21.1".to_string();
                let mut loader = "vanilla".to_string();
                let mut loader_ver = None;

                let mut min_ram_gb = None;
                let mut max_ram_gb = None;
                let mut jvm_args = None;
                let mut resolution_width = None;
                let mut resolution_height = None;
                let mut has_omitted_jvm_args = None;

                if let Ok(content) = fs::read_to_string(&cfg_file) {
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if let Some(val) = trimmed.strip_prefix("name=") {
                            name = val.trim().to_string();
                        } else if let Some(val) = trimmed.strip_prefix("IntendedVersion=") {
                            mc_ver = val.trim().to_string();
                        }
                    }
                    let cfg = parse_prism_config(&content);
                    min_ram_gb = cfg.min_ram_gb;
                    max_ram_gb = cfg.max_ram_gb;
                    jvm_args = cfg.jvm_args;
                    resolution_width = cfg.resolution_width;
                    resolution_height = cfg.resolution_height;
                    has_omitted_jvm_args = cfg.has_omitted_jvm_args;
                }

                let mmc_pack = path.join("mmc-pack.json");
                if mmc_pack.exists() {
                    if let Ok(content) = fs::read_to_string(&mmc_pack) {
                        if let Some(manifest) = MmcPackManifest::parse(&content) {
                            let (extracted_mc, extracted_loader, extracted_loader_ver) =
                                manifest.extract_versions();
                            if let Some(v) = extracted_mc {
                                mc_ver = v;
                            }
                            if extracted_loader != "vanilla" {
                                loader = extracted_loader;
                                loader_ver = extracted_loader_ver;
                            }
                        }
                    }
                }

                let effective_game_dir = if path.join(".minecraft").is_dir() {
                    path.join(".minecraft")
                } else if path.join("minecraft").is_dir() {
                    path.join("minecraft")
                } else {
                    path.clone()
                };

                let mods_count = count_mods_in_dir(&effective_game_dir);
                results.push(ImportableInstance {
                    id: format!("prism-{}", folder_name),
                    source: "prism".to_string(),
                    source_name: "Prism Launcher".to_string(),
                    name,
                    mc_version: mc_ver,
                    loader_type: loader,
                    loader_version: loader_ver,
                    game_dir: effective_game_dir.to_string_lossy().to_string(),
                    mods_count,
                    icon: Some("sword".to_string()),
                    min_ram_gb,
                    max_ram_gb,
                    jvm_args,
                    resolution_width,
                    resolution_height,
                    has_omitted_jvm_args,
                });
            }
        }
    }
}

/// Escanea todas las fuentes instaladas en la máquina
pub fn scan_all_external_instances() -> Vec<ImportableInstance> {
    let mut results = Vec::new();
    if let Some(home) = dirs::home_dir() {
        scan_mojang_instances(&home, &mut results);
        scan_curseforge_instances(&home, &mut results);
        scan_modrinth_instances(&home, &mut results);
        scan_prism_instances(&home, &mut results);
    }
    results
}

/// Inspecciona cualquier directorio manual ingresado por el usuario
pub fn inspect_custom_instance_dir(path_str: &str) -> Result<ImportableInstance, String> {
    let path = Path::new(path_str);
    if !path.is_dir() {
        return Err(format!(
            "El directorio especificado no existe: {}",
            path_str
        ));
    }

    let folder_name = path
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("Instancia Importada")
        .to_string();

    let mut name = folder_name.clone();
    let mut mc_ver = "1.21.1".to_string();
    let mut loader = "vanilla".to_string();
    let mut loader_ver = None;

    let mut min_ram_gb = None;
    let mut max_ram_gb = None;
    let mut jvm_args = None;
    let mut resolution_width = None;
    let mut resolution_height = None;
    let mut has_omitted_jvm_args = None;

    // 1. Check if CurseForge
    let cf_file = path.join("minecraftinstance.json");
    if cf_file.exists() {
        if let Ok(c) = fs::read_to_string(&cf_file) {
            if let Some(manifest) = CurseForgeInstanceManifest::parse(&c) {
                let (cf_loader, cf_loader_ver) = manifest.loader_info();
                if cf_loader != "vanilla" {
                    loader = cf_loader;
                    loader_ver = cf_loader_ver;
                }
                if let Some(n) = manifest.name {
                    name = n;
                }
                if let Some(v) = manifest.minecraft_version {
                    mc_ver = v;
                }
            }
            let cfg = parse_curseforge_config(&c);
            if cfg.min_ram_gb.is_some() {
                min_ram_gb = cfg.min_ram_gb;
            }
            if cfg.max_ram_gb.is_some() {
                max_ram_gb = cfg.max_ram_gb;
            }
            if cfg.jvm_args.is_some() {
                jvm_args = cfg.jvm_args;
            }
            if cfg.resolution_width.is_some() {
                resolution_width = cfg.resolution_width;
            }
            if cfg.resolution_height.is_some() {
                resolution_height = cfg.resolution_height;
            }
            if cfg.has_omitted_jvm_args.is_some() {
                has_omitted_jvm_args = cfg.has_omitted_jvm_args;
            }
        }
    }

    // 2. Check if Prism / MultiMC
    let cfg_file = path.join("instance.cfg");
    if cfg_file.exists() {
        if let Ok(c) = fs::read_to_string(&cfg_file) {
            for line in c.lines() {
                if let Some(val) = line.trim().strip_prefix("name=") {
                    name = val.trim().to_string();
                } else if let Some(val) = line.trim().strip_prefix("IntendedVersion=") {
                    mc_ver = val.trim().to_string();
                }
            }
            let cfg = parse_prism_config(&c);
            if cfg.min_ram_gb.is_some() {
                min_ram_gb = cfg.min_ram_gb;
            }
            if cfg.max_ram_gb.is_some() {
                max_ram_gb = cfg.max_ram_gb;
            }
            if cfg.jvm_args.is_some() {
                jvm_args = cfg.jvm_args;
            }
            if cfg.resolution_width.is_some() {
                resolution_width = cfg.resolution_width;
            }
            if cfg.resolution_height.is_some() {
                resolution_height = cfg.resolution_height;
            }
            if cfg.has_omitted_jvm_args.is_some() {
                has_omitted_jvm_args = cfg.has_omitted_jvm_args;
            }
        }
    }

    // 3. Check if Modrinth
    let mr_file = path.join("profile.json");
    if mr_file.exists() {
        if let Ok(c) = fs::read_to_string(&mr_file) {
            if let Some(manifest) = ModrinthProfileManifest::parse(&c) {
                name = manifest.resolved_name(&folder_name).to_string();
                mc_ver = manifest.resolved_mc_version().to_string();
                loader = manifest.resolved_loader();
                loader_ver = manifest.resolved_loader_version();
            }
            let cfg = parse_modrinth_config(&c);
            if cfg.min_ram_gb.is_some() {
                min_ram_gb = cfg.min_ram_gb;
            }
            if cfg.max_ram_gb.is_some() {
                max_ram_gb = cfg.max_ram_gb;
            }
            if cfg.jvm_args.is_some() {
                jvm_args = cfg.jvm_args;
            }
            if cfg.resolution_width.is_some() {
                resolution_width = cfg.resolution_width;
            }
            if cfg.resolution_height.is_some() {
                resolution_height = cfg.resolution_height;
            }
            if cfg.has_omitted_jvm_args.is_some() {
                has_omitted_jvm_args = cfg.has_omitted_jvm_args;
            }
        }
    }

    let mmc_pack = path.join("mmc-pack.json");
    if mmc_pack.exists() {
        if let Ok(content) = fs::read_to_string(&mmc_pack) {
            if let Some(manifest) = MmcPackManifest::parse(&content) {
                let (extracted_mc, extracted_loader, extracted_loader_ver) =
                    manifest.extract_versions();
                if let Some(v) = extracted_mc {
                    mc_ver = v;
                }
                if extracted_loader != "vanilla" {
                    loader = extracted_loader;
                    loader_ver = extracted_loader_ver;
                }
            }
        }
    }

    let effective_game_dir = if path.join(".minecraft").is_dir() {
        path.join(".minecraft")
    } else if path.join("minecraft").is_dir() {
        path.join("minecraft")
    } else {
        path.to_path_buf()
    };

    let mods_count = count_mods_in_dir(&effective_game_dir);
    if mods_count > 0 && loader == "vanilla" {
        // Deducir loader si hay mods pero no hay manifest
        loader = "fabric".to_string();
    }

    Ok(ImportableInstance {
        id: format!("custom-{}", folder_name),
        source: "custom".to_string(),
        source_name: "Carpeta Personalizada".to_string(),
        name,
        mc_version: mc_ver,
        loader_type: loader,
        loader_version: loader_ver,
        game_dir: effective_game_dir.to_string_lossy().to_string(),
        mods_count,
        icon: Some("shield".to_string()),
        min_ram_gb,
        max_ram_gb,
        jvm_args,
        resolution_width,
        resolution_height,
        has_omitted_jvm_args,
    })
}

/// Copia configuraciones clave del Minecraft principal (.minecraft) hacia la carpeta de la instancia objetivo:
/// options.txt (teclas, volumen, renderizado, fov, etc.), optionsof.txt, optionsshaders.txt y servers.dat
pub fn copy_minecraft_settings_to_instance(target_game_dir: &str) -> Result<Vec<String>, String> {
    let target = Path::new(target_game_dir);
    if !target.is_dir() {
        let _ = fs::create_dir_all(target);
    }

    let home = dirs::home_dir()
        .ok_or_else(|| "No se encontró el directorio de usuario (home)".to_string())?;
    #[cfg(target_os = "windows")]
    let default_mc = home.join("AppData").join("Roaming").join(".minecraft");
    #[cfg(target_os = "macos")]
    let default_mc = home.join("Library/Application Support/minecraft");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let default_mc = home.join(".minecraft");

    if !default_mc.is_dir() {
        return Ok(Vec::new());
    }

    // Si el destino es la misma carpeta principal .minecraft, no hay nada que copiar
    if crate::paths::normalize_for_compare(&default_mc)
        == crate::paths::normalize_for_compare(target)
    {
        return Ok(Vec::new());
    }

    let mut copied_files = Vec::new();
    let files_to_copy = [
        "options.txt",
        "optionsof.txt",
        "optionsshaders.txt",
        "servers.dat",
    ];

    for file_name in &files_to_copy {
        let src_file = default_mc.join(file_name);
        let dst_file = target.join(file_name);

        if src_file.is_file() && fs::copy(&src_file, &dst_file).is_ok() {
            copied_files.push(file_name.to_string());
        }
    }

    Ok(copied_files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_string_neoforge() {
        // Con inherits_from explícito desde version json:
        let (loader_auth, mc_ver_auth, loader_ver_auth) =
            parse_version_string("neoforge-21.1.86", Some("1.21.1"));
        assert_eq!(loader_auth, "neoforge");
        assert_eq!(mc_ver_auth, "1.21.1");
        assert_eq!(loader_ver_auth, Some("21.1.86".to_string()));

        // Con inherits_from prioritario sobre cualquier deducción:
        let (loader_prio, mc_ver_prio, _) =
            parse_version_string("neoforge-21.1.86", Some("1.21.3"));
        assert_eq!(loader_prio, "neoforge");
        assert_eq!(mc_ver_prio, "1.21.3");

        // Sin inherits_from (fallback heurístico):
        let (loader, mc_ver, loader_ver) = parse_version_string("neoforge-21.1.86", None);
        assert_eq!(loader, "neoforge");
        assert_eq!(mc_ver, "1.21.1");
        assert_eq!(loader_ver, Some("21.1.86".to_string()));

        let (loader2, mc_ver2, loader_ver2) = parse_version_string("neoforge-21.0.12", None);
        assert_eq!(loader2, "neoforge");
        assert_eq!(mc_ver2, "1.21");
        assert_eq!(loader_ver2, Some("21.0.12".to_string()));

        let (loader3, mc_ver3, loader_ver3) = parse_version_string("neoforge-20.4.80", None);
        assert_eq!(loader3, "neoforge");
        assert_eq!(mc_ver3, "1.20.4");
        assert_eq!(loader_ver3, Some("20.4.80".to_string()));
    }

    #[test]
    fn test_curseforge_manifest_parsing() {
        let json = r#"{
            "name": "Better MC [NEOFORGE] 1.21.1",
            "minecraftVersion": "1.21.1",
            "baseModLoader": {
                "name": "neoforge-21.1.86",
                "forgeVersion": "21.1.86"
            }
        }"#;
        let manifest = CurseForgeInstanceManifest::parse(json).expect("parse curseforge json");
        assert_eq!(
            manifest.name.as_deref(),
            Some("Better MC [NEOFORGE] 1.21.1")
        );
        assert_eq!(manifest.minecraft_version.as_deref(), Some("1.21.1"));
        let (loader, loader_ver) = manifest.loader_info();
        assert_eq!(loader, "neoforge");
        assert_eq!(loader_ver, Some("21.1.86".to_string()));
    }

    #[test]
    fn test_mmc_pack_manifest_parsing() {
        let json = r#"{
            "formatVersion": 1,
            "components": [
                {
                    "uid": "net.minecraft",
                    "version": "1.20.1"
                },
                {
                    "uid": "net.fabricmc.fabric-loader",
                    "version": "0.16.9"
                }
            ]
        }"#;
        let manifest = MmcPackManifest::parse(json).expect("parse mmc-pack json");
        let (mc_ver, loader, loader_ver) = manifest.extract_versions();
        assert_eq!(mc_ver, Some("1.20.1".to_string()));
        assert_eq!(loader, "fabric");
        assert_eq!(loader_ver, Some("0.16.9".to_string()));
    }

    #[test]
    fn test_modrinth_manifest_parsing() {
        let json = r#"{
            "name": "Fabulously Optimized",
            "game_version": "1.21.1",
            "loader": "fabric",
            "loader_version": "0.16.5"
        }"#;
        let manifest = ModrinthProfileManifest::parse(json).expect("parse modrinth json");
        assert_eq!(manifest.resolved_name("fallback"), "Fabulously Optimized");
        assert_eq!(manifest.resolved_mc_version(), "1.21.1");
        assert_eq!(manifest.resolved_loader(), "fabric");
        assert_eq!(
            manifest.resolved_loader_version(),
            Some("0.16.5".to_string())
        );
    }

    #[test]
    fn test_prism_config_parsing() {
        let cfg = r#"
name=Custom Modpack
IntendedVersion=1.20.1
MinMemAlloc=2048
MaxMemAlloc=6144
JvmArgs=-XX:+UseG1GC -Dtest=true
WindowWidth=1920
WindowHeight=1080
"#;
        let cfg = parse_prism_config(cfg);
        assert_eq!(cfg.min_ram_gb, Some(2.0));
        assert_eq!(cfg.max_ram_gb, Some(6.0));
        assert_eq!(cfg.jvm_args, Some("-XX:+UseG1GC -Dtest=true".to_string()));
        assert_eq!(cfg.resolution_width, Some(1920));
        assert_eq!(cfg.resolution_height, Some(1080));
    }

    #[test]
    fn test_curseforge_config_parsing() {
        let json = r#"{
            "allocatedMemory": 8192,
            "customJavaArgs": "-XX:+UnlockExperimentalVMOptions",
            "resolution": { "width": 1600, "height": 900 }
        }"#;
        let cfg = parse_curseforge_config(json);
        assert_eq!(cfg.min_ram_gb, None);
        assert_eq!(cfg.max_ram_gb, Some(8.0));
        assert_eq!(
            cfg.jvm_args,
            Some("-XX:+UnlockExperimentalVMOptions".to_string())
        );
        assert_eq!(cfg.resolution_width, Some(1600));
        assert_eq!(cfg.resolution_height, Some(900));
    }

    #[test]
    fn test_ram_from_jvm_args_parsing() {
        let (min, max) = parse_ram_from_jvm_args("-Xms3G -Xmx7G -XX:+UseG1GC");
        assert_eq!(min, Some(3.0));
        assert_eq!(max, Some(7.0));

        let (min_m, max_m) = parse_ram_from_jvm_args("-Xms1024M -Xmx4096M");
        assert_eq!(min_m, Some(1.0));
        assert_eq!(max_m, Some(4.0));
    }

    #[test]
    fn test_sanitize_jvm_args() {
        let dirty = "-Xms2G -Xmx6G -XX:+UseG1GC -javaagent:evil.jar -agentpath:/tmp/hack.so -Dcustom.prop=true --unrecognized-flag";
        let (safe, omitted) = sanitize_jvm_args(dirty);
        assert!(omitted);
        assert_eq!(
            safe,
            Some("-Xms2G -Xmx6G -XX:+UseG1GC -Dcustom.prop=true".to_string())
        );

        let clean = "-Xms4G -Xmx4G -XX:+UseZGC -Dprism=1";
        let (clean_safe, clean_omitted) = sanitize_jvm_args(clean);
        assert!(!clean_omitted);
        assert_eq!(clean_safe, Some(clean.to_string()));
    }
}
