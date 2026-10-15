use std::fs;
use std::path::{Path, PathBuf};

// Data structures for Adoptium API response
#[derive(serde::Deserialize, Debug)]
struct AdoptiumBinary {
    package: AdoptiumPackage,
}

#[derive(serde::Deserialize, Debug)]
struct AdoptiumPackage {
    link: String,
    checksum: Option<String>,
}

#[derive(serde::Deserialize, Debug)]
struct AdoptiumRelease {
    binary: AdoptiumBinary,
}

pub fn get_os_arch() -> (String, String) {
    let os = std::env::consts::OS; // "windows", "linux", "macos"
    let arch = std::env::consts::ARCH; // "x86_64", "aarch64"

    let api_os = match os {
        "windows" => "windows",
        "linux" => "linux",
        "macos" => "mac",
        _ => "unknown",
    };

    let api_arch = match arch {
        "x86_64" => "x64",
        "aarch64" => "aarch64",
        "x86" => "x32",
        _ => "x64",
    };

    (api_os.to_string(), api_arch.to_string())
}

pub async fn fetch_java_download_url(version: u8) -> Result<(String, Option<String>), String> {
    let (os, arch) = get_os_arch();
    let client = crate::get_shared_http_client();

    let url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot?vendor=eclipse&os={}&architecture={}&image_type=jre",
        version, os, arch
    );

    crate::logger::log(
        "INFO",
        "JavaManager",
        &format!("Consultando Adoptium API para Java {}: {}", version, url),
    );

    let resp = client.get(&url).send().await.map_err(|e| {
        let msg = format!("Error al consultar Adoptium API: {}", e);
        crate::logger::log("ERROR", "JavaManager", &msg);
        msg
    })?;

    if !resp.status().is_success() {
        let msg = format!("Adoptium API Error: {}", resp.status());
        crate::logger::log("ERROR", "JavaManager", &msg);
        return Err(msg);
    }

    let releases: Vec<AdoptiumRelease> = resp.json().await.map_err(|e| {
        let msg = format!("Error al deserializar respuesta de Adoptium: {}", e);
        crate::logger::log("ERROR", "JavaManager", &msg);
        msg
    })?;

    if let Some(release) = releases.first() {
        let link = release.binary.package.link.clone();
        let checksum = release.binary.package.checksum.clone();
        crate::logger::log(
            "INFO",
            "JavaManager",
            &format!(
                "Enlace de descarga resuelto para Java {}: {} (checksum: {:?})",
                version, link, checksum
            ),
        );
        return Ok((link, checksum));
    }

    let not_found_msg = "No se encontraron binarios de Java para esta plataforma".to_string();
    crate::logger::log("ERROR", "JavaManager", &not_found_msg);
    Err(not_found_msg)
}

async fn download_file_to_path<F>(
    download_url: &str,
    zip_path: &Path,
    expected_hash: &crate::downloader::ExpectedHash,
    version: u8,
    on_progress: F,
) -> Result<(), String>
where
    F: FnMut(f32) + Send,
{
    let client = crate::get_shared_http_client();

    crate::downloader::download_verified_with_progress(
        client,
        download_url,
        zip_path,
        expected_hash,
        false,
        Some(on_progress),
    )
    .await
    .map_err(|e| {
        let msg = format!("Error al descargar Java {}: {}", version, e);
        crate::logger::log("ERROR", "JavaManager", &msg);
        msg
    })
}

fn extract_zip_entry<R: std::io::Read>(
    file: &mut zip::read::ZipFile<'_, R>,
    version_dir: &Path,
) -> Result<(), String> {
    let outpath = match file.enclosed_name() {
        Some(path) => version_dir.join(path),
        None => return Ok(()),
    };

    if file.is_dir() || (*file.name()).ends_with('/') {
        fs::create_dir_all(&outpath)
            .map_err(|e| format!("Error al crear directorio en descompresión: {}", e))?;
        return Ok(());
    }

    if let Some(p) = outpath.parent() {
        if !p.exists() {
            fs::create_dir_all(p).map_err(|e| format!("Error al crear parent dir: {}", e))?;
        }
    }
    let mut outfile = fs::File::create(&outpath)
        .map_err(|e| format!("Error al crear archivo de salida: {}", e))?;
    std::io::copy(file, &mut outfile)
        .map_err(|e| format!("Error al copiar contenido de archivo: {}", e))?;
    Ok(())
}

