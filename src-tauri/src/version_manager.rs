use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangVersionManifestEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangVersionManifest {
    pub latest: Option<MojangLatest>,
    pub versions: Vec<MojangVersionManifestEntry>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangLatest {
    pub release: String,
    pub snapshot: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangArtifact {
    pub path: Option<String>,
    pub url: Option<String>,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangDownloads {
    pub client: Option<MojangArtifact>,
    pub server: Option<MojangArtifact>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangLibrary {
    pub name: Option<String>,
    pub downloads: Option<MojangLibraryDownloads>,
    pub rules: Option<Vec<serde_json::Value>>,
}

pub fn is_library_allowed_on_current_os(rules: &Option<Vec<serde_json::Value>>) -> bool {
    let rules = match rules {
        Some(r) if !r.is_empty() => r,
        _ => return true,
    };

    let current_os = match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        other => other,
    };

    let current_arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "x86" => "x86",
        "aarch64" => "arm64",
        "arm" => "arm32",
        other => other,
    };

    let mut allowed = false;
    for rule in rules {
        let action = rule
            .get("action")
            .and_then(|a| a.as_str())
            .unwrap_or("disallow");
        if let Some(os) = rule.get("os").and_then(|o| o.as_object()) {
            let mut matches = true;
            if let Some(os_name) = os.get("name").and_then(|n| n.as_str()) {
                if os_name != current_os {
                    matches = false;
                }
            }
            if let Some(os_arch) = os.get("arch").and_then(|a| a.as_str()) {
                let arch_matches = match (os_arch, current_arch) {
                    ("x86", "x86") => true,
                    ("x64" | "x86_64" | "amd64", "x64") => true,
                    ("arm64" | "aarch64", "arm64") => true,
                    ("arm" | "arm32", "arm32") => true,
                    (a, b) => a == b,
                };
                if !arch_matches {
                    matches = false;
                }
            }
            if matches {
                allowed = action == "allow";
            }
        } else {
            allowed = action == "allow";
        }
    }
    allowed
}

fn current_native_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "x86" => "x86",
        "aarch64" => "arm64",
        "arm" => "arm32",
        other => other,
    }
}

/// Arquitectura declarada justo después del marcador de SO (`natives-windows-x86`,
/// `lwjgl-natives-linux-arm64.jar`...). El sufijo se lee como token completo
/// (`[a-z0-9_]+`), así `x86_64` nunca se confunde con `x86`. Misma lógica que
/// `isLibraryArchAllowed` en `launcherService.ts`.
fn explicit_native_arch(raw_lower: &str) -> Option<&'static str> {
    const OS_MARKERS: [&str; 4] = ["windows", "linux", "osx", "macos"];
    let mut found: Vec<&'static str> = Vec::new();
    for marker in OS_MARKERS {
        for (idx, _) in raw_lower.match_indices(marker) {
            let Some(rest) = raw_lower[idx + marker.len()..].strip_prefix('-') else {
                continue;
            };
            let token_len = rest
                .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
                .unwrap_or(rest.len());
            let arch = match &rest[..token_len] {
                "arm64" | "aarch64" | "aarch_64" => "arm64",
                "x86" | "i386" | "i686" => "x86",
                "arm32" | "armhf" => "arm32",
                "x86_64" | "amd64" | "x64" => "x64",
                _ => continue,
            };
            found.push(arch);
        }
    }
    // Misma prioridad que el frontend si aparecen varias arquitecturas
    ["arm64", "x86", "arm32", "x64"]
        .into_iter()
        .find(|arch| found.contains(arch))
}

/// Natives genéricos sin sufijo de arquitectura (`natives-windows`, `-natives-linux.jar`):
/// Mojang los publica para x64.
fn is_generic_native(raw_lower: &str) -> bool {
    [
        "natives-windows",
        "natives-macos",
        "natives-osx",
        "natives-linux",
    ]
    .iter()
    .any(|marker| {
        raw_lower.match_indices(marker).any(|(idx, _)| {
            let rest = &raw_lower[idx + marker.len()..];
            rest.is_empty()
                || rest.starts_with(char::is_whitespace)
                || [".jar", "_jar", "@jar", ".zip", "_zip", "@zip"]
                    .iter()
                    .any(|ext| rest.starts_with(ext))
        })
    })
}

fn is_library_arch_allowed(lib: &MojangLibrary) -> bool {
    is_library_arch_allowed_for(lib, current_native_arch())
}

