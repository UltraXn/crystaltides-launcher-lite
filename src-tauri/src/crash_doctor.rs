use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CrashType {
    OutOfMemory,
    MixinConflict,
    GraphicsDriver,
    CorruptedConfig,
    JavaMismatch,
    MissingDependency,
    GenericCrash,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SuggestedAction {
    IncreaseRam,
    DisableMod,
    UpdateGpuDriver,
    ResetOptions,
    UpdateJava,
    ViewLogs,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CrashDiagnosis {
    pub crash_type: CrashType,
    pub title: String,
    pub explanation: String,
    pub offending_mod: Option<String>,
    pub recommendation: String,
    pub suggested_action: Option<SuggestedAction>,
    pub log_snippet: Option<String>,
}

fn check_oom_exit_code(code: i32) -> Option<CrashDiagnosis> {
    if code == 137 {
        Some(CrashDiagnosis {
            crash_type: CrashType::OutOfMemory,
            title: "Agotamiento de Memoria RAM (OutOfMemory)".to_string(),
            explanation: format!(
                "El proceso de la JVM fue abortado por el sistema operativo debido a falta de memoria RAM asignada (Código: {}).",
                code
            ),
            offending_mod: None,
            recommendation: "Aumenta la asignación de memoria RAM en Ajustes > Memoria del Launcher.".to_string(),
            suggested_action: Some(SuggestedAction::IncreaseRam),
            log_snippet: Some(format!("Process terminated with OOM exit code: {}", code)),
        })
    } else if code == -1073740791 {
        Some(CrashDiagnosis {
            crash_type: CrashType::GraphicsDriver,
            title: "Desbordamiento de Búfer / Fallo Crítico de Driver Gráfico".to_string(),
            explanation: "El proceso colapsó por una violación de integridad o desbordamiento nativo en la pila del controlador de GPU (STATUS_STACK_BUFFER_OVERRUN - 0xC0000409).".to_string(),
            offending_mod: None,
            recommendation: "Actualiza los controladores de tu GPU (NVIDIA / AMD / Intel) a su versión más reciente o reinstálalos limpiamente.".to_string(),
            suggested_action: Some(SuggestedAction::UpdateGpuDriver),
            log_snippet: Some("Process terminated with NTSTATUS 0xC0000409 (STATUS_STACK_BUFFER_OVERRUN)".to_string()),
        })
    } else {
        None
    }
}

fn read_newest_crash_report(base: &Path) -> Option<String> {
    let crash_reports_dir = base.join("crash-reports");
    if !crash_reports_dir.exists() || !crash_reports_dir.is_dir() {
        return None;
    }
    let entries = fs::read_dir(&crash_reports_dir).ok()?;
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "txt"))
        .collect();
    files.sort_by_key(|p| fs::metadata(p).and_then(|m| m.modified()).ok());
    let newest = files.last()?;

    // Verificar que el reporte sea reciente (< 120 segundos) para no ignorar el latest.log actual
    if let Ok(meta) = fs::metadata(newest) {
        if let Ok(modified) = meta.modified() {
            if let Ok(elapsed) = std::time::SystemTime::now().duration_since(modified) {
                if elapsed.as_secs() > 120 {
                    return None;
                }
            }
        }
    }

    fs::read_to_string(newest).ok()
}

fn read_fallback_log_text(base: &Path) -> String {
    let ichor_file = base.join("logs").join("ichor-boot.log");
    let logs_file = base.join("logs").join("latest.log");
    let target_log = if ichor_file.exists() {
        ichor_file
    } else {
        logs_file
    };

    if target_log.exists() {
        // Ignorar logs obsoletos de sesiones pasadas (> 300 segundos)
        if let Ok(meta) = fs::metadata(&target_log) {
            if let Ok(modified) = meta.modified() {
                if let Ok(elapsed) = std::time::SystemTime::now().duration_since(modified) {
                    if elapsed.as_secs() > 300 {
                        return String::new();
                    }
                }
            }
        }

        if let Ok(content) = fs::read_to_string(&target_log) {
            let lines: Vec<&str> = content.lines().collect();
            let start = if lines.len() > 300 {
                lines.len() - 300
            } else {
                0
            };
            return lines[start..].join("\n");
        }
    }
    String::new()
}