fn extract_zip_archive(zip_path: &Path, version_dir: &Path) -> Result<(), String> {
    let zip_file = fs::File::open(zip_path)
        .map_err(|e| format!("Error al abrir archivo zip de Java: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(zip_file).map_err(|e| format!("Error al leer archivo zip: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Error al descomprimir entrada zip: {}", e))?;
        extract_zip_entry(&mut file, version_dir)?;
    }
    Ok(())
}

fn extract_archive(archive_path: &Path, version_dir: &Path) -> Result<(), String> {
    let file_name = archive_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();

    if file_name.ends_with(".tar.gz") || file_name.ends_with(".tgz") {
        let tar_gz_file = fs::File::open(archive_path)
            .map_err(|e| format!("Error al abrir archivo tar.gz de Java: {}", e))?;
        let tar_gz = flate2::read::GzDecoder::new(tar_gz_file);
        let mut archive = tar::Archive::new(tar_gz);
        archive
            .unpack(version_dir)
            .map_err(|e| format!("Error al extraer archivo tar.gz de Java: {}", e))?;
        Ok(())
    } else {
        extract_zip_archive(archive_path, version_dir)
    }
}

pub fn fetch_graalvm_download_url(version: u8) -> Result<String, String> {
    let (os, arch) = get_os_arch();
    let ext = if os == "windows" { "zip" } else { "tar.gz" };

    if version == 25 {
        let oracle_os = if os == "mac" { "macos" } else { os.as_str() };
        let url = format!(
            "https://download.oracle.com/graalvm/25/latest/graalvm-jdk-25_{}-{}_bin.{}",
            oracle_os, arch, ext
        );
        crate::logger::log(
            "INFO",
            "JavaManager",
            &format!("Enlace de descarga resuelto para GraalVM 25: {}", url),
        );
        return Ok(url);
    }

    let (tag, ver_str) = match version {
        21 => ("jdk-21.0.2", "21.0.2"),
        17 => ("jdk-17.0.9", "17.0.9"),
        _ => {
            return Err(format!(
                "Versión {} de GraalVM no soportada directamente; use Adoptium o Java 17/21/25.",
                version
            ))
        }
    };

    let url = format!(
        "https://github.com/graalvm/graalvm-ce-builds/releases/download/{}/graalvm-community-jdk-{}_{}-{}_bin.{}",
        tag, ver_str, os, arch, ext
    );

    crate::logger::log(
        "INFO",
        "JavaManager",
        &format!(
            "Enlace de descarga resuelto para GraalVM {}: {}",
            version, url
        ),
    );
    Ok(url)
}

pub async fn download_and_install_java<F>(
    version: u8,
    install_dir: &Path,
    distribution: Option<&str>,
    on_progress: F,
) -> Result<PathBuf, String>
where
    F: FnMut(f32) + Send,
{
    let dist = distribution.unwrap_or("adoptium").to_lowercase();
    let is_graalvm = dist.contains("graal");
    let version_dir = if is_graalvm {
        install_dir.join(format!("graalvm-{}", version))
    } else {
        install_dir.join(format!("java-{}", version))
    };

    let (download_url, expected_sha256) = if is_graalvm {
        match fetch_graalvm_download_url(version) {
            Ok(url) => {
                let client = crate::get_shared_http_client();
                let sha256_url = format!("{}.sha256", url);
                let sha = if let Ok(resp) = client.get(&sha256_url).send().await {
                    if resp.status().is_success() {
                        resp.text().await.ok().and_then(|t| {
                            let clean =
                                t.split_whitespace().next().unwrap_or("").trim().to_string();
                            if clean.len() == 64 {
                                Some(clean)
                            } else {
                                None
                            }
                        })
                    } else {
                        None
                    }
                } else {
                    None
                };
                (url, sha)
            }
            Err(e) => {
                crate::logger::log(
                    "WARN",
                    "JavaManager",
                    &format!(
                        "Fallo al resolver GraalVM ({}), recurriendo a Adoptium...",
                        e
                    ),
                );
                fetch_java_download_url(version).await?
            }
        }
    } else {
        fetch_java_download_url(version).await?
    };

    let temp_dir = install_dir.join(".temp");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Error al crear directorio temporal: {}", e))?;

    let file_name = download_url.split('/').next_back().unwrap_or("java.zip");
    let zip_path = temp_dir.join(file_name);

    let expected_hash = match expected_sha256 {
        Some(h) if !h.trim().is_empty() => {
            crate::downloader::ExpectedHash::Sha256(h.trim().to_string())
        }
        _ => crate::downloader::ExpectedHash::None,
    };

    crate::logger::log(
        "INFO",
        "JavaManager",
        &format!("Descargando paquete de Java {} ({})", version, file_name),
    );
    download_file_to_path(
        &download_url,
        &zip_path,
        &expected_hash,
        version,
        on_progress,
    )
    .await?;

    if version_dir.exists() {
        let _ = remove_dir_all_with_retry(&version_dir);
    }
    fs::create_dir_all(&version_dir)
        .map_err(|e| format!("Error al crear carpeta de Java {}: {}", version, e))?;

    crate::logger::log(
        "INFO",
        "JavaManager",
        &format!("Descomprimiendo Java {} en {:?}", version, version_dir),
    );
    let zip_extract_path = zip_path.clone();
    let ver_dir_extract = version_dir.clone();
    tokio::task::spawn_blocking(move || extract_archive(&zip_extract_path, &ver_dir_extract))
        .await
        .map_err(|e| format!("Fallo en hilo de descompresión: {}", e))??;

    let java_exe = find_java_binary(&version_dir).ok_or_else(|| {
        let msg = format!(
            "No se encontró el ejecutable java/javaw tras la extracción de Java {}",
            version
        );
        crate::logger::log("ERROR", "JavaManager", &msg);
        msg
    })?;

    let _ = fs::remove_dir_all(temp_dir);
    crate::logger::log(
        "INFO",
        "JavaManager",
        &format!(
            "Java {} ({}) configurado con éxito. Ejecutable: {:?}",
            version, dist, java_exe
        ),
    );
    Ok(java_exe)
}

pub fn parse_java_major(version_str: &str) -> Option<u32> {
    let clean_str = version_str.trim().trim_matches('"');
    let parts: Vec<&str> = clean_str.split('.').collect();
    if parts.is_empty() {
        return None;
    }
    let extract_num = |s: &str| -> Option<u32> {
        let digits: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
        digits.parse::<u32>().ok()
    };

    if parts[0] == "1" && parts.len() > 1 {
        extract_num(parts[1])
    } else {
        extract_num(parts[0])
    }
}

pub fn read_java_major_from_home(java_home: &Path) -> Option<u32> {
    let release_path = java_home.join("release");
    if let Ok(content) = fs::read_to_string(&release_path) {
        for line in content.lines() {
            if let Some(val) = line.strip_prefix("JAVA_VERSION=") {
                return parse_java_major(val);
            }
        }
    }
    None
}

pub fn get_java_home_from_binary(binary_path: &Path) -> Option<PathBuf> {
    let parent = binary_path.parent()?;
    if parent
        .file_name()?
        .to_string_lossy()
        .eq_ignore_ascii_case("bin")
    {
        parent.parent().map(|p| p.to_path_buf())
    } else {
        Some(parent.to_path_buf())
    }
}

pub fn find_java_binary(root: &Path) -> Option<PathBuf> {
    find_java_binary_with_major(root, None)
}

pub fn find_java_binary_with_major(root: &Path, required_major: Option<u32>) -> Option<PathBuf> {
    let binary_name = if cfg!(windows) { "javaw.exe" } else { "java" };
    let alt_binary_name = if cfg!(windows) { "java.exe" } else { "javaw" };

    let mut matches = Vec::new();

    for entry in walkdir::WalkDir::new(root)
        .max_depth(4)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let fname = entry.file_name().to_string_lossy();
        if fname.eq_ignore_ascii_case(binary_name) || fname.eq_ignore_ascii_case(alt_binary_name) {
            if let Some(parent) = entry.path().parent() {
                if parent
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .eq_ignore_ascii_case("bin")
                {
                    let bin_path = entry.path().to_path_buf();
                    let major = get_java_home_from_binary(&bin_path)
                        .and_then(|home| read_java_major_from_home(&home));

                    if let Some(req) = required_major {
                        if major == Some(req) {
                            matches.push((bin_path, major));
                        }
                    } else {
                        matches.push((bin_path, major));
                    }
                }
            }
        }
    }

    if matches.is_empty() {
        return None;
    }

    matches.sort_by(|(p1, m1), (p2, m2)| {
        let is_javaw1 = p1
            .file_name()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case(binary_name))
            .unwrap_or(false);
        let is_javaw2 = p2
            .file_name()
            .map(|f| f.to_string_lossy().eq_ignore_ascii_case(binary_name))
            .unwrap_or(false);
        is_javaw2.cmp(&is_javaw1).then_with(|| m2.cmp(m1))
    });

    matches.into_iter().map(|(p, _)| p).next()
}