fn is_library_arch_allowed_for(lib: &MojangLibrary, current_arch: &str) -> bool {
    let mut raw_id = String::new();
    if let Some(name) = &lib.name {
        raw_id.push_str(name);
        raw_id.push(' ');
    }
    if let Some(downloads) = &lib.downloads {
        if let Some(artifact) = &downloads.artifact {
            if let Some(path) = &artifact.path {
                raw_id.push_str(path);
            }
        }
    }
    let raw_lower = raw_id.to_lowercase();
    if raw_lower.trim().is_empty() {
        return true;
    }

    let is_native = raw_lower.contains("native")
        || raw_lower.contains("windows")
        || raw_lower.contains("osx")
        || raw_lower.contains("macos")
        || raw_lower.contains("linux");

    if !is_native {
        return true;
    }

    if let Some(arch) = explicit_native_arch(&raw_lower) {
        return current_arch == arch;
    }

    if is_generic_native(&raw_lower) {
        return current_arch == "x64";
    }

    true
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangLibraryDownloads {
    pub artifact: Option<MojangArtifact>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangAssetIndexRef {
    pub id: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
    #[serde(rename = "totalSize")]
    pub total_size: Option<u64>,
    pub url: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct MojangVersionDetail {
    pub id: String,
    pub downloads: Option<MojangDownloads>,
    pub libraries: Option<Vec<MojangLibrary>>,
    #[serde(rename = "mainClass")]
    pub main_class: Option<String>,
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<MojangAssetIndexRef>,
    pub assets: Option<String>,
    #[serde(rename = "inheritsFrom")]
    pub inherits_from: Option<String>,
}

fn get_appdata_minecraft_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| {
        #[cfg(target_os = "windows")]
        {
            h.join("AppData").join("Roaming").join(".minecraft")
        }
        #[cfg(target_os = "macos")]
        {
            h.join("Library")
                .join("Application Support")
                .join("minecraft")
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            h.join(".minecraft")
        }
    })
}

#[derive(PartialEq, Eq, PartialOrd, Ord)]
enum VersionChunk<'a> {
    Num(u64),
    Str(&'a str),
}

fn to_natural_chunks(s: &str) -> Vec<VersionChunk<'_>> {
    let mut chunks = Vec::new();
    let mut chars = s.char_indices().peekable();

    while let Some(&(i, c)) = chars.peek() {
        if c.is_ascii_digit() {
            let start = i;
            while let Some(&(_, next_c)) = chars.peek() {
                if next_c.is_ascii_digit() {
                    chars.next();
                } else {
                    break;
                }
            }
            let end = chars.peek().map(|&(idx, _)| idx).unwrap_or(s.len());
            let num = s[start..end].parse::<u64>().unwrap_or(0);
            chunks.push(VersionChunk::Num(num));
        } else {
            let start = i;
            while let Some(&(_, next_c)) = chars.peek() {
                if !next_c.is_ascii_digit() {
                    chars.next();
                } else {
                    break;
                }
            }
            let end = chars.peek().map(|&(idx, _)| idx).unwrap_or(s.len());
            chunks.push(VersionChunk::Str(&s[start..end]));
        }
    }

    chunks
}

/// Scans local directories for all installed versions with a .json file
pub fn get_installed_versions() -> Vec<String> {
    let mut versions = Vec::new();
    let home = dirs::home_dir();

    if let Some(ref h) = home {
        // 1. Check ~/.crystaltides/versions
        let ct_versions = h.join(".crystaltides").join("versions");
        scan_versions_in_dir(&ct_versions, &mut versions);

        // 2. Check %APPDATA%/.minecraft/versions
        if let Some(mc_dir) = get_appdata_minecraft_dir() {
            let mc_versions = mc_dir.join("versions");
            scan_versions_in_dir(&mc_versions, &mut versions);
        }
    }

    // Ordenamiento natural semántico descendente (ej. 1.21.1 > 1.20 > 1.9 > 1.8.9)
    versions.sort_by(|a, b| to_natural_chunks(b).cmp(&to_natural_chunks(a)));
    versions.dedup();

    // Prioritize 1.21.1 at the top of Minecraft versions
    if let Some(pos) = versions.iter().position(|v| v == "1.21.1") {
        let v = versions.remove(pos);
        versions.insert(0, v);
    }

    versions
}

fn check_version_entry(entry: &fs::DirEntry) -> Option<String> {
    let file_type = entry.file_type().ok()?;
    if !file_type.is_dir() {
        return None;
    }
    let folder_name = entry.file_name().to_string_lossy().to_string();
    let json_path = entry.path().join(format!("{}.json", folder_name));
    if json_path.exists() {
        Some(folder_name)
    } else {
        None
    }
}

fn scan_versions_in_dir(dir: &Path, versions: &mut Vec<String>) {
    if !dir.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Some(folder_name) = check_version_entry(&entry) {
                versions.push(folder_name);
            }
        }
    }
}

fn try_copy_from_local_minecraft(version_id: &str, target_jar: &Path, target_json: &Path) -> bool {
    if let Some(mc_dir) = get_appdata_minecraft_dir() {
        let mc_ver_dir = mc_dir.join("versions").join(version_id);
        let mc_jar = mc_ver_dir.join(format!("{}.jar", version_id));
        let mc_json = mc_ver_dir.join(format!("{}.json", version_id));

        let target_json_invalid = !target_json.exists()
            || target_json
                .metadata()
                .map(|m| m.len() == 0)
                .unwrap_or(false);
        if mc_json.exists() && target_json_invalid {
            let _ = fs::copy(&mc_json, target_json);
        }

        let target_jar_invalid =
            !target_jar.exists() || target_jar.metadata().map(|m| m.len() < 22).unwrap_or(false);
        if mc_jar.exists()
            && mc_jar.metadata().map(|m| m.len() >= 22).unwrap_or(false)
            && target_jar_invalid
        {
            let _ = fs::copy(&mc_jar, target_jar);
            println!(
                "[VersionManager] Copied {} jar and json from .minecraft",
                version_id
            );
            return true;
        }
    }
    false
}

async fn fetch_mojang_version_detail(
    client: &reqwest::Client,
    version_id: &str,
    target_json: &Path,
) -> Result<MojangVersionDetail, String> {
    println!(
        "[VersionManager] Downloading manifest for {} from Mojang...",
        version_id
    );
    let manifest_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    let manifest_resp = client
        .get(manifest_url)
        .send()
        .await
        .map_err(|e| format!("Error conectando con Mojang: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Error HTTP en manifiesto de Mojang: {}", e))?;
    let manifest: MojangVersionManifest = manifest_resp
        .json()
        .await
        .map_err(|e| format!("Error parseando manifiesto de Mojang: {}", e))?;

    let version_entry = manifest.versions.iter().find(|v| v.id == version_id)
        .ok_or_else(|| format!("Versión '{}' no encontrada en el catálogo oficial de Mojang ni en instalaciones locales.", version_id))?;

    println!(
        "[VersionManager] Found version entry URL: {}",
        version_entry.url
    );
    let detail_resp = client
        .get(&version_entry.url)
        .send()
        .await
        .map_err(|e| format!("Error descargando json de versión: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Error HTTP al descargar json de versión: {}", e))?;
    let detail_bytes = detail_resp.bytes().await.map_err(|e| e.to_string())?;

    fs::write(target_json, &detail_bytes)
        .map_err(|e| format!("Error guardando {}.json: {}", version_id, e))?;

    let detail: MojangVersionDetail = serde_json::from_slice(&detail_bytes)
        .map_err(|e| format!("Error parseando detalle de versión: {}", e))?;

    Ok(detail)
}

