use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

// Data structures for Adoptium API response
#[derive(serde::Deserialize, Debug)]
struct AdoptiumBinary {
    package: AdoptiumPackage,
}

#[derive(serde::Deserialize, Debug)]
struct AdoptiumPackage {
    link: String,
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

pub fn fetch_java_download_url(version: u8) -> Result<String, String> {
    let (os, arch) = get_os_arch();
    let client = reqwest::blocking::Client::builder()
        .user_agent("CrystalTides-Launcher-Lite")
        .build()
        .map_err(|e| format!("Error al crear cliente HTTP: {}", e))?;

    let url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot?vendor=eclipse&os={}&architecture={}&image_type=jre",
        version, os, arch
    );

    crate::logger::log("INFO", "JavaManager", &format!("Consultando Adoptium API para Java {}: {}", version, url));

    let resp = client
        .get(&url)
        .send()
        .map_err(|e| {
            let msg = format!("Error al consultar Adoptium API: {}", e);
            crate::logger::log("ERROR", "JavaManager", &msg);
            msg
        })?;

    if !resp.status().is_success() {
        let msg = format!("Adoptium API Error: {}", resp.status());
        crate::logger::log("ERROR", "JavaManager", &msg);
        return Err(msg);
    }

    let releases: Vec<AdoptiumRelease> = resp
        .json()
        .map_err(|e| {
            let msg = format!("Error al deserializar respuesta de Adoptium: {}", e);
            crate::logger::log("ERROR", "JavaManager", &msg);
            msg
        })?;

    if let Some(release) = releases.first() {
        let link = release.binary.package.link.clone();
        crate::logger::log("INFO", "JavaManager", &format!("Enlace de descarga resuelto para Java {}: {}", version, link));
        return Ok(link);
    }

    let not_found_msg = "No se encontraron binarios de Java para esta plataforma".to_string();
    crate::logger::log("ERROR", "JavaManager", &not_found_msg);
    Err(not_found_msg)
}

fn download_file_to_path<F>(
    download_url: &str,
    zip_path: &Path,
    version: u8,
    mut on_progress: F,
) -> Result<(), String>
where
    F: FnMut(f32),
{
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(300))
        .user_agent("CrystalTides-Launcher-Lite")
        .build()
        .map_err(|e| format!("Error inicializando cliente HTTP para Java: {}", e))?;

    let mut response = client
        .get(download_url)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| {
            let msg = format!("Error al descargar Java {}: {}", version, e);
            crate::logger::log("ERROR", "JavaManager", &msg);
            msg
        })?;
    let total_size = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(zip_path)
        .map_err(|e| format!("Error al crear archivo temporal de Java: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut buffer = [0; 8192];

    loop {
        let count = response
            .read(&mut buffer)
            .map_err(|e| format!("Error de lectura al descargar Java: {}", e))?;
        if count == 0 {
            break;
        }

        file.write_all(&buffer[..count])
            .map_err(|e| format!("Error al escribir archivo de Java: {}", e))?;
        downloaded += count as u64;

        if total_size > 0 {
            on_progress(downloaded as f32 / total_size as f32);
        }
    }
    Ok(())
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
            fs::create_dir_all(p)
                .map_err(|e| format!("Error al crear parent dir: {}", e))?;
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
        crate::logger::log("INFO", "JavaManager", &format!("Enlace de descarga resuelto para GraalVM 25: {}", url));
        return Ok(url);
    }

    let (tag, ver_str) = match version {
        21 => ("jdk-21.0.2", "21.0.2"),
        17 => ("jdk-17.0.9", "17.0.9"),
        _ => return Err(format!("Versión {} de GraalVM no soportada directamente; use Adoptium o Java 17/21/25.", version)),
    };

    let url = format!(
        "https://github.com/graalvm/graalvm-ce-builds/releases/download/{}/graalvm-community-jdk-{}_{}-{}_bin.{}",
        tag, ver_str, os, arch, ext
    );

    crate::logger::log("INFO", "JavaManager", &format!("Enlace de descarga resuelto para GraalVM {}: {}", version, url));
    Ok(url)
}

pub fn download_and_install_java<F>(
    version: u8,
    install_dir: &Path,
    distribution: Option<&str>,
    on_progress: F,
) -> Result<PathBuf, String>
where
    F: FnMut(f32),
{
    let dist = distribution.unwrap_or("adoptium").to_lowercase();
    let is_graalvm = dist.contains("graal");
    let version_dir = if is_graalvm {
        install_dir.join(format!("graalvm-{}", version))
    } else {
        install_dir.join(format!("java-{}", version))
    };

    let download_url = if is_graalvm {
        match fetch_graalvm_download_url(version) {
            Ok(url) => url,
            Err(e) => {
                crate::logger::log(
                    "WARN",
                    "JavaManager",
                    &format!("Fallo al resolver GraalVM ({}), recurriendo a Adoptium...", e),
                );
                fetch_java_download_url(version)?
            }
        }
    } else {
        fetch_java_download_url(version)?
    };

    let temp_dir = install_dir.join(".temp");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Error al crear directorio temporal: {}", e))?;

    let file_name = download_url.split('/').next_back().unwrap_or("java.zip");
    let zip_path = temp_dir.join(file_name);

    crate::logger::log("INFO", "JavaManager", &format!("Descargando paquete de Java {} ({})", version, file_name));
    download_file_to_path(&download_url, &zip_path, version, on_progress)?;

    if version_dir.exists() {
        let _ = remove_dir_all_with_retry(&version_dir);
    }
    fs::create_dir_all(&version_dir)
        .map_err(|e| format!("Error al crear carpeta de Java {}: {}", version, e))?;

    crate::logger::log("INFO", "JavaManager", &format!("Descomprimiendo Java {} en {:?}", version, version_dir));
    extract_archive(&zip_path, &version_dir)?;

    let java_exe = find_java_binary(&version_dir).ok_or_else(|| {
        let msg = format!("No se encontró el ejecutable java/javaw tras la extracción de Java {}", version);
        crate::logger::log("ERROR", "JavaManager", &msg);
        msg
    })?;

    let _ = fs::remove_dir_all(temp_dir);
    crate::logger::log("INFO", "JavaManager", &format!("Java {} ({}) configurado con éxito. Ejecutable: {:?}", version, dist, java_exe));
    Ok(java_exe)
}

pub fn find_java_binary(root: &Path) -> Option<PathBuf> {
    let binary_name = if cfg!(windows) { "javaw.exe" } else { "java" };
    let mut matches = Vec::new();

    for entry in walkdir::WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_name() == binary_name {
            if let Some(parent) = entry.path().parent() {
                if parent.file_name().unwrap_or_default() == "bin" {
                    matches.push(entry.path().to_path_buf());
                }
            }
        }
    }

    if matches.is_empty() {
        return None;
    }

    if matches.len() > 1 {
        matches.sort_by_key(|p| {
            let s = p.to_string_lossy();
            if s.contains("25") {
                0
            } else if s.contains("21") {
                1
            } else if s.contains("17") {
                2
            } else {
                3
            }
        });
    }

    matches.into_iter().next()
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
    Err(last_err.unwrap_or_else(|| std::io::Error::other("Failed to remove directory after retries")))
}
