# 📦 Manifiesto de Integridad de Binarios Embebidos (Assets)

Este manifiesto documenta la integridad criptográfica (SHA-256) de todos los binarios y bibliotecas embebidos en el backend Rust de CrystalTides Launcher Lite (`src-tauri/assets`).

| Archivo | Plataforma | Propósito | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `crystaltides-boost-fabric.jar` | Multiplataforma (Fabric/Quilt 1.21.1) | Mod de rendimiento: QoS de hilos, culling de texturas animadas y bridge de frametime/`game_ready` hacia `game-bridge.jar` | `9c39a75d0ad8c87c84b1f56522a47575f8ecb5d280aea0e562a1443b6f4740a7` |
| `crystaltides-boost-neoforge.jar` | Multiplataforma (NeoForge 1.21.1) | Mod de rendimiento: QoS de hilos, culling de texturas animadas y bridge de frametime/`game_ready` hacia `game-bridge.jar` | `e53774d3b5aa9227920d421515a6eae5a4b5ca2ee8e3233203948f6387d739e2` |
| `ct-agent.dll` | Windows x64 | Agente nativo de priorización de hilos y optimizaciones seguras de proceso | `ba1aa3c7b9eb074a6be5480087216fbe32d73654eab695f2a676d5a84f94d6e8` |
| `game-bridge.jar` | Multiplataforma | Bridge IPC de telemetría y métricas en tiempo real de Minecraft | `191194c9ed3ab8c798efffa4f9369a3d2e83e875ba4cd4c3abc3a0af208f147b` |

## Verificación en Tiempo de Compilación y Test Suite
La suite de pruebas unitarias (`agent::tests::test_embedded_assets_sha256_manifest_integrity`) valida de forma estricta que los bytes incluidos vía `include_bytes!` coinciden exactamente con los hashes de este manifiesto (lee este archivo con `include_str!`).

Al reemplazar `crystaltides-boost-*.jar`, añadir el hash anterior a `LEGACY_BOOST_JAR_SHA256` en `agent.rs` para que `remove_crystaltides_boost` siga reconociendo las copias ya desplegadas en instancias existentes.