async fn download_client_jar(
    client: &reqwest::Client,
    version_id: &str,
    detail: &MojangVersionDetail,
    target_jar: &Path,
) -> Result<(), String> {
    let client_download = detail.downloads.as_ref().and_then(|d| d.client.as_ref());
    let url = match client_download.and_then(|c| c.url.as_ref()) {
        Some(u) => u,
        None => return Ok(()),
    };
    let sha1_expected = client_download.and_then(|c| c.sha1.as_deref());

    println!("[VersionManager] Downloading client.jar from {}...", url);
    let jar_resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Error descargando client.jar: {}", e))?
        .error_for_status()
        .map_err(|e| format!("Error HTTP descargando client.jar: {}", e))?;
    let jar_bytes = jar_resp.bytes().await.map_err(|e| e.to_string())?;

    if let Some(expected_hash) = sha1_expected {
        use sha1::Digest;
        let mut hasher = sha1::Sha1::new();
        hasher.update(&jar_bytes);
        let computed = format!("{:x}", hasher.finalize());
        if !computed.eq_ignore_ascii_case(expected_hash) {
            return Err(format!(
                "SHA-1 mismatch para client.jar ({}): esperada {}, obtenida {}",
                version_id, expected_hash, computed
            ));
        }
    }

    fs::write(target_jar, &jar_bytes)
        .map_err(|e| format!("Error guardando {}.jar: {}", version_id, e))?;
    println!(
        "[VersionManager] client.jar downloaded successfully ({} bytes).",
        jar_bytes.len()
    );
    Ok(())
}

async fn download_single_library(
    client: reqwest::Client,
    rel_path: String,
    url: String,
    sha1_expected: Option<String>,
    libraries_dir: PathBuf,
    mc_lib_dir: Option<PathBuf>,
) -> Result<(), String> {
    let rel_p = Path::new(&rel_path);
    if rel_p.is_absolute()
        || rel_p
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(format!(
            "rel_path inválido o intento de path traversal: {}",
            rel_path
        ));
    }

    let target_lib_path = libraries_dir.join(&rel_path);
    let expected_hash = match sha1_expected {
        Some(ref h) => crate::downloader::ExpectedHash::Sha1(h.clone()),
        None => crate::downloader::ExpectedHash::None,
    };

    if target_lib_path.exists() {
        if let Ok(true) = crate::downloader::verify_file_hash(&target_lib_path, &expected_hash) {
            return Ok(());
        }
        let _ = fs::remove_file(&target_lib_path);
    }

    if let Some(ref mc_libs) = mc_lib_dir {
        let mc_lib_path = mc_libs.join(&rel_path);
        if mc_lib_path.exists() {
            if let Ok(true) = crate::downloader::verify_file_hash(&mc_lib_path, &expected_hash) {
                if let Some(parent) = target_lib_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                if fs::copy(&mc_lib_path, &target_lib_path).is_ok() {
                    return Ok(());
                }
            }
        }
    }

    crate::downloader::download_verified(&client, &url, &target_lib_path, &expected_hash, true)
        .await
        .map_err(|e| format!("Error descargando biblioteca {}: {}", rel_path, e))
}

async fn download_missing_libraries(
    client: &reqwest::Client,
    game_dir: &Path,
    detail: &MojangVersionDetail,
) -> Result<(), String> {
    let libraries = match &detail.libraries {
        Some(libs) => libs,
        None => return Ok(()),
    };

    let libraries_dir = game_dir.join("libraries");
    let mc_lib_dir = get_appdata_minecraft_dir().map(|d| d.join("libraries"));

    let mut missing_libs = Vec::new();
    for lib in libraries {
        if !is_library_allowed_on_current_os(&lib.rules) {
            continue;
        }
        if !is_library_arch_allowed(lib) {
            continue;
        }
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                if let (Some(rel_path), Some(url)) = (&artifact.path, &artifact.url) {
                    missing_libs.push((rel_path.clone(), url.clone(), artifact.sha1.clone()));
                }
            }
        }
    }

    let mut errors = Vec::new();
    for chunk in missing_libs.chunks(15) {
        let mut handles = Vec::new();
        for (rel_path, url, sha1) in chunk {
            let c = client.clone();
            let rp = rel_path.clone();
            let u = url.clone();
            let s = sha1.clone();
            let ld = libraries_dir.clone();
            let mc = mc_lib_dir.clone();
            handles.push(tokio::spawn(download_single_library(c, rp, u, s, ld, mc)));
        }
        for h in handles {
            match h.await {
                Ok(Ok(())) => {}
                Ok(Err(e)) => errors.push(e),
                Err(join_err) => errors.push(format!("Error en tarea de biblioteca: {}", join_err)),
            }
        }
    }

    if !errors.is_empty() {
        return Err(format!(
            "Falló la descarga de {} biblioteca(s) de Minecraft (ej: {})",
            errors.len(),
            errors[0]
        ));
    }

    Ok(())
}

fn read_cached_asset_index(
    target_index_file: &Path,
    mc_index_file: Option<&PathBuf>,
) -> Option<String> {
    if target_index_file.exists() {
        return fs::read_to_string(target_index_file).ok();
    }
    let mc_idx = mc_index_file?;
    if !mc_idx.exists() {
        return None;
    }
    let content = fs::read_to_string(mc_idx).ok()?;
    let _ = fs::write(target_index_file, &content);
    Some(content)
}

