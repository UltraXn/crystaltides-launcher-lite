# Reglas para Jules en crystaltides-launcher-lite

Estas reglas se adjuntan a cada tarea. Un PR que las incumpla se rechaza automáticamente.

## Alcance
- Resuelve **solo** la tarea descrita. Un PR = un problema. No refactorices, renombres ni "mejores" nada fuera de lo pedido.
- Modifica únicamente los archivos listados en *Archivos permitidos*. Puedes añadir o editar tests junto a ellos
  (`__tests__/`, `*.test.ts(x)`, módulos `#[cfg(test)]` dentro del mismo archivo Rust).
- Si la solución correcta exige tocar otros archivos, **no lo hagas**: explica en el PR qué haría falta y detente.
- No añadas, quites ni actualices dependencias salvo que la tarea sea explícitamente de dependencias.

## Prohibido tocar
- `src-tauri/assets/**` (binarios embebidos con SHA-256 fijado en `MANIFEST.md` y en `agent.rs`).
- `.github/**`, `.cargo/**`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/**`.
- No crees un `Cargo.lock` en la raíz: el único lockfile de Rust es `src-tauri/Cargo.lock`.
- El contrato IPC con el agente Java (`IncomingIpcMessage` en `src-tauri/src/agent.rs`) y los argumentos JVM
  (`-Dcrystaltides.ipc.*`, `-javaagent`) no cambian sin una tarea que lo pida.

## Herramientas
- El gestor es **pnpm** (no npm ni yarn). Rust: `cargo` con `--manifest-path src-tauri/Cargo.toml`.
- Antes de abrir el PR ejecuta todos los comandos de *Verificación* y pega en la descripción del PR
  el resultado (último bloque de salida de cada uno). Si alguno falla y no puedes arreglarlo dentro del
  alcance permitido, dilo explícitamente.

## Estilo
- Sigue el estilo del código que rodea al cambio. Comentarios en español, breves, como el resto del repo.
- Commits y título del PR en formato Conventional Commits (`fix(scope): ...`).
