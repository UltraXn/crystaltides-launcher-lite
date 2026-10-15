# 📦 Manifiesto de Integridad de Binarios Embebidos (Assets)

Este manifiesto documenta la integridad criptográfica (SHA-256) de todos los binarios y bibliotecas embebidos en el backend Rust de CrystalTides Launcher Lite (`src-tauri/assets`).

| Archivo | Plataforma | Propósito | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `crystaltides-boost-fabric.jar` | Multiplataforma (Fabric/Quilt 1.21.1) | Mod de rendimiento: QoS de hilos y culling de texturas animadas | `55fbe3a673d0efdc614464c996d5a57d1c36b8a6afcb4f5b09bfd52a1f68917a` |
| `crystaltides-boost-neoforge.jar` | Multiplataforma (NeoForge 1.21.1) | Mod de rendimiento: QoS de hilos y culling de texturas animadas | `d667f0b8fa70d1dec49fc546fd3a5a2ce6589ac0ad86d206c1516bdc59568461` |
| `ct-agent.dll` | Windows x64 | Agente nativo de priorización de hilos y optimizaciones seguras de proceso | `ba1aa3c7b9eb074a6be5480087216fbe32d73654eab695f2a676d5a84f94d6e8` |
| `game-bridge.jar` | Multiplataforma | Bridge IPC de telemetría y métricas en tiempo real de Minecraft | `54819bfe1a3d0f1a38fd1cee4dc4bf7ce18101787baf99edffbd72eeab5720ef` |
| `game_bridge_core.dll` | Windows x64 | Biblioteca nativa de sincronización de timers y hardware de alto rendimiento | `6da6d9320f8363e894151579083f3375e9a33f3569157c5ab02d36886010ce48` |

## Verificación en Tiempo de Compilación y Test Suite
La suite de pruebas unitarias (`agent::tests::test_embedded_assets_sha256_manifest_integrity`) valida de forma estricta que los bytes incluidos vía `include_bytes!` coinciden exactamente con los hashes de este manifiesto.
