# 📦 Manifiesto de Integridad de Binarios Embebidos (Assets)

Este manifiesto documenta la integridad criptográfica (SHA-256) de todos los binarios y bibliotecas embebidos en el backend Rust de CrystalTides Launcher Lite (`src-tauri/assets`).

| Archivo | Plataforma | Propósito | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `crystaltides-boost-fabric.jar` | Multiplataforma (Fabric/Quilt 1.21.1) | Mod de rendimiento: QoS de hilos, culling de texturas animadas y bridge de frametime/`game_ready` hacia `game-bridge.jar` | `4512f6021b5af028fec4ceb8e484632b985259d63677eaa5b3ae9481afdeac81` |
| `crystaltides-boost-neoforge.jar` | Multiplataforma (NeoForge 1.21.1) | Mod de rendimiento: QoS de hilos, culling de texturas animadas y bridge de frametime/`game_ready` hacia `game-bridge.jar` | `f194c8c377502029a8d58e3f1f66e38c5bf8b2bb374ee20c50d6c54a04d26f2c` |
| `ct-agent.dll` | Windows x64 | Agente nativo de priorización de hilos y optimizaciones seguras de proceso | `ba1aa3c7b9eb074a6be5480087216fbe32d73654eab695f2a676d5a84f94d6e8` |
| `game-bridge.jar` | Multiplataforma | Bridge IPC de telemetría y métricas en tiempo real de Minecraft | `24055194ace5737417eb716cdc9f8a6c0dfa010049dffe90a282588408a93684` |

## Verificación en Tiempo de Compilación y Test Suite
La suite de pruebas unitarias (`agent::tests::test_embedded_assets_sha256_manifest_integrity`) valida de forma estricta que los bytes incluidos vía `include_bytes!` coinciden exactamente con los hashes de este manifiesto (lee este archivo con `include_str!`).

## Actualizar los binarios

Desde la raíz del monorepo:

```bash
pnpm sync:launcher-assets            # copia los jars de boost compilados y reconcilia hashes
pnpm sync:launcher-assets --build    # compila antes boost (Gradle) y game-bridge
pnpm sync:launcher-assets --check    # solo verifica (exit 1 si algo está desincronizado)
```

El script actualiza este manifiesto y las aserciones de `agent.rs`, y al reemplazar `crystaltides-boost-*.jar` añade el hash anterior a `LEGACY_BOOST_JAR_SHA256` para que `remove_crystaltides_boost` siga reconociendo las copias ya desplegadas en instancias existentes. Los jars de boost y `game-bridge.jar` son reproducibles: recompilar sin cambios en el código no altera sus hashes.