async fn download_asset_index_content(
    client: &reqwest::Client,
    asset_ref: &MojangAssetIndexRef,
    target_index_file: &Path,
    mc_index_file: Option<&PathBuf>,
) -> Option<String> {
    println!(
        "[VersionManager] Downloading asset index {} from {}...",
        asset_ref.id, asset_ref.url
    );
    let resp = client.get(&asset_ref.url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let text = resp.text().await.ok()?;
    let _ = fs::write(target_index_file, &text);
    if let Some(mc_idx) = mc_index_file {
        if let Some(parent) = mc_idx.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(mc_idx, &text);
    }
    Some(text)
}

async fn resolve_asset_index_content(
    client: &reqwest::Client,
    asset_ref: &MojangAssetIndexRef,
    target_index_file: &Path,
    mc_index_file: Option<&PathBuf>,
) -> Option<String> {
    if let Some(cached) = read_cached_asset_index(target_index_file, mc_index_file) {
        return Some(cached);
    }
    download_asset_index_content(client, asset_ref, target_index_file, mc_index_file).await
}

fn collect_missing_asset_objects(
    objects: &serde_json::Map<String, serde_json::Value>,
    objects_dir: &Path,
    mc_objects_dir: Option<&PathBuf>,
) -> Vec<(String, String)> {
    let mut missing_objects = Vec::new();
    for (_obj_name, obj_val) in objects {
        let hash = match obj_val.get("hash").and_then(|h| h.as_str()) {
            Some(h) if h.len() == 40 && h.bytes().all(|b| b.is_ascii_hexdigit()) => h,
            _ => continue,
        };

        let size = obj_val.get("size").and_then(|s| s.as_u64());
        let prefix = &hash[..2];
        let target_obj = objects_dir.join(prefix).join(hash);
        if target_obj.exists() {
            let valid = if let Some(expected_size) = size {
                target_obj
                    .metadata()
                    .map(|m| m.len() == expected_size)
                    .unwrap_or(false)
            } else {
                crate::downloader::verify_file_hash(
                    &target_obj,
                    &crate::downloader::ExpectedHash::Sha1(hash.to_string()),
                )
                .unwrap_or(false)
            };
            if valid {
                continue;
            }
            let _ = fs::remove_file(&target_obj);
        }

        if let Some(mc_objs) = mc_objects_dir {
            let mc_obj = mc_objs.join(prefix).join(hash);
            if mc_obj.exists() {
                let valid = if let Some(expected_size) = size {
                    mc_obj
                        .metadata()
                        .map(|m| m.len() == expected_size)
                        .unwrap_or(false)
                } else {
                    crate::downloader::verify_file_hash(
                        &mc_obj,
                        &crate::downloader::ExpectedHash::Sha1(hash.to_string()),
                    )
                    .unwrap_or(false)
                };
                if valid {
                    if let Some(parent) = target_obj.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    if fs::copy(&mc_obj, &target_obj).is_ok() {
                        continue;
                    }
                }
            }
        }

        missing_objects.push((prefix.to_string(), hash.to_string()));
    }
    missing_objects
}

async fn fetch_single_asset_object(
    client: reqwest::Client,
    url: String,
    expected_hash: String,
    target_file: PathBuf,
    mc_file: Option<PathBuf>,
) -> Result<(), String> {
    let expected = crate::downloader::ExpectedHash::Sha1(expected_hash);
    crate::downloader::download_verified(&client, &url, &target_file, &expected, true)
        .await
        .map_err(|e| format!("Error descargando asset {}: {}", url, e))?;

    if let Some(mc_f) = mc_file {
        if let Some(p) = mc_f.parent() {
            let _ = fs::create_dir_all(p);
        }
        let _ = fs::copy(&target_file, &mc_f);
    }

    Ok(())
}

async fn download_missing_asset_objects_parallel(
    client: &reqwest::Client,
    missing_objects: &[(String, String)],
    objects_dir: &Path,
    mc_objects_dir: Option<&PathBuf>,
) -> Result<(), String> {
    let mut errors = Vec::new();
    for chunk in missing_objects.chunks(25) {
        let mut handles = Vec::new();
        for (prefix, hash) in chunk {
            let url = format!(
                "https://resources.download.minecraft.net/{}/{}",
                prefix, hash
            );
            let target_file = objects_dir.join(prefix).join(hash);
            let mc_file = mc_objects_dir.map(|d| d.join(prefix).join(hash));
            let c = client.clone();
            let expected_hash = hash.clone();
            handles.push(tokio::spawn(fetch_single_asset_object(
                c,
                url,
                expected_hash,
                target_file,
                mc_file,
            )));
        }
        for h in handles {
            match h.await {
                Ok(Ok(())) => {}
                Ok(Err(e)) => errors.push(e),
                Err(join_err) => errors.push(format!("Error en tarea de asset: {}", join_err)),
            }
        }
    }

    if !errors.is_empty() {
        return Err(format!(
            "Falló la descarga de {} asset(s) de Minecraft (ej: {})",
            errors.len(),
            errors[0]
        ));
    }

    println!("[VersionManager] Asset objects downloaded successfully.");
    Ok(())
}

async fn download_missing_assets(
    client: &reqwest::Client,
    game_dir: &Path,
    detail: &MojangVersionDetail,
) -> Result<(), String> {
    let asset_ref = match &detail.asset_index {
        Some(r) => r,
        None => return Ok(()),
    };

    let assets_dir = game_dir.join("assets");
    let indexes_dir = assets_dir.join("indexes");
    let objects_dir = assets_dir.join("objects");
    let _ = fs::create_dir_all(&indexes_dir);
    let _ = fs::create_dir_all(&objects_dir);
    let target_index_file = indexes_dir.join(format!("{}.json", asset_ref.id));

    let mc_assets_dir = get_appdata_minecraft_dir().map(|d| d.join("assets"));
    let mc_index_file = mc_assets_dir
        .as_ref()
        .map(|a| a.join("indexes").join(format!("{}.json", asset_ref.id)));

    let index_content = resolve_asset_index_content(
        client,
        asset_ref,
        &target_index_file,
        mc_index_file.as_ref(),
    )
    .await
    .ok_or_else(|| {
        format!(
            "No se pudo descargar o resolver el índice de assets '{}' desde {}",
            asset_ref.id, asset_ref.url
        )
    })?;

    let parsed_idx: serde_json::Value = serde_json::from_str(&index_content)
        .map_err(|e| format!("Error parseando índice de assets '{}': {}", asset_ref.id, e))?;

    let objects = parsed_idx
        .get("objects")
        .and_then(|o| o.as_object())
        .ok_or_else(|| {
            format!(
                "El índice de assets '{}' no contiene un objeto 'objects' válido",
                asset_ref.id
            )
        })?;

    let mc_objects_dir = mc_assets_dir.as_ref().map(|a| a.join("objects"));
    let missing_objects =
        collect_missing_asset_objects(objects, &objects_dir, mc_objects_dir.as_ref());

    if !missing_objects.is_empty() {
        println!(
            "[VersionManager] Downloading {} missing assets for index {}...",
            missing_objects.len(),
            asset_ref.id
        );
        download_missing_asset_objects_parallel(
            client,
            &missing_objects,
            &objects_dir,
            mc_objects_dir.as_ref(),
        )
        .await?;
    }

    Ok(())
}

/// Ensures the version's jar and json exist in the game directory.
/// If not present, attempts to copy from .minecraft or download from Mojang.
pub async fn prepare_version(version_id: &str, game_dir_str: &str) -> Result<String, String> {
    let game_dir = Path::new(game_dir_str);
    let target_ver_dir = game_dir.join("versions").join(version_id);
    let target_jar = target_ver_dir.join(format!("{}.jar", version_id));
    let target_json = target_ver_dir.join(format!("{}.json", version_id));

    fs::create_dir_all(&target_ver_dir)
        .map_err(|e| format!("No se pudo crear carpeta de versión {}: {}", version_id, e))?;

    if target_jar.exists() {
        if let Ok(meta) = target_jar.metadata() {
            if meta.len() < 22 {
                let _ = fs::remove_file(&target_jar);
            }
        }
    }

    // 1. Try copying from local .minecraft (no retornar prematuramente para asegurar librerías y assets)
    let _ = try_copy_from_local_minecraft(version_id, &target_jar, &target_json);

    // 2. Download from Mojang Piston Meta or load existing version JSON
    let client = crate::get_shared_http_client();

    let detail = if target_json.exists() {
        if let Ok(bytes) = fs::read(&target_json) {
            serde_json::from_slice(&bytes).ok()
        } else {
            None
        }
    } else {
        None
    };

    let detail = match detail {
        Some(d) => d,
        None => fetch_mojang_version_detail(client, version_id, &target_json).await?,
    };

    let client_sha1 = detail
        .downloads
        .as_ref()
        .and_then(|d| d.client.as_ref())
        .and_then(|c| c.sha1.as_deref());

    let need_download_jar = if !target_jar.exists() {
        true
    } else if let Some(expected_hash) = client_sha1 {
        if let Ok(bytes) = fs::read(&target_jar) {
            use sha1::Digest;
            let mut hasher = sha1::Sha1::new();
            hasher.update(&bytes);
            let computed = format!("{:x}", hasher.finalize());
            if !computed.eq_ignore_ascii_case(expected_hash) {
                println!(
                    "[VersionManager] Hash SHA-1 de client.jar corrupto o desactualizado (esperado: {}, actual: {}). Re-descargando...",
                    expected_hash, computed
                );
                true
            } else {
                false
            }
        } else {
            true
        }
    } else {
        false
    };

    if need_download_jar {
        download_client_jar(client, version_id, &detail, &target_jar).await?;
    }

    if !target_jar.exists() {
        if let Some(ref base_mc) = detail.inherits_from {
            let base_jar = game_dir
                .join("versions")
                .join(base_mc)
                .join(format!("{}.jar", base_mc));
            if base_jar.exists() && base_jar.metadata().map(|m| m.len() >= 22).unwrap_or(false) {
                let _ = fs::copy(&base_jar, &target_jar);
            }
        }
    }

    download_missing_libraries(client, game_dir, &detail).await?;
    download_missing_assets(client, game_dir, &detail).await?;

    Ok(format!("Versión {} preparada exitosamente.", version_id))
}

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn ensure_launcher_profiles(game_dir: &Path) {
    let profiles_file = game_dir.join("launcher_profiles.json");
    if !profiles_file.exists() {
        let minimal_profiles = serde_json::json!({
            "profiles": {
                "crystaltides": {
                    "name": "CrystalTides",
                    "type": "custom",
                    "created": "2026-01-01T00:00:00.000Z",
                    "lastUsed": "2026-01-01T00:00:00.000Z",
                    "lastVersionId": "1.21.1"
                }
            },
            "settings": {
                "crashAssistance": true,
                "enableAdvanced": true
            },
            "version": 3
        });
        let _ = fs::write(&profiles_file, minimal_profiles.to_string());
    }
}

fn resolve_java_path(provided: &str, game_dir: &str) -> PathBuf {
    let req = if !provided.is_empty() {
        Some(provided)
    } else {
        None
    };

    let candidate = crate::java_manager::resolve(req, None).unwrap_or_else(|_| {
        let runtimes_dir = Path::new(game_dir).join("runtimes");
        crate::java_manager::find_java_binary(&runtimes_dir)
            .unwrap_or_else(|| PathBuf::from("java"))
    });

    #[cfg(target_os = "windows")]
    {
        let file_name = candidate.file_name().and_then(|f| f.to_str()).unwrap_or("");
        if file_name.eq_ignore_ascii_case("javaw.exe") {
            if let Some(parent) = candidate.parent() {
                let java_exe = parent.join("java.exe");
                if java_exe.exists() {
                    return java_exe;
                }
            }
        }
    }

    candidate
}

fn is_disposable_artifact(name_lower: &str) -> bool {
    let is_jar = name_lower.ends_with(".jar") && name_lower.contains("installer");
    let is_log = (name_lower.ends_with(".log") || name_lower.ends_with(".txt"))
        && name_lower.contains("installer");
    let is_crash = (name_lower.starts_with("hs_err_pid") || name_lower.starts_with("replay_pid"))
        && name_lower.ends_with(".log");
    is_jar || is_log || is_crash
}

fn remove_artifact_entry(entry: fs::DirEntry) {
    let path = entry.path();
    if !path.is_file() {
        return;
    }

    let file_name = entry.file_name();
    let name_str = file_name.to_string_lossy().to_lowercase();
    if !is_disposable_artifact(&name_str) {
        return;
    }

    if let Err(e) = fs::remove_file(&path) {
        crate::logger::log(
            "WARN",
            "VersionManager",
            &format!("No se pudo eliminar residuo temporal {:?}: {}", path, e),
        );
    } else {
        crate::logger::log(
            "INFO",
            "VersionManager",
            &format!(
                "Residuo de instalación eliminado automáticamente: {:?}",
                file_name
            ),
        );
    }
}

/// Limpia automáticamente archivos temporales de instalación y volcados de fallos de la JVM
/// que puedan haber quedado en el directorio raíz del juego.
pub fn cleanup_installer_artifacts(game_dir: &Path) {
    if !game_dir.is_dir() {
        return;
    }

    if let Ok(entries) = fs::read_dir(game_dir) {
        for entry in entries.flatten() {
            remove_artifact_entry(entry);
        }
    }
}

fn sanitize_mc_version(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with("quilt-loader-") || trimmed.starts_with("fabric-loader-") {
        if let Some(idx) = trimmed.rfind('-') {
            let candidate = &trimmed[idx + 1..];
            if candidate.chars().any(|c| c.is_ascii_digit()) {
                return candidate.to_string();
            }
        }
    }
    if let Some(idx) = trimmed.find("-NeoForge") {
        return trimmed[..idx].to_string();
    }
    if let Some(idx) = trimmed.find("-forge") {
        return trimmed[..idx].to_string();
    }
    trimmed.to_string()
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LoaderType {
    Fabric,
    Quilt,
    Neoforge,
    Forge,
    Vanilla,
}

impl std::str::FromStr for LoaderType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "fabric" => Ok(LoaderType::Fabric),
            "quilt" => Ok(LoaderType::Quilt),
            "neoforge" => Ok(LoaderType::Neoforge),
            "forge" => Ok(LoaderType::Forge),
            "vanilla" => Ok(LoaderType::Vanilla),
            _ => Err(format!("Tipo de cargador desconocido: {}", s)),
        }
    }
}

