use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CrashDiagnosis {
    pub crash_type: String, // "OUT_OF_MEMORY", "MIXIN_CONFLICT", "GRAPHICS_DRIVER", "CORRUPTED_CONFIG", "GENERIC_CRASH"
    pub title: String,
    pub explanation: String,
    pub offending_mod: Option<String>,
    pub recommendation: String,
    pub suggested_action: Option<String>, // "INCREASE_RAM", "DISABLE_MOD", "UPDATE_GPU_DRIVER", "RESET_OPTIONS"
    pub log_snippet: Option<String>,
}

fn check_oom_exit_code(code: i32) -> Option<CrashDiagnosis> {
    if code == 137 {
        Some(CrashDiagnosis {
            crash_type: "OUT_OF_MEMORY".to_string(),
            title: "Agotamiento de Memoria RAM (OutOfMemory)".to_string(),
            explanation: format!(
                "El proceso de la JVM fue abortado por el sistema operativo debido a falta de memoria RAM asignada (Código: {}).",
                code
            ),
            offending_mod: None,
            recommendation: "Aumenta la asignación de memoria RAM en Ajustes > Memoria del Launcher.".to_string(),
            suggested_action: Some("INCREASE_RAM".to_string()),
            log_snippet: Some(format!("Process terminated with OOM exit code: {}", code)),
        })
    } else if code == -1073740791 {
        Some(CrashDiagnosis {
            crash_type: "GRAPHICS_DRIVER".to_string(),
            title: "Desbordamiento de Búfer / Fallo Crítico de Driver Gráfico".to_string(),
            explanation: "El proceso colapsó por una violación de integridad o desbordamiento nativo en la pila del controlador de GPU (STATUS_STACK_BUFFER_OVERRUN - 0xC0000409).".to_string(),
            offending_mod: None,
            recommendation: "Actualiza los controladores de tu GPU (NVIDIA / AMD / Intel) a su versión más reciente o reinstálalos limpiamente.".to_string(),
            suggested_action: Some("UPDATE_GPU_DRIVER".to_string()),
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
    let target_log = if ichor_file.exists() { ichor_file } else { logs_file };

    if target_log.exists() {
        if let Ok(content) = fs::read_to_string(&target_log) {
            let lines: Vec<&str> = content.lines().collect();
            let start = if lines.len() > 300 { lines.len() - 300 } else { 0 };
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
            crash_type: "OUT_OF_MEMORY".to_string(),
            title: "Falta de Memoria RAM (OutOfMemoryError)".to_string(),
            explanation: "La máquina virtual Java excedió el límite de memoria asignada al cargar texturas o chunks.".to_string(),
            offending_mod: None,
            recommendation: "Aumenta la RAM a un mínimo de 4096 MB en Ajustes del Launcher.".to_string(),
            suggested_action: Some("INCREASE_RAM".to_string()),
            log_snippet: extract_snippet(text, "OutOfMemoryError"),
        };
    }

    if let Some(offending) = find_offending_mod_in_log(text) {
        return CrashDiagnosis {
            crash_type: "MIXIN_CONFLICT".to_string(),
            title: format!("Conflicto de Bytecode en Mod: {}", offending),
            explanation: format!("El mod '{}' colisionó al inyectar Mixins sobre el motor de Minecraft.", offending),
            offending_mod: Some(offending.clone()),
            recommendation: format!("Desactiva '{}' haciendo clic en 'Desactivar Mod' o actualízalo a su versión más reciente.", offending),
            suggested_action: Some("DISABLE_MOD".to_string()),
            log_snippet: extract_snippet(text, &offending),
        };
    }

    if text.contains("UnsupportedClassVersionError")
        || text.contains("has been compiled by a more recent version of the Java Runtime")
    {
        return CrashDiagnosis {
            crash_type: "JAVA_MISMATCH".to_string(),
            title: "Incompatibilidad de Versión de Java".to_string(),
            explanation: "Uno de los componentes o mods de Minecraft fue compilado con una versión de Java más moderna que la instalada en tu equipo (ej. requiere Java 21).".to_string(),
            offending_mod: None,
            recommendation: "Instala o selecciona Java 21 OpenJDK en los Ajustes del Launcher.".to_string(),
            suggested_action: Some("UPDATE_JAVA".to_string()),
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
            crash_type: "GRAPHICS_DRIVER".to_string(),
            title: "Fallo Crítico de Driver Gráfico (OpenGL)".to_string(),
            explanation: "El controlador de tu tarjeta gráfica sufrió una violación de acceso al interactuar con el pipeline OpenGL.".to_string(),
            offending_mod: None,
            recommendation: "Actualiza los controladores de tu GPU (NVIDIA / AMD / Intel) desde su panel oficial.".to_string(),
            suggested_action: Some("UPDATE_GPU_DRIVER".to_string()),
            log_snippet: extract_snippet(text, "EXCEPTION_ACCESS_VIOLATION"),
        };
    }

    if text.contains("requires any version of") || text.contains("Could not find required mod") {
        return CrashDiagnosis {
            crash_type: "MISSING_DEPENDENCY".to_string(),
            title: "Falta de Dependencia Requerida".to_string(),
            explanation: "Uno de tus mods instalados requiere una librería complementaria (ej. Fabric API o Architectury) para funcionar.".to_string(),
            offending_mod: find_offending_mod_in_log(text),
            recommendation: "Instala la dependencia indicada o desactiva el mod en conflicto.".to_string(),
            suggested_action: Some("VIEW_LOGS".to_string()),
            log_snippet: extract_snippet(text, "requires")
                .or_else(|| extract_snippet(text, "Could not find required mod")),
        };
    }

    if text.contains("options.txt") || text.contains("shaders.properties") {
        return CrashDiagnosis {
            crash_type: "CORRUPTED_CONFIG".to_string(),
            title: "Configuración de Opciones Corrupta".to_string(),
            explanation: "El archivo options.txt contiene parámetros gráficos que el motor actual no puede parsear.".to_string(),
            offending_mod: None,
            recommendation: "Restablece options.txt a sus valores por defecto con 1 clic.".to_string(),
            suggested_action: Some("RESET_OPTIONS".to_string()),
            log_snippet: extract_snippet(text, "options.txt"),
        };
    }

    CrashDiagnosis {
        crash_type: "GENERIC_CRASH".to_string(),
        title: "Crash Inesperado de Minecraft".to_string(),
        explanation: format!("El juego colapsó con código de salida {:?}.", exit_code),
        offending_mod: None,
        recommendation: "Revisa los registros detallados en la pestaña de Logs.".to_string(),
        suggested_action: None,
        log_snippet: Some(text.lines().take(20).collect::<Vec<&str>>().join("\n")),
    }
}

#[tauri::command]
pub fn analyze_latest_crash(
    game_dir: String,
    exit_code: Option<i32>,
) -> Result<CrashDiagnosis, String> {
    let base = Path::new(&game_dir);
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
            crash_type: "GENERIC_CRASH".to_string(),
            title: "Cierre Inesperado de Minecraft".to_string(),
            explanation: format!(
                "El proceso terminó con código {}. No se encontraron reportes de crash detallados.",
                exit_code.unwrap_or(1)
            ),
            offending_mod: None,
            recommendation: "Verifica que tus controladores gráficos y la versión de Java sean compatibles.".to_string(),
            suggested_action: None,
            log_snippet: None,
        });
    }

    let diag = match_diagnosis_patterns(&latest_crash_text, exit_code);
    if diag.crash_type == "GENERIC_CRASH" {
        if let Some(code) = exit_code {
            if let Some(oom_diag) = check_oom_exit_code(code) {
                return Ok(oom_diag);
            }
        }
    }

    Ok(diag)
}

