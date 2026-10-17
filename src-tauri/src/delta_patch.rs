use qbsdiff::Bspatch;
use sha1::{Digest, Sha1};
use std::fs;
use std::io::Cursor;

const MAX_PATCH_TARGET_SIZE: u64 = 512 * 1024 * 1024; // 512 MB límite anti-OOM

/// Origen, parche y destino tienen que estar en raíces autorizadas: con un parche vacío,
/// `apply_binary_patch` copia el origen al destino tal cual.
fn validate_patch_path(file_path: &str, param_name: &str) -> Result<std::path::PathBuf, String> {
    crate::paths::validate_safe_file_path(file_path).map_err(|e| format!("{}: {}", param_name, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delta_patch_edge_cases() {
        // Ensures apply_binary_patch gracefully handles non-existent files
        let result = apply_binary_patch_sync(
            "nonexistent_source.jar",
            "nonexistent_patch.patch",
            "target.jar",
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_delta_patch_rejects_paths_outside_authorized_roots() {
        let temp = tempfile::tempdir().expect("tempdir");
        let inside = |name: &str| temp.path().join(name).to_string_lossy().to_string();
        std::fs::write(inside("base.jar"), b"base").expect("write base");
        std::fs::write(inside("p.patch"), b"patch").expect("write patch");

        #[cfg(target_os = "windows")]
        let outside = r"C:\Windows\System32\drivers\etc\hosts";
        #[cfg(not(target_os = "windows"))]
        let outside = "/etc/hosts";

        // Leer un archivo del sistema como origen o escribirlo como destino
        let err = apply_binary_patch_sync(outside, &inside("p.patch"), &inside("out.jar"), None)
            .unwrap_err();
        assert!(err.starts_with("source_file:"), "{err}");
        let err = apply_binary_patch_sync(&inside("base.jar"), &inside("p.patch"), outside, None)
            .unwrap_err();
        assert!(err.starts_with("target_file:"), "{err}");
    }
}

/// Aplica un parche binario delta BSDIFF sobre un archivo base de forma ultra-rápida en memoria (versión síncrona interna)
pub fn apply_binary_patch_sync(
    source_file: &str,
    patch_file: &str,
    target_file: &str,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    let source_path = validate_patch_path(source_file, "source_file")?;
    let patch_path = validate_patch_path(patch_file, "patch_file")?;
    let target_path = validate_patch_path(target_file, "target_file")?;

    if !source_path.exists() {
        return Err(format!("El archivo de origen no existe: {}", source_file));
    }
    if !patch_path.exists() {
        return Err(format!("El archivo de parche no existe: {}", patch_file));
    }

    let source_meta = fs::metadata(&source_path)
        .map_err(|e| format!("Error obteniendo metadata de archivo base: {}", e))?;
    if source_meta.len() > MAX_PATCH_TARGET_SIZE {
        return Err(format!(
            "Tamaño de archivo base ({:.2} MB) excede el límite máximo de seguridad permitido (512 MB)",
            source_meta.len() as f64 / (1024.0 * 1024.0)
        ));
    }

    let patch_meta = fs::metadata(&patch_path)
        .map_err(|e| format!("Error obteniendo metadata de archivo de parche: {}", e))?;
    if patch_meta.len() > MAX_PATCH_TARGET_SIZE {
        return Err(format!(
            "Tamaño de archivo de parche ({:.2} MB) excede el límite máximo de seguridad permitido (512 MB)",
            patch_meta.len() as f64 / (1024.0 * 1024.0)
        ));
    }

    let source_bytes =
        fs::read(&source_path).map_err(|e| format!("Error leyendo archivo base: {}", e))?;
    let patch_bytes =
        fs::read(&patch_path).map_err(|e| format!("Error leyendo archivo de parche: {}", e))?;

    let patcher = Bspatch::new(&patch_bytes)
        .map_err(|e| format!("Error inicializando descompresor bspatch: {}", e))?;

    let hint_size = patcher.hint_target_size();
    if hint_size > MAX_PATCH_TARGET_SIZE {
        return Err(format!(
            "Tamaño objetivo del parche ({:.2} MB) excede el límite máximo de seguridad permitido (512 MB)",
            hint_size as f64 / (1024.0 * 1024.0)
        ));
    }

    let mut target_bytes = Vec::with_capacity(hint_size as usize);
    patcher
        .apply(&source_bytes, Cursor::new(&mut target_bytes))
        .map_err(|e| format!("Error aplicando parche delta bsdiff: {}", e))?;

    // Validar hash SHA-1 si se especificó
    if let Some(expected) = expected_sha1 {
        let mut hasher = Sha1::new();
        hasher.update(&target_bytes);
        let actual_hash = hex::encode(hasher.finalize());

        if !actual_hash.eq_ignore_ascii_case(&expected) {
            return Err(format!(
                "Verificación de integridad fallida: SHA-1 esperado {}, pero se obtuvo {}",
                expected, actual_hash
            ));
        }
    }

    // Asegurar directorio destino
    if let Some(parent) = target_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Escritura atómica
    let temp_target = target_path.with_file_name(format!(
        "{}.tmp_patch",
        target_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
    ));
    fs::write(&temp_target, &target_bytes)
        .map_err(|e| format!("Error escribiendo archivo temporal: {}", e))?;

    fs::rename(&temp_target, target_path)
        .map_err(|e| format!("Error renombrando a archivo destino: {}", e))?;

    crate::logger::log(
        "INFO",
        "DeltaPatch",
        &format!(
            "Parche binario aplicado exitosamente: {} ({} bytes)",
            target_file,
            target_bytes.len()
        ),
    );

    Ok(())
}

/// Aplica un parche binario delta BSDIFF sobre un archivo base de forma ultra-rápida en memoria
#[tauri::command]
pub async fn apply_binary_patch(
    source_file: String,
    patch_file: String,
    target_file: String,
    expected_sha1: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        apply_binary_patch_sync(&source_file, &patch_file, &target_file, expected_sha1)
    })
    .await
    .map_err(|e| e.to_string())?
}