fn match_diagnosis_patterns(text: &str, exit_code: Option<i32>) -> CrashDiagnosis {
    if text.contains("java.lang.OutOfMemoryError")
        || text.contains("Could not reserve enough space")
        || text.contains("unable to create native thread")
    {
        return CrashDiagnosis {
            crash_type: CrashType::OutOfMemory,
            title: "Falta de Memoria RAM (OutOfMemoryError)".to_string(),
            explanation: "La máquina virtual Java excedió el límite de memoria asignada al cargar texturas o chunks.".to_string(),
            offending_mod: None,
            recommendation: "Aumenta la RAM a un mínimo de 4096 MB en Ajustes del Launcher.".to_string(),
            suggested_action: Some(SuggestedAction::IncreaseRam),
            log_snippet: extract_snippet(text, "OutOfMemoryError"),
        };
    }

    if text.contains("ZipException: zip file is empty")
        || text.contains("zip file is empty")
        || (text.contains("ZipException") && text.contains("error reading"))
    {
        return CrashDiagnosis {
            crash_type: CrashType::CorruptedConfig,
            title: "Archivo JAR Corrupto o Vacío (ZipException)".to_string(),
            explanation: "Un archivo JAR en la versión o librerías de la instancia está vacío (0 bytes) o corrupto, provocando un error en el cargador de Minecraft.".to_string(),
            offending_mod: None,
            recommendation: "El Launcher ha detectado y eliminado automáticamente el archivo corrupto. Vuelve a iniciar para regenerarlo.".to_string(),
            suggested_action: Some(SuggestedAction::ViewLogs),
            log_snippet: extract_snippet(text, "ZipException"),
        };
    }

    if let Some(offending) = find_offending_mod_in_log(text) {
        return CrashDiagnosis {
            crash_type: CrashType::MixinConflict,
            title: format!("Conflicto de Bytecode en Mod: {}", offending),
            explanation: format!("El mod '{}' colisionó al inyectar Mixins sobre el motor de Minecraft.", offending),
            offending_mod: Some(offending.clone()),
            recommendation: format!("Desactiva '{}' haciendo clic en 'Desactivar Mod' o actualízalo a su versión más reciente.", offending),
            suggested_action: Some(SuggestedAction::DisableMod),
            log_snippet: extract_snippet(text, &offending),
        };
    }

    if text.contains("UnsupportedClassVersionError")
        || text.contains("has been compiled by a more recent version of the Java Runtime")
    {
        return CrashDiagnosis {
            crash_type: CrashType::JavaMismatch,
            title: "Incompatibilidad de Versión de Java".to_string(),
            explanation: "Uno de los componentes o mods de Minecraft fue compilado con una versión de Java más moderna que la instalada en tu equipo (ej. requiere Java 21).".to_string(),
            offending_mod: None,
            recommendation: "Instala o selecciona Java 21 OpenJDK en los Ajustes del Launcher.".to_string(),
            suggested_action: Some(SuggestedAction::UpdateJava),
            log_snippet: extract_snippet(text, "UnsupportedClassVersionError")
                .or_else(|| extract_snippet(text, "compiled by a more recent version")),
        };
    }

    if text.contains("nvoglv64.dll")
        || text.contains("atio6axx.dll")
        || text.contains("ig9icd64.dll")
        || text.contains("EXCEPTION_ACCESS_VIOLATION")
    {
        return CrashDiagnosis {
            crash_type: CrashType::GraphicsDriver,
            title: "Fallo Crítico de Driver Gráfico (OpenGL)".to_string(),
            explanation: "El controlador de tu tarjeta gráfica sufrió una violación de acceso al interactuar con el pipeline OpenGL.".to_string(),
            offending_mod: None,
            recommendation: "Actualiza los controladores de tu GPU (NVIDIA / AMD / Intel) desde su panel oficial.".to_string(),
            suggested_action: Some(SuggestedAction::UpdateGpuDriver),
            log_snippet: extract_snippet(text, "EXCEPTION_ACCESS_VIOLATION"),
        };
    }

    if text.contains("requires any version of") || text.contains("Could not find required mod") {
        return CrashDiagnosis {
            crash_type: CrashType::MissingDependency,
            title: "Falta de Dependencia Requerida".to_string(),
            explanation: "Uno de tus mods instalados requiere una librería complementaria (ej. Fabric API o Architectury) para funcionar.".to_string(),
            offending_mod: find_offending_mod_in_log(text),
            recommendation: "Instala la dependencia indicada o desactiva el mod en conflicto.".to_string(),
            suggested_action: Some(SuggestedAction::ViewLogs),
            log_snippet: extract_snippet(text, "requires")
                .or_else(|| extract_snippet(text, "Could not find required mod")),
        };
    }

    if text.contains("options.txt") || text.contains("shaders.properties") {
        return CrashDiagnosis {
            crash_type: CrashType::CorruptedConfig,
            title: "Configuración de Opciones Corrupta".to_string(),
            explanation: "El archivo options.txt contiene parámetros gráficos que el motor actual no puede parsear.".to_string(),
            offending_mod: None,
            recommendation: "Restablece options.txt a sus valores por defecto con 1 clic.".to_string(),
            suggested_action: Some(SuggestedAction::ResetOptions),
            log_snippet: extract_snippet(text, "options.txt"),
        };
    }

    CrashDiagnosis {
        crash_type: CrashType::GenericCrash,
        title: "Crash Inesperado de Minecraft".to_string(),
        explanation: format!("El juego colapsó con código de salida {:?}.", exit_code),
        offending_mod: None,
        recommendation: "Revisa los registros detallados en la pestaña de Logs.".to_string(),
        suggested_action: None,
        log_snippet: Some(text.lines().take(20).collect::<Vec<&str>>().join("\n")),
    }
}