/// Desactiva automáticamente un mod conflictivo renombrándolo a `.disabled`
#[tauri::command]
pub fn fix_offending_mod(game_dir: String, mod_name: String) -> Result<String, String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let clean_search = mod_name.to_lowercase().replace('_', "-");
    if clean_search.trim().is_empty() {
        return Err("Nombre de mod vacío.".to_string());
    }

    let mods_dir = Path::new(&game_dir).join("mods");
    if !mods_dir.exists() {
        return Err("El directorio de mods no existe.".to_string());
    }

    let entries = fs::read_dir(&mods_dir)
        .map_err(|e| format!("Error leyendo directorio mods: {}", e))?;

    let jar_files: Vec<(PathBuf, String, String)> = entries
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            let name = p.file_name()?.to_str()?.to_string();
            if name.ends_with(".jar") {
                let norm = name.to_lowercase().replace('_', "-");
                Some((p, name, norm))
            } else {
                None
            }
        })
        .collect();

    let target = jar_files
        .iter()
        .find(|(_, _, norm)| {
            norm == &format!("{}.jar", clean_search) || norm.starts_with(&format!("{}-", clean_search))
        })
        .or_else(|| {
            jar_files.iter().find(|(_, _, norm)| norm.contains(&clean_search))
        });

    if let Some((p, file_name, _)) = target {
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

    Err(format!("No se encontró ningún archivo .jar correspondiente a '{}' en la carpeta mods.", mod_name))
}