impl LoaderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            LoaderType::Fabric => "fabric",
            LoaderType::Quilt => "quilt",
            LoaderType::Neoforge => "neoforge",
            LoaderType::Forge => "forge",
            LoaderType::Vanilla => "vanilla",
        }
    }
}

pub async fn install_mod_loader(
    loader_type: &str,
    loader_version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let clean_mc = sanitize_mc_version(mc_version);
    let mc_version = clean_mc.as_str();

    let game_path = Path::new(game_dir);
    ensure_launcher_profiles(game_path);
    cleanup_installer_artifacts(game_path);

    // Ensure the base vanilla version files exist before installing mod loader
    let _ = prepare_version(mc_version, game_dir).await;

    let parsed_loader = loader_type.parse::<LoaderType>()?;
    let res = match parsed_loader {
        LoaderType::Fabric => install_fabric(loader_version, mc_version, game_dir, java_path).await,
        LoaderType::Quilt => install_quilt(loader_version, mc_version, game_dir, java_path).await,
        LoaderType::Neoforge | LoaderType::Forge => {
            install_forge_family(
                parsed_loader.as_str(),
                loader_version,
                mc_version,
                game_dir,
                java_path,
            )
            .await
        }
        LoaderType::Vanilla => Ok("Instancia Vanilla lista.".to_string()),
    };

    cleanup_installer_artifacts(game_path);
    res
}