pub fn analyze_latest_crash_sync(
    game_dir: &str,
    exit_code: Option<i32>,
) -> Result<CrashDiagnosis, String> {
    let base = Path::new(game_dir);
    let mut latest_crash_text = read_newest_crash_report(base).unwrap_or_default();
    if latest_crash_text.is_empty() {
        latest_crash_text = read_fallback_log_text(base);
    }

    if latest_crash_text.is_empty() {
        if let Some(code) = exit_code {
            if let Some(diag) = check_oom_exit_code(code) {
                return Ok(diag);
            }
        }

        return Ok(CrashDiagnosis {
            crash_type: CrashType::GenericCrash,
            title: "Cierre Inesperado de Minecraft".to_string(),
            explanation: format!(
                "El proceso terminó con código {}. No se encontraron reportes de crash detallados.",
                exit_code.unwrap_or(1)
            ),
            offending_mod: None,
            recommendation:
                "Verifica que tus controladores gráficos y la versión de Java sean compatibles."
                    .to_string(),
            suggested_action: None,
            log_snippet: None,
        });
    }

    let diag = match_diagnosis_patterns(&latest_crash_text, exit_code);
    if diag.crash_type == CrashType::GenericCrash {
        if let Some(code) = exit_code {
            if let Some(oom_diag) = check_oom_exit_code(code) {
                return Ok(oom_diag);
            }
        }
    }

    Ok(diag)
}

#[tauri::command]
pub async fn analyze_latest_crash(
    game_dir: String,
    exit_code: Option<i32>,
) -> Result<CrashDiagnosis, String> {
    tokio::task::spawn_blocking(move || analyze_latest_crash_sync(&game_dir, exit_code))
        .await
        .map_err(|e| e.to_string())?
}

