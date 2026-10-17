use std::path::Path;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExpectedHash {
    None,
    Sha256(String),
    Sha1(String),
}

pub fn compute_file_sha256(path: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn compute_file_sha1(path: &Path) -> Result<String, String> {
    use sha1::{Digest, Sha1};
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub fn verify_file_hash(path: &Path, expected: &ExpectedHash) -> Result<bool, String> {
    match expected {
        ExpectedHash::None => Ok(true),
        ExpectedHash::Sha256(expected_hex) => {
            let actual = compute_file_sha256(path)?;
            Ok(actual.eq_ignore_ascii_case(expected_hex))
        }
        ExpectedHash::Sha1(expected_hex) => {
            let actual = compute_file_sha1(path)?;
            Ok(actual.eq_ignore_ascii_case(expected_hex))
        }
    }
}

pub async fn download_verified(
    client: &reqwest::Client,
    url: &str,
    dest_path: &Path,
    expected_hash: &ExpectedHash,
    repair_mode: bool,
) -> Result<(), String> {
    download_verified_with_progress::<fn(f32)>(
        client,
        url,
        dest_path,
        expected_hash,
        repair_mode,
        None,
    )
    .await
}

pub async fn download_verified_with_progress<F>(
    client: &reqwest::Client,
    url: &str,
    dest_path: &Path,
    expected_hash: &ExpectedHash,
    repair_mode: bool,
    mut on_progress: Option<F>,
) -> Result<(), String>
where
    F: FnMut(f32) + Send,
{
    if dest_path.exists() {
        if let Ok(true) = verify_file_hash(dest_path, expected_hash) {
            if repair_mode || !matches!(expected_hash, ExpectedHash::None) {
                if let Some(ref mut cb) = on_progress {
                    cb(1.0);
                }
                return Ok(());
            }
        }
    }

    if let Some(parent) = dest_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Error creando directorios para {:?}: {}", parent, e))?;
    }

    let extension = dest_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("part");
    let part_path = dest_path.with_extension(format!("{}.part", extension));

    if part_path.exists() {
        let _ = tokio::fs::remove_file(&part_path).await;
    }

    let max_retries = 3;
    let mut last_error = String::new();

    for attempt in 1..=max_retries {
        match download_stream_attempt(
            client,
            url,
            &part_path,
            dest_path,
            expected_hash,
            &mut on_progress,
        )
        .await
        {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_error = e;
                if part_path.exists() {
                    let _ = tokio::fs::remove_file(&part_path).await;
                }
                if attempt < max_retries {
                    let backoff_ms = attempt * 500;
                    tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                }
            }
        }
    }

    Err(format!(
        "Fallo descarga tras {} intentos para {}: {}",
        max_retries, url, last_error
    ))
}

async fn download_stream_attempt<F>(
    client: &reqwest::Client,
    url: &str,
    part_path: &Path,
    dest_path: &Path,
    expected_hash: &ExpectedHash,
    on_progress: &mut Option<F>,
) -> Result<(), String>
where
    F: FnMut(f32) + Send,
{
    use sha1::Sha1;
    use sha2::{Digest, Sha256};

    let mut resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Error de conexión HTTP: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Error HTTP {}: {}", resp.status(), url));
    }

    let total_size = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(part_path)
        .await
        .map_err(|e| format!("Error creando archivo .part {:?}: {}", part_path, e))?;

    let mut sha256_hasher = Sha256::new();
    let mut sha1_hasher = Sha1::new();
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    let mut last_fraction: f32 = 0.0;

    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Error leyendo stream de descarga: {}", e))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Error escribiendo chunk a .part: {}", e))?;

        match expected_hash {
            ExpectedHash::Sha256(_) => sha256_hasher.update(&chunk),
            ExpectedHash::Sha1(_) => sha1_hasher.update(&chunk),
            ExpectedHash::None => {}
        }

        downloaded += chunk.len() as u64;
        if total_size > 0 {
            if let Some(cb) = on_progress.as_mut() {
                let fraction = downloaded as f32 / total_size as f32;
                let now = std::time::Instant::now();
                if (fraction - last_fraction) >= 0.01
                    || now.duration_since(last_emit) >= std::time::Duration::from_millis(100)
                    || downloaded == total_size
                {
                    cb(fraction);
                    last_fraction = fraction;
                    last_emit = now;
                }
            }
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Error en flush de archivo .part: {}", e))?;
    drop(file);

    match expected_hash {
        ExpectedHash::None => {}
        ExpectedHash::Sha256(expected) => {
            let actual = hex::encode(sha256_hasher.finalize());
            if !actual.eq_ignore_ascii_case(expected) {
                return Err(format!(
                    "Discrepancia SHA-256: esperado {}, obtenido {}",
                    expected, actual
                ));
            }
        }
        ExpectedHash::Sha1(expected) => {
            let actual = hex::encode(sha1_hasher.finalize());
            if !actual.eq_ignore_ascii_case(expected) {
                return Err(format!(
                    "Discrepancia SHA-1: esperado {}, obtenido {}",
                    expected, actual
                ));
            }
        }
    }

    if dest_path.exists() {
        let _ = tokio::fs::remove_file(dest_path).await;
    }

    tokio::fs::rename(part_path, dest_path)
        .await
        .map_err(|e| format!("Error en renombramiento atómico a {:?}: {}", dest_path, e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_file_sha256_and_sha1() {
        let temp_dir = tempfile::tempdir().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        std::fs::write(&test_file, b"crystaltides-security-harness").unwrap();

        let sha256 = compute_file_sha256(&test_file).unwrap();
        let sha1 = compute_file_sha1(&test_file).unwrap();

        assert!(!sha256.is_empty());
        assert!(!sha1.is_empty());
        assert_eq!(sha256.len(), 64);
        assert_eq!(sha1.len(), 40);

        assert!(verify_file_hash(&test_file, &ExpectedHash::Sha256(sha256)).unwrap());
        assert!(verify_file_hash(&test_file, &ExpectedHash::Sha1(sha1)).unwrap());
        assert!(!verify_file_hash(&test_file, &ExpectedHash::Sha256("0000".to_string())).unwrap());
        assert!(!verify_file_hash(&test_file, &ExpectedHash::Sha1("0000".to_string())).unwrap());
        assert!(verify_file_hash(&test_file, &ExpectedHash::None).unwrap());
    }
}