async fn fetch_maven_checksum(
    client: &reqwest::Client,
    jar_url: &str,
) -> crate::downloader::ExpectedHash {
    let sha256_url = format!("{}.sha256", jar_url);
    if let Ok(resp) = client.get(&sha256_url).send().await {
        if resp.status().is_success() {
            if let Ok(text) = resp.text().await {
                let clean = text.split_whitespace().next().unwrap_or("").trim();
                if clean.len() == 64 && clean.chars().all(|c| c.is_ascii_hexdigit()) {
                    return crate::downloader::ExpectedHash::Sha256(clean.to_string());
                }
            }
        }
    }

    let sha1_url = format!("{}.sha1", jar_url);
    if let Ok(resp) = client.get(&sha1_url).send().await {
        if resp.status().is_success() {
            if let Ok(text) = resp.text().await {
                let clean = text.split_whitespace().next().unwrap_or("").trim();
                if clean.len() == 40 && clean.chars().all(|c| c.is_ascii_hexdigit()) {
                    return crate::downloader::ExpectedHash::Sha1(clean.to_string());
                }
            }
        }
    }

    crate::downloader::ExpectedHash::None
}

async fn download_file_to(
    url: &str,
    path: &Path,
    expected_hash: &crate::downloader::ExpectedHash,
) -> Result<(), String> {
    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!("Descargando instalador: {}", url),
    );
    let client = crate::get_shared_http_client();

    crate::downloader::download_verified(client, url, path, expected_hash, false).await
}

