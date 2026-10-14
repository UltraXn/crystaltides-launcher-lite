use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ImportableInstance {
    pub id: String,
    pub source: String,       // "mojang", "curseforge", "modrinth", "prism", "custom"
    pub source_name: String,  // "Minecraft Oficial", "CurseForge", "Modrinth App", "Prism Launcher", "Personalizada"
    pub name: String,
    pub mc_version: String,
    pub loader_type: String,  // "vanilla", "neoforge", "forge", "fabric", "quilt"
    pub loader_version: Option<String>,
    pub game_dir: String,
    pub mods_count: usize,
    pub icon: Option<String>,
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

fn parse_version_string(ver_str: &str) -> (String, String, Option<String>) {
    let clean = ver_str.trim();
    if clean.starts_with("quilt-loader-") {
        let parts: Vec<&str> = clean.split('-').collect();
        let loader_ver = parts.get(2).map(|s| s.to_string());
        let mc_ver = parts.last().unwrap_or(&"1.21.1").to_string();
        ("quilt".to_string(), mc_ver, loader_ver)
    } else if clean.starts_with("fabric-loader-") {
        let parts: Vec<&str> = clean.split('-').collect();
        let loader_ver = parts.get(2).map(|s| s.to_string());
        let mc_ver = parts.last().unwrap_or(&"1.21.1").to_string();
        ("fabric".to_string(), mc_ver, loader_ver)
    } else if clean.starts_with("neoforge-") {
        let parts: Vec<&str> = clean.split('-').collect();
        let loader_ver = parts.get(1).map(|s| s.to_string());
        let mc_ver = if let Some(ref lv) = loader_ver {
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
        };
        ("neoforge".to_string(), mc_ver, loader_ver)
    } else if clean.contains("-forge-") {
        let parts: Vec<&str> = clean.split("-forge-").collect();
        let mc_ver = parts.first().unwrap_or(&"1.20.1").to_string();
        let loader_ver = parts.get(1).map(|s| s.to_string());
        ("forge".to_string(), mc_ver, loader_ver)
    } else {
        let mc = if clean == "latest-release" {
            "1.21.1".to_string()
        } else if clean == "latest-snapshot" {
            "26.2".to_string()
        } else {
            clean.to_string()
        };
        ("vanilla".to_string(), mc, None)
    }
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

                        let (loader, mc_ver, loader_ver) = parse_version_string(ver_raw);
                        let name = if name_raw.trim().is_empty() {
                            format!("Perfil {}", ver_raw)
                        } else {
                            name_raw.trim().to_string()
                        };

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
        candidates.push(home.join("AppData").join("Roaming").join("curseforge").join("minecraft").join("Instances"));
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
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            let name = json
                                .get("name")
                                .and_then(|n| n.as_str())
                                .unwrap_or_else(|| path.file_name().and_then(|f| f.to_str()).unwrap_or("CurseForge Instancia"))
                                .to_string();

                            let mc_ver = json
                                .get("minecraftVersion")
                                .and_then(|v| v.as_str())
                                .unwrap_or("1.21.1")
                                .to_string();

                            let (loader, loader_ver) = if let Some(bml) = json.get("baseModLoader") {
                                let loader_name = bml.get("name").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();
                                let forge_ver = bml.get("forgeVersion").and_then(|v| v.as_str()).map(|s| s.to_string());
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
                            };

                            let mods_count = count_mods_in_dir(&path);
                            results.push(ImportableInstance {
                                id: format!("cf-{}", path.file_name().and_then(|f| f.to_str()).unwrap_or("inst")),
                                source: "curseforge".to_string(),
                                source_name: "CurseForge".to_string(),
                                name,
                                mc_version: mc_ver,
                                loader_type: loader,
                                loader_version: loader_ver,
                                game_dir: path.to_string_lossy().to_string(),
                                mods_count,
                                icon: Some("flame".to_string()),
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
        candidates.push(home.join("AppData").join("Roaming").join("ModrinthApp").join("profiles"));
        candidates.push(home.join("AppData").join("Roaming").join("com.modrinth.theseus").join("profiles"));
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

                let profile_json = path.join("profile.json");
                if profile_json.exists() {
                    if let Ok(content) = fs::read_to_string(&profile_json) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(n) = json
                                .get("name")
                                .and_then(|v| v.as_str())
                                .or_else(|| json.get("metadata").and_then(|m| m.get("name")).and_then(|v| v.as_str()))
                            {
                                name = n.to_string();
                            }
                            if let Some(v) = json
                                .get("game_version")
                                .and_then(|v| v.as_str())
                                .or_else(|| json.get("metadata").and_then(|m| m.get("game_version")).and_then(|v| v.as_str()))
                            {
                                mc_ver = v.to_string();
                            }
                            if let Some(l) = json
                                .get("loader")
                                .and_then(|v| v.as_str())
                                .or_else(|| json.get("metadata").and_then(|m| m.get("loader")).and_then(|v| v.as_str()))
                            {
                                loader = l.to_lowercase();
                            }
                            loader_ver = json
                                .get("loader_version")
                                .and_then(|v| v.as_str())
                                .or_else(|| json.get("metadata").and_then(|m| m.get("loader_version")).and_then(|v| v.as_str()))
                                .map(|s| s.to_string());
                        }
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
        candidates.push(home.join("AppData").join("Roaming").join("PrismLauncher").join("instances"));
        candidates.push(home.join("AppData").join("Roaming").join("MultiMC").join("instances"));
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
        candidates.push(home.join(".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/instances"));
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

                if let Ok(content) = fs::read_to_string(&cfg_file) {
                    for line in content.lines() {
                        let trimmed = line.trim();
                        if let Some(val) = trimmed.strip_prefix("name=") {
                            name = val.trim().to_string();
                        } else if let Some(val) = trimmed.strip_prefix("IntendedVersion=") {
                            mc_ver = val.trim().to_string();
                        }
                    }
                }

                let mmc_pack = path.join("mmc-pack.json");
                if mmc_pack.exists() {
                    if let Ok(content) = fs::read_to_string(&mmc_pack) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(components) = json.get("components").and_then(|c| c.as_array()) {
                                for comp in components {
                                    let uid = comp.get("uid").and_then(|u| u.as_str()).unwrap_or("");
                                    let ver = comp.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
                                    if uid == "net.minecraft" {
                                        if let Some(v) = ver {
                                            mc_ver = v;
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
        return Err(format!("El directorio especificado no existe: {}", path_str));
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

    // 1. Check if CurseForge
    let cf_file = path.join("minecraftinstance.json");
    if cf_file.exists() {
        if let Ok(c) = fs::read_to_string(&cf_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&c) {
                if let Some(n) = json.get("name").and_then(|v| v.as_str()) {
                    name = n.to_string();
                }
                if let Some(v) = json.get("minecraftVersion").and_then(|v| v.as_str()) {
                    mc_ver = v.to_string();
                }
                if let Some(bml) = json.get("baseModLoader") {
                    let lname = bml.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                    loader_ver = bml.get("forgeVersion").and_then(|v| v.as_str()).map(|s| s.to_string());
                    if lname.contains("neoforge") {
                        loader = "neoforge".to_string();
                    } else if lname.contains("fabric") {
                        loader = "fabric".to_string();
                    } else if lname.contains("quilt") {
                        loader = "quilt".to_string();
                    } else if lname.contains("forge") {
                        loader = "forge".to_string();
                    }
                }
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
        }
    }

    let mmc_pack = path.join("mmc-pack.json");
    if mmc_pack.exists() {
        if let Ok(content) = fs::read_to_string(&mmc_pack) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(components) = json.get("components").and_then(|c| c.as_array()) {
                    for comp in components {
                        let uid = comp.get("uid").and_then(|u| u.as_str()).unwrap_or("");
                        let ver = comp.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
                        if uid == "net.minecraft" {
                            if let Some(v) = ver {
                                mc_ver = v;
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
    })
}

/// Selector nativo de carpetas sin ventana de consola
pub fn pick_folder() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("powershell")
            .args([
                "-Sta",
                "-NoProfile",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecciona la carpeta de la instancia de Minecraft'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            Some(path)
        } else {
            None
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_string_neoforge() {
        let (loader, mc_ver, loader_ver) = parse_version_string("neoforge-21.1.86");
        assert_eq!(loader, "neoforge");
        assert_eq!(mc_ver, "1.21.1");
        assert_eq!(loader_ver, Some("21.1.86".to_string()));

        let (loader2, mc_ver2, loader_ver2) = parse_version_string("neoforge-21.0.12");
        assert_eq!(loader2, "neoforge");
        assert_eq!(mc_ver2, "1.21");
        assert_eq!(loader_ver2, Some("21.0.12".to_string()));

        let (loader3, mc_ver3, loader_ver3) = parse_version_string("neoforge-20.4.80");
        assert_eq!(loader3, "neoforge");
        assert_eq!(mc_ver3, "1.20.4");
        assert_eq!(loader_ver3, Some("20.4.80".to_string()));
    }
}