pub fn resolve(requested: Option<&str>, required_major: Option<u32>) -> Result<PathBuf, String> {
    if let Some(req_path_str) = requested {
        let trimmed = req_path_str.trim();
        if !trimmed.is_empty() {
            let candidate = PathBuf::from(trimmed);
            if candidate.exists() {
                if candidate.is_file() {
                    if let Some(req) = required_major {
                        if let Some(home) = get_java_home_from_binary(&candidate) {
                            if let Some(actual_major) = read_java_major_from_home(&home) {
                                if actual_major != req {
                                    return Err(format!(
                                        "El ejecutable Java solicitado en '{:?}' tiene versión {}, pero se requiere Java {}.",
                                        candidate, actual_major, req
                                    ));
                                }
                            }
                        }
                    }
                    return Ok(candidate);
                } else if candidate.is_dir() {
                    if let Some(found) = find_java_binary_with_major(&candidate, required_major) {
                        return Ok(found);
                    }
                }
            }
        }
    }

    if let Some(home) = dirs::home_dir() {
        let ct_runtimes = home.join(".crystaltides").join("runtimes");
        if ct_runtimes.exists() {
            if let Some(found) = find_java_binary_with_major(&ct_runtimes, required_major) {
                return Ok(found);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        for vendor in &[
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Java",
            r"C:\Program Files\Microsoft",
        ] {
            let p = Path::new(vendor);
            if p.is_dir() {
                if let Some(found) = find_java_binary_with_major(p, required_major) {
                    return Ok(found);
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        for p in &[Path::new("/usr/lib/jvm"), Path::new("/usr/java")] {
            if p.is_dir() {
                if let Some(found) = find_java_binary_with_major(p, required_major) {
                    return Ok(found);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let p = Path::new("/Library/Java/JavaVirtualMachines");
        if p.is_dir() {
            if let Some(found) = find_java_binary_with_major(p, required_major) {
                return Ok(found);
            }
        }
    }

    let binary_name = if cfg!(windows) { "javaw.exe" } else { "java" };
    if let Some(paths) = std::env::var_os("PATH") {
        for p in std::env::split_paths(&paths) {
            let full = p.join(binary_name);
            if full.exists() {
                if let Some(req) = required_major {
                    if let Some(home) = get_java_home_from_binary(&full) {
                        if let Some(actual_major) = read_java_major_from_home(&home) {
                            if actual_major == req {
                                return Ok(full);
                            }
                        }
                    }
                } else {
                    return Ok(full);
                }
            }
            #[cfg(windows)]
            {
                let full_java = p.join("java.exe");
                if full_java.exists() {
                    if let Some(req) = required_major {
                        if let Some(home) = get_java_home_from_binary(&full_java) {
                            if let Some(actual_major) = read_java_major_from_home(&home) {
                                if actual_major == req {
                                    return Ok(full_java);
                                }
                            }
                        }
                    } else {
                        return Ok(full_java);
                    }
                }
            }
        }
    }

    Err(format!(
        "No se encontró ninguna instalación de Java{} válida en el sistema ni en los directorios de CrystalTides.",
        required_major
            .map(|m| format!(" {}", m))
            .unwrap_or_default()
    ))
}

fn remove_dir_all_with_retry(path: &Path) -> std::io::Result<()> {
    let mut last_err = None;
    for _ in 0..3 {
        match fs::remove_dir_all(path) {
            Ok(_) => return Ok(()),
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    return Ok(());
                }
                last_err = Some(e);
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }
    }
    Err(last_err
        .unwrap_or_else(|| std::io::Error::other("Failed to remove directory after retries")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_java_major_versions() {
        assert_eq!(parse_java_major("21.0.2"), Some(21));
        assert_eq!(parse_java_major("17.0.9"), Some(17));
        assert_eq!(parse_java_major("1.8.0_312"), Some(8));
        assert_eq!(parse_java_major("25-ea"), Some(25));
        assert_eq!(parse_java_major("\"21.0.2\""), Some(21));
    }

    #[test]
    fn test_read_java_major_from_release_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let release_file = temp_dir.path().join("release");
        std::fs::write(
            &release_file,
            "JAVA_VERSION=\"21.0.2\"\nOS_NAME=\"Windows\"\n",
        )
        .unwrap();

        assert_eq!(read_java_major_from_home(temp_dir.path()), Some(21));
    }
}