async fn install_fabric(
    loader_version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let installer_url =
        "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar";
    let installer_path = Path::new(game_dir).join("fabric-installer.jar");

    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!("Descargando Fabric installer: {}", installer_url),
    );
    const FABRIC_INSTALLER_SHA256: &str =
        "62edf170bdcc41edea85d33acf3eb85474258699b3d41f9418d286c836cb088d";
    let hash = crate::downloader::ExpectedHash::Sha256(FABRIC_INSTALLER_SHA256.to_string());
    download_file_to(installer_url, &installer_path, &hash).await?;

    let resolved_java = resolve_java_path(java_path, game_dir);
    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!("Ejecutando Fabric Installer con Java: {:?}", resolved_java),
    );
    let mut cmd = std::process::Command::new(resolved_java);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("client")
        .arg("-mcversion")
        .arg(mc_version)
        .arg("-loader")
        .arg(loader_version)
        .arg("-dir")
        .arg(game_dir)
        .arg("-noprofile");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = tokio::task::spawn_blocking(move || cmd.output())
        .await
        .map_err(|e| {
            let _ = fs::remove_file(&installer_path);
            let err_str = format!("Fallo en hilo de ejecución de Fabric: {}", e);
            crate::logger::log("ERROR", "VersionManager", &err_str);
            err_str
        })?
        .map_err(|e| {
            let _ = fs::remove_file(&installer_path);
            let err_str = format!("Fallo al ejecutar instalador Fabric: {}", e);
            crate::logger::log("ERROR", "VersionManager", &err_str);
            err_str
        })?;
    let _ = fs::remove_file(&installer_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = format!("Instalador Fabric falló: {}", stderr);
        crate::logger::log("ERROR", "VersionManager", &err_msg);
        return Err(err_msg);
    }

    let ok_msg = format!(
        "Fabric {} para Minecraft {} instalado exitosamente.",
        loader_version, mc_version
    );
    crate::logger::log("INFO", "VersionManager", &ok_msg);
    Ok(ok_msg)
}

async fn install_quilt(
    loader_version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let installer_url = "https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/0.9.2/quilt-installer-0.9.2.jar";
    let installer_path = Path::new(game_dir).join("quilt-installer.jar");

    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!("Descargando Quilt installer: {}", installer_url),
    );
    const QUILT_INSTALLER_SHA256: &str =
        "c3ad3e23eee860e5185c594e7cb280e4fabe7e766a83945381d9a99c64855c5b";
    let hash = crate::downloader::ExpectedHash::Sha256(QUILT_INSTALLER_SHA256.to_string());
    download_file_to(installer_url, &installer_path, &hash).await?;

    let resolved_java = resolve_java_path(java_path, game_dir);
    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!("Ejecutando Quilt Installer con Java: {:?}", resolved_java),
    );
    let mut cmd = std::process::Command::new(resolved_java);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("install")
        .arg("client")
        .arg(mc_version)
        .arg(loader_version)
        .arg(format!("--install-dir={}", game_dir))
        .arg("--no-profile");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = tokio::task::spawn_blocking(move || cmd.output())
        .await
        .map_err(|e| {
            let _ = fs::remove_file(&installer_path);
            let err_str = format!("Fallo en hilo de ejecución de Quilt: {}", e);
            crate::logger::log("ERROR", "VersionManager", &err_str);
            err_str
        })?
        .map_err(|e| {
            let _ = fs::remove_file(&installer_path);
            let err_str = format!("Fallo al ejecutar instalador Quilt: {}", e);
            crate::logger::log("ERROR", "VersionManager", &err_str);
            err_str
        })?;
    let _ = fs::remove_file(&installer_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        crate::logger::log(
            "ERROR",
            "VersionManager",
            &format!("Instalador Quilt falló (stderr completo): {}", stderr),
        );
        let concise_err = stderr
            .lines()
            .find(|line| {
                line.contains("IllegalArgumentException:")
                    || line.contains("Exception:")
                    || line.contains("Error:")
            })
            .map(|l| {
                if let Some(pos) = l.find("IllegalArgumentException:") {
                    l[pos + "IllegalArgumentException:".len()..]
                        .trim()
                        .to_string()
                } else if let Some(pos) = l.find("Exception:") {
                    l[pos + "Exception:".len()..].trim().to_string()
                } else {
                    l.trim().to_string()
                }
            })
            .unwrap_or_else(|| {
                stderr
                    .lines()
                    .filter(|l| !l.trim().is_empty())
                    .take(1)
                    .collect::<Vec<_>>()
                    .join(" ")
            });
        let err_msg = format!(
            "Instalador Quilt falló: {}",
            if concise_err.is_empty() {
                "Error desconocido al ejecutar instalador"
            } else {
                &concise_err
            }
        );
        return Err(err_msg);
    }

    let ok_msg = format!(
        "Quilt {} para Minecraft {} instalado exitosamente.",
        loader_version, mc_version
    );
    crate::logger::log("INFO", "VersionManager", &ok_msg);
    Ok(ok_msg)
}