/// Desactiva automáticamente un mod conflictivo renombrándolo a `.disabled` (versión síncrona interna)
pub fn fix_offending_mod_sync(game_dir: &str, mod_name: &str) -> Result<String, String> {
    crate::agent::validate_game_dir(game_dir)?;
    let clean_search = mod_name.to_lowercase().replace('_', "-");
    if clean_search.trim().is_empty() {
        return Err("Nombre de mod vacío.".to_string());
    }

    let mods_dir = Path::new(game_dir).join("mods");
    if !mods_dir.exists() {
        return Err("El directorio de mods no existe.".to_string());
    }

    let entries =
        fs::read_dir(&mods_dir).map_err(|e| format!("Error leyendo directorio mods: {}", e))?;

    let jar_files: Vec<(PathBuf, String)> = entries
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            let name = p.file_name()?.to_str()?.to_string();
            if name.ends_with(".jar") {
                Some((p, name))
            } else {
                None
            }
        })
        .collect();

    let target = jar_files
        .iter()
        .find(|(p, file_name)| matches_mod_id_or_name(p, file_name, &clean_search, "jar"));

    if let Some((p, file_name)) = target {
        let disabled_path = mods_dir.join(format!("{}.disabled", file_name));
        fs::rename(p, &disabled_path)
            .map_err(|e| format!("Error renombrando mod a .disabled: {}", e))?;

        crate::logger::log(
            "INFO",
            "CrashDoctor",
            &format!("Mod conflictivo desactivado exitosamente: {}", file_name),
        );

        return Ok(format!("Mod '{}' desactivado correctamente.", file_name));
    }

    Err(format!(
        "No se encontró ningún archivo .jar correspondiente a '{}' en la carpeta mods.",
        mod_name
    ))
}

#[tauri::command]
pub async fn fix_offending_mod(game_dir: String, mod_name: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || fix_offending_mod_sync(&game_dir, &mod_name))
        .await
        .map_err(|e| e.to_string())?
}

/// Re-habilita un mod previamente desactivado quitando la extensión `.disabled` (versión síncrona interna)
pub fn enable_offending_mod_sync(game_dir: &str, mod_name: &str) -> Result<String, String> {
    crate::agent::validate_game_dir(game_dir)?;
    let clean_search = mod_name.to_lowercase().replace('_', "-");
    if clean_search.trim().is_empty() {
        return Err("Nombre de mod vacío.".to_string());
    }

    let mods_dir = Path::new(game_dir).join("mods");
    if !mods_dir.exists() {
        return Err("El directorio de mods no existe.".to_string());
    }

    let entries =
        fs::read_dir(&mods_dir).map_err(|e| format!("Error leyendo directorio mods: {}", e))?;

    let disabled_files: Vec<(PathBuf, String)> = entries
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            let name = p.file_name()?.to_str()?.to_string();
            if name.ends_with(".jar.disabled") {
                Some((p, name))
            } else {
                None
            }
        })
        .collect();

    let target = disabled_files
        .iter()
        .find(|(p, file_name)| matches_mod_id_or_name(p, file_name, &clean_search, "jar.disabled"));

    if let Some((p, file_name)) = target {
        let enabled_name = file_name.trim_end_matches(".disabled");
        let enabled_path = mods_dir.join(enabled_name);
        fs::rename(p, &enabled_path).map_err(|e| format!("Error re-habilitando mod: {}", e))?;

        crate::logger::log(
            "INFO",
            "CrashDoctor",
            &format!("Mod re-habilitado exitosamente: {}", enabled_name),
        );

        return Ok(format!(
            "Mod '{}' re-habilitado correctamente.",
            enabled_name
        ));
    }

    Err(format!(
        "No se encontró ningún archivo .disabled correspondiente a '{}'.",
        mod_name
    ))
}

#[tauri::command]
pub async fn enable_offending_mod(game_dir: String, mod_name: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || enable_offending_mod_sync(&game_dir, &mod_name))
        .await
        .map_err(|e| e.to_string())?
}

