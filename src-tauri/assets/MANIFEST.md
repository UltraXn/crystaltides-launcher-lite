# 📦 Manifiesto de Integridad de Binarios Embebidos (Assets)

Este manifiesto documenta la integridad criptográfica (SHA-256) de todos los binarios y bibliotecas embebidos en el backend Rust de CrystalTides Launcher Lite (`src-tauri/assets`).

| Archivo | Plataforma | Propósito | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `crystaltides-boost-fabric.jar` | Multiplataforma (Fabric/Quilt 1.21.1) | Mod de rendimiento: QoS de hilos y culling de texturas animadas | `b2336f4a20c725fd178627fd170eb1024dbda36250aa82e7e777ac7244059ed4` |
| `crystaltides-boost-neoforge.jar` | Multiplataforma (NeoForge 1.21.1) | Mod de rendimiento: QoS de hilos y culling de texturas animadas | `1aa3f89f813c7389a3140a8fc59d2b3fde0c869134325726a2ed3ad72bc8e988` |
| `ct-agent.dll` | Windows x64 | Agente nativo de profiling y optimizaciones de memoria en caliente | `cb3f3b70a9743f9dfa69c41b6edc6193be9ee9e6c27feb62dde6fbe606e818b3` |
| `game-bridge.jar` | Multiplataforma | Bridge IPC de telemetría y métricas en tiempo real de Minecraft | `54819bfe1a3d0f1a38fd1cee4dc4bf7ce18101787baf99edffbd72eeab5720ef` |
| `game_bridge_core.dll` | Windows x64 | Biblioteca nativa de sincronización de timers y hardware de alto rendimiento | `6da6d9320f8363e894151579083f3375e9a33f3569157c5ab02d36886010ce48` |

## Verificación en Tiempo de Compilación y Test Suite
La suite de pruebas unitarias (`agent::tests::test_embedded_assets_sha256_manifest_integrity`) valida de forma estricta que los bytes incluidos vía `include_bytes!` coinciden exactamente con los hashes de este manifiesto.