async fn install_forge_family(
    loader_type: &str,
    version: &str,
    mc_version: &str,
    game_dir: &str,
    java_path: &str,
) -> Result<String, String> {
    let (url, file_name) = match loader_type.to_lowercase().as_str() {
        "neoforge" => {
            let name = format!("neoforge-{}-installer.jar", version);
            (
                format!(
                    "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/{}",
                    version, name
                ),
                name,
            )
        }
        "forge" => {
            let full_forge_ver = if version.starts_with(&format!("{}-", mc_version)) {
                version.to_string()
            } else {
                format!("{}-{}", mc_version, version)
            };
            let name = format!("forge-{}-installer.jar", full_forge_ver);
            let url = format!(
                "https://maven.minecraftforge.net/net/minecraftforge/forge/{}/{}",
                full_forge_ver, name
            );
            (url, name)
        }
        _ => return Err("Loader no soportado en familia Forge.".to_string()),
    };

    let installer_path = Path::new(game_dir).join(&file_name);
    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!("Descargando {} installer: {}", loader_type, url),
    );
    let client = crate::get_shared_http_client();
    let hash = fetch_maven_checksum(client, &url).await;
    download_file_to(&url, &installer_path, &hash).await?;

    let resolved_java = resolve_java_path(java_path, game_dir);
    crate::logger::log(
        "INFO",
        "VersionManager",
        &format!(
            "Ejecutando instalador de {} con Java: {:?}",
            loader_type, resolved_java
        ),
    );
    let mut cmd = std::process::Command::new(resolved_java);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("--installClient")
        .arg(game_dir)
        .current_dir(game_dir);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = tokio::task::spawn_blocking(move || cmd.output())
        .await
        .map_err(|e| {
            let _ = fs::remove_file(&installer_path);
            let err_str = format!("Fallo en hilo de ejecución de instalador: {}", e);
            crate::logger::log("ERROR", "VersionManager", &err_str);
            err_str
        })?
        .map_err(|e| {
            let _ = fs::remove_file(&installer_path);
            let err_str = format!("Fallo al ejecutar instalador {}: {}", loader_type, e);
            crate::logger::log("ERROR", "VersionManager", &err_str);
            err_str
        })?;
    let _ = fs::remove_file(&installer_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err_msg = format!("Instalador {} falló: {}", loader_type, stderr);
        crate::logger::log("ERROR", "VersionManager", &err_msg);
        return Err(err_msg);
    }

    let ok_msg = format!("{} {} instalado exitosamente.", loader_type, version);
    crate::logger::log("INFO", "VersionManager", &ok_msg);
    Ok(ok_msg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minecraft_version_natural_sorting() {
        let mut versions = vec![
            "1.8.9".to_string(),
            "1.9".to_string(),
            "1.12.2".to_string(),
            "1.16.5".to_string(),
            "1.20.1".to_string(),
            "1.21".to_string(),
            "1.21.1".to_string(),
        ];
        versions.sort_by(|a, b| to_natural_chunks(b).cmp(&to_natural_chunks(a)));
        assert_eq!(
            versions,
            vec!["1.21.1", "1.21", "1.20.1", "1.16.5", "1.12.2", "1.9", "1.8.9"]
        );
    }

    #[test]
    fn test_is_library_allowed_on_current_os() {
        let none_rules = None;
        assert!(is_library_allowed_on_current_os(&none_rules));

        let empty_rules = Some(vec![]);
        assert!(is_library_allowed_on_current_os(&empty_rules));

        let allow_all = Some(vec![serde_json::json!({"action": "allow"})]);
        assert!(is_library_allowed_on_current_os(&allow_all));

        let allow_windows = Some(vec![serde_json::json!({
            "action": "allow",
            "os": {"name": "windows"}
        })]);
        #[cfg(target_os = "windows")]
        assert!(is_library_allowed_on_current_os(&allow_windows));
        #[cfg(not(target_os = "windows"))]
        assert!(!is_library_allowed_on_current_os(&allow_windows));

        let disallow_current_os = Some(vec![
            serde_json::json!({"action": "allow"}),
            serde_json::json!({
                "action": "disallow",
                "os": {"name": match std::env::consts::OS { "windows" => "windows", "macos" => "osx", "linux" => "linux", o => o }}
            }),
        ]);
        assert!(!is_library_allowed_on_current_os(&disallow_current_os));
    }

    fn native_lib(name: &str, path: &str) -> MojangLibrary {
        serde_json::from_value(serde_json::json!({
            "name": name,
            "downloads": {"artifact": {"path": path}}
        }))
        .expect("librería de prueba válida")
    }

    #[test]
    fn test_is_library_arch_allowed_for() {
        let generic = native_lib(
            "org.lwjgl:lwjgl:3.3.3:natives-windows",
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar",
        );
        let x86 = native_lib(
            "org.lwjgl:lwjgl:3.3.3:natives-windows-x86",
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-x86.jar",
        );
        let x86_64 = native_lib(
            "org.lwjgl:lwjgl:3.3.3:natives-windows-x86_64",
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-x86_64.jar",
        );
        let arm64 = native_lib(
            "org.lwjgl:lwjgl:3.3.3:natives-windows-arm64",
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-arm64.jar",
        );
        let plain = native_lib(
            "com.google.guava:guava:32.1.2-jre",
            "com/google/guava/guava-32.1.2-jre.jar",
        );

        assert!(is_library_arch_allowed_for(&generic, "x64"));
        assert!(!is_library_arch_allowed_for(&generic, "arm64"));

        assert!(is_library_arch_allowed_for(&x86, "x86"));
        assert!(!is_library_arch_allowed_for(&x86, "x64"));

        // Regresión: `natives-windows-x86_64` se trataba como 32 bits y se descartaba en x64
        assert!(is_library_arch_allowed_for(&x86_64, "x64"));
        assert!(!is_library_arch_allowed_for(&x86_64, "x86"));

        assert!(is_library_arch_allowed_for(&arm64, "arm64"));
        assert!(!is_library_arch_allowed_for(&arm64, "x64"));

        assert!(is_library_arch_allowed_for(&plain, "x64"));
        assert!(is_library_arch_allowed_for(&plain, "arm64"));
    }

    #[test]
    fn test_loader_type_parsing() {
        assert_eq!("fabric".parse::<LoaderType>().unwrap(), LoaderType::Fabric);
        assert_eq!("FABRIC".parse::<LoaderType>().unwrap(), LoaderType::Fabric);
        assert_eq!("Quilt".parse::<LoaderType>().unwrap(), LoaderType::Quilt);
        assert_eq!(
            "NeoForge".parse::<LoaderType>().unwrap(),
            LoaderType::Neoforge
        );
        assert_eq!("forge".parse::<LoaderType>().unwrap(), LoaderType::Forge);
        assert_eq!(
            "vanilla".parse::<LoaderType>().unwrap(),
            LoaderType::Vanilla
        );
        assert!("unknown".parse::<LoaderType>().is_err());
    }
}
