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

    println!("[Launcher Lite] Fetching Java {} from: {}", version, url);

    let resp = client
        .get(&url)
        .send()
        .map_err(|e| format!("Error al consultar Adoptium API: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Adoptium API Error: {}", resp.status()));
    }

    let releases: Vec<AdoptiumRelease> = resp
        .json()
        .map_err(|e| format!("Error al deserializar respuesta de Adoptium: {}", e))?;

    if let Some(release) = releases.first() {
        return Ok(release.binary.package.link.clone());
    }

    Err("No se encontraron binarios de Java para esta plataforma".to_string())
}

pub fn download_and_install_java<F>(
    version: u8,
    install_dir: &Path,
    mut on_progress: F,
) -> Result<PathBuf, String>
where
    F: FnMut(f32),
{
    let version_dir = install_dir.join(format!("java-{}", version));

    // 1. Get URL
    let download_url = fetch_java_download_url(version)?;

    // 2. Download
    let temp_dir = install_dir.join(".temp");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Error al crear directorio temporal: {}", e))?;

    let file_name = download_url.split('/').next_back().unwrap_or("java.zip");
    let zip_path = temp_dir.join(file_name);

    let mut response = reqwest::blocking::get(&download_url)
        .map_err(|e| format!("Error al descargar Java: {}", e))?;
    let total_size = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(&zip_path)
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

    // 3. Extract
    if version_dir.exists() {
        let _ = remove_dir_all_with_retry(&version_dir);
    }
    fs::create_dir_all(&version_dir)
        .map_err(|e| format!("Error al crear carpeta de Java {}: {}", version, e))?;

    println!("[Launcher Lite] Extracting Java to {:?}", version_dir);
    let zip_file = fs::File::open(&zip_path)
        .map_err(|e| format!("Error al abrir archivo zip de Java: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(zip_file).map_err(|e| format!("Error al leer archivo zip: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Error al descomprimir entrada zip: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => version_dir.join(path),
            None => continue,
        };

        if file.is_dir() || (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Error al crear directorio en descompresión: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)
                        .map_err(|e| format!("Error al crear parent dir: {}", e))?;
                }
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Error al crear archivo de salida: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Error al copiar contenido de archivo: {}", e))?;
        }
    }

    // 4. Find Java Executable
    let java_exe = find_java_binary(&version_dir)
        .ok_or_else(|| "No se encontró el ejecutable java/javaw tras la extracción".to_string())?;

    // Cleanup
    let _ = fs::remove_dir_all(temp_dir);

    Ok(java_exe)
}

pub fn find_java_binary(root: &Path) -> Option<PathBuf> {
    let binary_name = if cfg!(windows) { "javaw.exe" } else { "java" };

    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_name() == binary_name {
            if let Some(parent) = entry.path().parent() {
                if parent.file_name().unwrap_or_default() == "bin" {
                    return Some(entry.path().to_path_buf());
                }
            }
        }
    }
    None
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
