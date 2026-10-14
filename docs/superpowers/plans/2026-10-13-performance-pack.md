# Plan de Implementación: Pack de Rendimiento Extremo (Launcher Lite)

> **Fecha:** 13 de Octubre de 2026  
> **Objetivo:** Completar los 4 puntos restantes del paquete de optimización de rendimiento:
> 1. Prioridad de I/O de disco (`ProcessIoPriority` / `NtSetInformationProcess`).
> 2. Bloqueo de Paging a disco (`SetProcessWorkingSetSizeEx` con cuota dura de working set).
> 3. Exclusión de Windows Defender en 1-click para `.crystaltides`.
> 4. Soporte para runtime GraalVM JDK en `java_manager.rs` y frontend.

---

## Tareas

### Tarea 1: Prioridad de I/O de disco (ProcessIoPriority) y Bloqueo de Paging (SetProcessWorkingSetSizeEx)
- **Archivos:** `apps/launcher-lite/src-tauri/src/process_manager.rs`
- **Detalle:**
  1. En `apply_os_optimizations(pid: u32)` en Windows:
     - Solicitar permisos `PROCESS_SET_QUOTA | PROCESS_SET_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION`.
     - Vincular dinámicamente y ejecutar `NtSetInformationProcess` con clase de información `0x21` (`ProcessIoPriority`), fijando la prioridad en `3` (`IoPriorityHigh`). Esto garantiza que la lectura y descompresión de chunks no compitan en desventaja con procesos en segundo plano.
     - Ejecutar `SetProcessWorkingSetSizeEx` configurando una cuota mínima de memoria activa con las banderas `QUOTA_LIMITS_HARDWS_MIN_ENABLE | QUOTA_LIMITS_HARDWS_MAX_DISABLE` para impedir que el subsistema de memoria de Windows mueva la memoria del juego al archivo de paginación (`pagefile.sys`).
  2. Agregar tests unitarios en `process_manager::tests` para las nuevas rutinas de optimización de sistema operativo.
  3. Ejecutar `cargo test -p launcher-lite-tauri --lib process_manager` y verificar pase.

### Tarea 2: Exclusión 1-Click de Windows Defender
- **Archivos:** 
  - Backend: `apps/launcher-lite/src-tauri/src/sys/windows.rs`, `apps/launcher-lite/src-tauri/src/lib.rs`
  - Frontend: `apps/launcher-lite/src/services/systemService.ts`, `apps/launcher-lite/src/components/modals/SettingsModal.tsx`
- **Detalle:**
  1. En `src/sys/windows.rs`: implementar `add_defender_exclusion(folder_path: &Path) -> Result<(), String>` que invoque `powershell Start-Process powershell -Verb RunAs` pasando `Add-MpPreference -ExclusionPath "<folder_path>"`.
  2. En `lib.rs`: registrar el comando Tauri `add_windows_defender_exclusion`.
  3. En `SettingsModal.tsx` (sección de Rendimiento / Opciones avanzadas): agregar opción interactiva de 1-click para excluir la carpeta del juego de Windows Defender con confirmación visual/toast.
  4. Ejecutar tests unitarios en frontend y verificar que no haya regresiones.

### Tarea 3: Soporte para GraalVM JDK en Java Manager
- **Archivos:**
  - Backend: `apps/launcher-lite/src-tauri/src/java_manager.rs`, `apps/launcher-lite/src-tauri/src/lib.rs`
  - Frontend: `apps/launcher-lite/src/services/javaService.ts`, `apps/launcher-lite/src/components/modals/SettingsModal.tsx`
- **Detalle:**
  1. En `java_manager.rs`:
     - Agregar soporte para distribución `GraalVM` (versiones 21 y 17) con enlaces oficiales de GitHub Releases (`oracle/graalvm-ce-builds`).
     - Función `fetch_graalvm_download_url(version: u8) -> Result<String, String>`.
     - Permitir instalar runtime en subcarpeta dedicada `graalvm-{version}` o `java-{version}`.
     - Actualizar comando `install_java_runtime` para recibir parámetro opcional `distribution: Option<String>`.
  2. En `javaService.ts`:
     - Exponer soporte para `distribution: 'adoptium' | 'graalvm'`.
     - Permitir a los usuarios seleccionar distribución de Java (Temurin vs GraalVM) en los ajustes del launcher.
  3. En `launcherService.ts`:
     - Asegurar compatibilidad en la construcción de argumentos con ruts de GraalVM.

### Tarea 4: Verificación Integral
- Ejecutar `cargo test -p launcher-lite-tauri`.
- Ejecutar `pnpm exec tsc --noEmit`.
- Ejecutar `pnpm exec oxlint -c .oxlintrc.json --no-ignore src`.
- Ejecutar `pnpm test -- --run`.