/// Extrae identificadores de mod declarados internamente en un archivo JAR leyendo
/// fabric.mod.json, quilt.mod.json, META-INF/mods.toml o mcmod.info.
fn get_mod_ids_from_jar(path: &Path) -> Vec<String> {
    use std::io::Read;

    let mut ids = Vec::new();
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return ids,
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return ids,
    };

    // 1. Fabric mod: fabric.mod.json
    if let Ok(mut entry) = archive.by_name("fabric.mod.json") {
        let mut content = String::new();
        if entry.read_to_string(&mut content).is_ok() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(id) = val.get("id").and_then(|v| v.as_str()) {
                    ids.push(id.to_lowercase().replace('_', "-"));
                }
                if let Some(provides) = val.get("provides").and_then(|v| v.as_array()) {
                    for p in provides {
                        if let Some(pid) = p.as_str() {
                            ids.push(pid.to_lowercase().replace('_', "-"));
                        }
                    }
                }
            }
        }
    }

    // 2. Quilt mod: quilt.mod.json
    if let Ok(mut entry) = archive.by_name("quilt.mod.json") {
        let mut content = String::new();
        if entry.read_to_string(&mut content).is_ok() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(loader) = val.get("quilt_loader") {
                    if let Some(id) = loader.get("id").and_then(|v| v.as_str()) {
                        ids.push(id.to_lowercase().replace('_', "-"));
                    }
                    if let Some(provides) = loader.get("provides").and_then(|v| v.as_array()) {
                        for p in provides {
                            if let Some(pid) = p.as_str() {
                                ids.push(pid.to_lowercase().replace('_', "-"));
                            } else if let Some(pid) = p.get("id").and_then(|v| v.as_str()) {
                                ids.push(pid.to_lowercase().replace('_', "-"));
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Forge / NeoForge: META-INF/mods.toml o META-INF/neoforge.mods.toml
    for manifest_path in &["META-INF/mods.toml", "META-INF/neoforge.mods.toml"] {
        if let Ok(mut entry) = archive.by_name(manifest_path) {
            let mut content = String::new();
            if entry.read_to_string(&mut content).is_ok() {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if let Some(rest) = trimmed.strip_prefix("modId") {
                        let rest = rest.trim_start();
                        if let Some(rest) = rest.strip_prefix('=') {
                            let clean_id = rest.trim().trim_matches(|c| c == '"' || c == '\'');
                            if !clean_id.is_empty() {
                                ids.push(clean_id.to_lowercase().replace('_', "-"));
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Legacy Forge: mcmod.info
    if let Ok(mut entry) = archive.by_name("mcmod.info") {
        let mut content = String::new();
        if entry.read_to_string(&mut content).is_ok() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(arr) = val.as_array() {
                    for item in arr {
                        if let Some(id) = item.get("modid").and_then(|v| v.as_str()) {
                            ids.push(id.to_lowercase().replace('_', "-"));
                        }
                    }
                }
            }
        }
    }

    ids
}

fn matches_mod_id_or_name(
    jar_path: &Path,
    file_name: &str,
    clean_search: &str,
    expected_ext: &str,
) -> bool {
    let internal_ids = get_mod_ids_from_jar(jar_path);
    if internal_ids.iter().any(|id| id == clean_search) {
        return true;
    }

    // Fallback estricto por nombre de archivo (solo prefijo o nombre exacto, nunca substring permisivo)
    let norm = file_name.to_lowercase().replace('_', "-");
    norm == format!("{}.{}", clean_search, expected_ext)
        || norm.starts_with(&format!("{}-", clean_search))
}

/// Restablece `options.txt` haciendo un backup automático a `options.txt.bak` (versión síncrona interna)
pub fn reset_options_txt_sync(game_dir: &str) -> Result<String, String> {
    crate::agent::validate_game_dir(game_dir)?;
    let options_path = Path::new(game_dir).join("options.txt");
    if options_path.exists() {
        let backup_path = Path::new(game_dir).join("options.txt.bak");
        let _ = fs::rename(&options_path, backup_path);
        crate::logger::log(
            "INFO",
            "CrashDoctor",
            "options.txt respaldado y reiniciado.",
        );
        Ok("Configuración options.txt restablecida con éxito.".to_string())
    } else {
        Ok(
            "options.txt no existía; se regenerará automáticamente al iniciar el juego."
                .to_string(),
        )
    }
}

/// Restablece `options.txt` haciendo un backup automático a `options.txt.bak`
#[tauri::command]
pub async fn reset_options_txt(game_dir: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || reset_options_txt_sync(&game_dir))
        .await
        .map_err(|e| e.to_string())?
}

fn extract_mod_id_from_line(line: &str) -> Option<String> {
    if let Some(pos) = line.find("Mixin apply for mod ") {
        let after = &line[pos + 20..];
        let mod_id = after.split_whitespace().next().unwrap_or("");
        if !mod_id.is_empty() {
            return Some(mod_id.to_string());
        }
    }
    if let Some(pos) = line.find("from mod '") {
        let after = &line[pos + 10..];
        if let Some(end_quote) = after.find('\'') {
            let mod_id = &after[..end_quote];
            if !mod_id.is_empty() {
                return Some(mod_id.to_string());
            }
        }
    }
    if let Some(pos) = line.find("Duplicate mods found: '") {
        let after = &line[pos + 23..];
        if let Some(end_quote) = after.find('\'') {
            let mod_id = &after[..end_quote];
            if !mod_id.is_empty() {
                return Some(mod_id.to_string());
            }
        }
    }
    None
}

fn find_offending_mod_in_log(log: &str) -> Option<String> {
    for line in log.lines() {
        if let Some(mod_id) = extract_mod_id_from_line(line) {
            return Some(mod_id);
        }
    }
    None
}

fn extract_snippet(text: &str, target: &str) -> Option<String> {
    let lines: Vec<&str> = text.lines().collect();
    for (i, line) in lines.iter().enumerate() {
        if line.contains(target) {
            let start = i.saturating_sub(2);
            let end = (i + 10).min(lines.len());
            return Some(lines[start..end].join("\n"));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_offending_mod_in_log() {
        let sample_mixin_log = "org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: Mixin apply for mod sodium failed";
        assert_eq!(
            find_offending_mod_in_log(sample_mixin_log),
            Some("sodium".to_string())
        );

        let sample_dup_log = "Duplicate mods found: 'iris' is installed multiple times";
        assert_eq!(
            find_offending_mod_in_log(sample_dup_log),
            Some("iris".to_string())
        );
    }

    #[test]
    fn test_match_diagnosis_oom() {
        let diag = match_diagnosis_patterns("java.lang.OutOfMemoryError: Java heap space", Some(1));
        assert_eq!(diag.crash_type, CrashType::OutOfMemory);
        assert_eq!(diag.suggested_action, Some(SuggestedAction::IncreaseRam));
    }

    #[test]
    fn test_match_diagnosis_driver_crash() {
        let diag = match_diagnosis_patterns("EXCEPTION_ACCESS_VIOLATION in nvoglv64.dll", Some(1));
        assert_eq!(diag.crash_type, CrashType::GraphicsDriver);
        assert_eq!(
            diag.suggested_action,
            Some(SuggestedAction::UpdateGpuDriver)
        );
    }

    #[test]
    fn test_get_mod_ids_from_jar_and_fix_offending_mod() {
        use std::io::Write;
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let mods_dir = temp_dir.path().join("mods");
        fs::create_dir_all(&mods_dir).expect("create mods dir");

        let jar_path = mods_dir.join("arbitrary_renderer_v1.0.jar");
        let file = fs::File::create(&jar_path).expect("create jar file");
        let mut zip_writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        zip_writer
            .start_file("fabric.mod.json", options)
            .expect("start file");
        let fabric_json =
            r#"{"schemaVersion":1,"id":"sodium","name":"Sodium","provides":["sodium-extra"]}"#;
        zip_writer
            .write_all(fabric_json.as_bytes())
            .expect("write fabric.mod.json");
        zip_writer.finish().expect("finish zip");

        let extracted_ids = get_mod_ids_from_jar(&jar_path);
        assert!(extracted_ids.contains(&"sodium".to_string()));
        assert!(extracted_ids.contains(&"sodium-extra".to_string()));

        let game_dir = temp_dir.path().to_str().expect("valid path");
        let res = fix_offending_mod_sync(game_dir, "sodium");
        assert!(res.is_ok());

        let disabled_path = mods_dir.join("arbitrary_renderer_v1.0.jar.disabled");
        assert!(disabled_path.exists());
        assert!(!jar_path.exists());

        let res_enable = enable_offending_mod_sync(game_dir, "sodium");
        assert!(res_enable.is_ok());
        assert!(jar_path.exists());
        assert!(!disabled_path.exists());
    }
}