/// Re-habilita un mod previamente desactivado quitando la extensión `.disabled`
#[tauri::command]
pub fn enable_offending_mod(game_dir: String, mod_name: String) -> Result<String, String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let clean_search = mod_name.to_lowercase().replace('_', "-");
    if clean_search.trim().is_empty() {
        return Err("Nombre de mod vacío.".to_string());
    }

    let mods_dir = Path::new(&game_dir).join("mods");
    if !mods_dir.exists() {
        return Err("El directorio de mods no existe.".to_string());
    }

    let entries = fs::read_dir(&mods_dir)
        .map_err(|e| format!("Error leyendo directorio mods: {}", e))?;

    let disabled_files: Vec<(PathBuf, String, String)> = entries
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            let name = p.file_name()?.to_str()?.to_string();
            if name.ends_with(".jar.disabled") {
                let norm = name.to_lowercase().replace('_', "-");
                Some((p, name, norm))
            } else {
                None
            }
        })
        .collect();

    let target = disabled_files
        .iter()
        .find(|(_, _, norm)| {
            norm == &format!("{}.jar.disabled", clean_search) || norm.starts_with(&format!("{}-", clean_search))
        })
        .or_else(|| {
            disabled_files.iter().find(|(_, _, norm)| norm.contains(&clean_search))
        });

    if let Some((p, file_name, _)) = target {
        let enabled_name = file_name.trim_end_matches(".disabled");
        let enabled_path = mods_dir.join(enabled_name);
        fs::rename(p, &enabled_path)
            .map_err(|e| format!("Error re-habilitando mod: {}", e))?;

        crate::logger::log(
            "INFO",
            "CrashDoctor",
            &format!("Mod re-habilitado exitosamente: {}", enabled_name),
        );

        return Ok(format!("Mod '{}' re-habilitado correctamente.", enabled_name));
    }

    Err(format!("No se encontró ningún archivo .disabled correspondiente a '{}'.", mod_name))
}

/// Restablece `options.txt` haciendo un backup automático a `options.txt.bak`
#[tauri::command]
pub fn reset_options_txt(game_dir: String) -> Result<String, String> {
    crate::agent::validate_game_dir(&game_dir)?;
    let options_path = Path::new(&game_dir).join("options.txt");
    if options_path.exists() {
        let backup_path = Path::new(&game_dir).join("options.txt.bak");
        let _ = fs::rename(&options_path, backup_path);
        crate::logger::log("INFO", "CrashDoctor", "options.txt respaldado y reiniciado.");
        Ok("Configuración options.txt restablecida con éxito.".to_string())
    } else {
        Ok("options.txt no existía; se regenerará automáticamente al iniciar el juego.".to_string())
    }
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
        assert_eq!(find_offending_mod_in_log(sample_mixin_log), Some("sodium".to_string()));

        let sample_dup_log = "Duplicate mods found: 'iris' is installed multiple times";
        assert_eq!(find_offending_mod_in_log(sample_dup_log), Some("iris".to_string()));
    }

    #[test]
    fn test_match_diagnosis_oom() {
        let diag = match_diagnosis_patterns("java.lang.OutOfMemoryError: Java heap space", Some(1));
        assert_eq!(diag.crash_type, "OUT_OF_MEMORY");
        assert_eq!(diag.suggested_action, Some("INCREASE_RAM".to_string()));
    }

    #[test]
    fn test_match_diagnosis_driver_crash() {
        let diag = match_diagnosis_patterns("EXCEPTION_ACCESS_VIOLATION in nvoglv64.dll", Some(1));
        assert_eq!(diag.crash_type, "GRAPHICS_DRIVER");
        assert_eq!(diag.suggested_action, Some("UPDATE_GPU_DRIVER".to_string()));
    }
}

