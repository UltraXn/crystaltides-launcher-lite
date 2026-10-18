### Novedades en CrystalTides Launcher Lite v0.1.2

• **Control de Tamaño de Iconos**: Nuevo control deslizante de escala de iconos global en el editor de HUD (paneles horizontal y vertical) para adaptar el diseño a cualquier resolución con límites estrictos [60% - 180%].
• **Física Libre y Corrección de Widgets**: Eliminado el bloqueo forzado hacia el borde inferior (`y: 96%`) y la reversión de widgets (`y < 80`) al reiniciar el launcher, permitiendo posicionamiento 100% persistente y fluido.
• **Resiliencia en Redimensión de Ventana**: Corrección en el cálculo de colisiones para evitar dispersión o reorganización accidental de botones al cambiar el tamaño de la ventana en modo libre.
• **Eliminación de Obstáculos Fantasma**: Desbloqueo de espacios vacíos en el lienzo que causaban colisiones falsas al mover botones o widgets.
• **Importación Segura de Configuraciones**: Detección y migración de memoria RAM, resolución y argumentos JVM inofensivos desde CurseForge, Modrinth, Prism/MultiMC y Minecraft oficial, descartando argumentos inseguros (como javaagent) con aviso visual en la interfaz.
• **Identidad Visual en Actualizaciones**: Integración del logotipo oficial en el asistente de actualización y renderizado estilizado de notas de versión con viñetas.
