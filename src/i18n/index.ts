// ═══════════════════════════════════════════════════════════════
// CrystalTides Lite - Internationalization (i18n)
// Clean bilingual dictionary: Spanish (es) & English (en)
// ═══════════════════════════════════════════════════════════════

export type Language = 'es' | 'en';

export const translations = {
  es: {
    // Main Dock & Action Buttons
    dock: {
      instances: 'Instancias',
      about: 'Acerca de',
      accounts: 'Cuentas',
      settings: 'Ajustes',
      launch: 'Iniciar Juego',
      launching: 'Iniciando...',
      running: 'En ejecución',
    },
    // HUD Editor Overlay
    hudEditor: {
      title: 'Modo Edición GUI',
      autoShifted: 'Auto-desplazado',
      dodging: 'Esquivando',
      unifiedDock: 'Barra Unificada',
      freeButtons: 'Botones Libres',
      top: 'Arriba',
      center: 'Centro',
      bottom: 'Abajo',
      reset: 'Restablecer',
      done: 'Listo (Guardar)',
      collision: 'Colisión',
      posMenuAuto: 'Automática',
      posMenuRight: 'Fijada a la Derecha',
      posMenuLeft: 'Fijada a la Izquierda',
      posMenuCenter: 'Fijada al Centro',
      togglePosTitle: 'Posición del menú de edición. Haz clic para alternar.',
      barMode: 'Modo de Barra',
      quickPosition: 'Posición Rápida',
      switchSide: 'Cambiar de Lado (Izquierda / Derecha)',
    },
    // Bottom Bar
    bottomBar: {
      online: 'en línea',
      offline: 'Desconectado',
      officialServer: 'Servidor Oficial: mc.crystaltidessmp.net',
      openAccounts: 'Abrir gestión de cuentas',
      logout: 'Cerrar sesión',
    },
    // Window Header Controls
    window: {
      minimize: 'Minimizar',
      maximize: 'Maximizar',
      close: 'Cerrar',
      edition: 'Edición Lite',
      badgeTitle: 'CrystalTides Launcher Lite',
    },
    // Quick Hover Pill on Dock
    hoverBar: {
      editGui: 'Mover / Editar GUI',
      settings: 'Ajustes',
    },
    // Settings Modal
    settings: {
      title: 'Ajustes del Launcher',
      subtitle: 'Configuración gráfica, entorno de Java y personalización visual',
      // Language Selector
      languageTitle: 'Idioma / Language',
      languageDesc: 'Selecciona el idioma de la interfaz del launcher.',
      spanish: 'Español (ES)',
      english: 'English (EN)',
      // Minecraft & Ram
      general: 'Minecraft & Rendimiento',
      loaderType: 'Tipo de Loader:',
      loaderVersion: 'Versión del Loader:',
      mcVersion: 'Versión de Minecraft:',
      memoryTitle: 'Asignación de Memoria RAM',
      memoryDesc: 'Controla la memoria máxima entregada a la máquina virtual Java.',
      jvmArgsTitle: 'Argumentos JVM Personalizados',
      jvmArgsPlaceholder: '-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646',
      gameDirTitle: 'Directorio de Juego (.minecraft)',
      manualVersionPlaceholder: 'Escribir versión personalizada / snapshot...',
      manualLoaderPlaceholder: 'Escribir versión manual...',
      installedLocallyGroup: 'Instaladas Localmente (PC)',
      officialMojangGroup: 'Versiones Oficiales Mojang',
      // Wallpaper
      wallpaperTitle: 'Fondo de Pantalla & Personalización',
      wallpaperDesc:
        'Selecciona un entorno oficial de CrystalTides o añade tu propia imagen, GIF animado o vídeo (hasta 500 MB):',
      resetOfficial: 'Restablecer oficial',
      uploadBtn: 'Subir Imagen, GIF o Vídeo',
      directUrlPlaceholder: 'O pega un enlace directo (ej: https://.../fondo.mp4)',
      apply: 'Aplicar',
      videoInUse: 'Vídeo de fondo en uso',
      gifInUse: 'GIF animado en uso',
      customBgInUse: 'Fondo personalizado en uso',
      videoAudio: 'Audio del Vídeo de Fondo:',
      soundMuted: 'Silenciado',
      soundActive: 'Con Sonido',
      // Accent color
      accentColorTitle: 'Color de Acento & Iluminación',
      accentColorDesc:
        'Selecciona la paleta de iluminación que tiñe los botones, resplandores ambientales y bordes:',
      custom: 'Personalizado',
      // Dock Customization
      dockCustomizationTitle: 'Personalización del Dock & Menú Principal',
      resetDock: 'Restablecer Dock',
      dockScale: 'Tamaño del Dock:',
      dockScaleNormal: 'Estándar',
      dockScaleCompact: 'Compacto',
      dockOpacity: 'Opacidad del Fondo:',
      dockRadius: 'Curvatura de Bordes (Radio):',
      dockBorder: 'Estilo de Borde:',
      dockBorderSubtle: 'Sutil (Gris)',
      dockBorderAccent: 'Bioluminiscente (Color de Acento)',
      startBtnStyle: 'Color del Botón Iniciar:',
      startBtnAccent: 'Color de Acento Activo',
      startBtnEmerald: 'Verde Esmeralda Clásico',
      startBtnCustom: 'Personalizado',
      visibleButtonsTitle: 'Botones Visibles en el Menú:',
      // Hardware Acceleration
      hwAccelTitle: 'Aceleración por Hardware (GPU)',
      hwAccelDesc:
        'Activa o desactiva la aceleración por hardware en la interfaz gráfica del launcher.',
      hwAccelDisable:
        'Desactivar aceleración de hardware (útil si hay parpadeos o pantallas negras)',
      hwRestartRequiredTitle: 'Reinicio Requerido',
      hwRestartDisableDesc:
        'Para desactivar la aceleración por hardware de la GPU es necesario reiniciar CrystalTides Launcher.',
      hwRestartEnableDesc:
        'Para volver a habilitar la aceleración por hardware de la GPU es necesario reiniciar CrystalTides Launcher.',
      restartNow: 'Reiniciar Ahora',
      restartLater: 'Al Próximo Inicio',
      // Actions
      saveChanges: 'Guardar Cambios',
      saving: 'Guardando...',
      savedSuccess: '¡Ajustes guardados con éxito!',
      cancel: 'Cancelar',
      close: 'Cerrar',
      openLogs: 'Ver Registros de Consola',
    },
    // Accounts Modal
    accounts: {
      title: 'Cuentas',
      subtitle: 'Gestiona tus perfiles, credenciales seguras y personaliza tu skin',
      addMicrosoft: 'Iniciar sesión con Microsoft',
      addGuest: 'Modo No-Premium (Invitado)',
      btnOffline: 'Cuenta Offline',
      btnMicrosoft: 'Microsoft',
      usernamePlaceholder: 'Nombre de usuario...',
      activeTag: 'ACTIVO',
      select: 'Seleccionar',
      delete: 'Eliminar',
      noAccounts:
        'No tienes cuentas añadidas. Inicia sesión con Microsoft o juega en modo invitado.',
      microsoftAuth: 'Microsoft Authenticated',
      offlineAccount: 'Cuenta Offline',
      uploadSkinTitle: 'Subir o cambiar Skin (.png)',
      deleteProfileTitle: 'Eliminar perfil',
      skinLoaded: 'Skin Cargada',
      uploadSkinBtn: 'Subir Skin',
      cancelBtn: 'Cancelar',
      saveProfileBtn: 'Guardar Perfil',
      connecting: 'Conectando...',
      vaultBadge: 'Bóveda AES-256-GCM',
      logoutBtn: 'Cerrar Sesión',
    },
    // About Modal
    about: {
      title: 'Acerca de CrystalTides',
      tagline: 'Edición Lite • Cliente de Alto Rendimiento',
      version: 'Versión',
      edition: 'Edición Lite',
      description:
        'Launcher ultraligero y de alto rendimiento optimizado para la comunidad de CrystalTidesSMP.',
      checkUpdates: 'Buscar Actualizaciones',
      upToDate: 'El launcher está en su versión más reciente',
      highlightTitle: 'Experiencia Ultraligera',
      highlightDesc:
        'Diseñado para arrancar en menos de 100ms, consumir menos de 30MB de memoria y proteger tus credenciales con cifrado militar AES-256-GCM.',
      specEngine: 'MOTOR',
      specSecurity: 'SEGURIDAD',
      specServer: 'SERVIDOR',
      specVersion: 'VERSIÓN',
      developedWith: 'Desarrollado con',
      forCommunity: 'para la comunidad',
    },
    // Instances Modal
    instances: {
      title: 'Gestor de Instancias',
      subtitle:
        'Crea perfiles aislados para CrystalTides SMP o cualquier otro servidor con su propia versión y mods.',
      tabInstances: 'Instancias',
      tabNew: 'Nueva Instancia',
      activeTag: 'ACTIVA',
      officialTag: 'Oficial',
      play: 'Jugar',
      launching: 'Iniciando...',
      openFolder: 'Abrir Carpeta',
      delete: 'Eliminar',
      deleteConfirm: '¿Seguro que deseas eliminar la instancia "{name}"?',
      formNameLabel: 'Nombre de la Instancia',
      formNamePlaceholder: 'Mi Instancia...',
      formVersionLabel: 'Versión de Minecraft',
      formLoaderLabel: 'Tipo de Modloader',
      formIconLabel: 'Icono',
      formCreateBtn: 'Crear Instancia',
      formCancelBtn: 'Cancelar',
      noInstances: 'No hay instancias creadas.',
    },
  },
  en: {
    // Main Dock & Action Buttons
    dock: {
      instances: 'Instances',
      about: 'About',
      accounts: 'Accounts',
      settings: 'Settings',
      launch: 'Start Game',
      launching: 'Launching...',
      running: 'Running',
    },
    // HUD Editor Overlay
    hudEditor: {
      title: 'GUI Edit Mode',
      autoShifted: 'Auto-shifted',
      dodging: 'Dodging',
      unifiedDock: 'Unified Dock',
      freeButtons: 'Free Buttons',
      top: 'Top',
      center: 'Center',
      bottom: 'Bottom',
      reset: 'Reset',
      done: 'Done (Save)',
      collision: 'Collision',
      posMenuAuto: 'Automatic',
      posMenuRight: 'Pinned to Right',
      posMenuLeft: 'Pinned to Left',
      posMenuCenter: 'Pinned to Center',
      togglePosTitle: 'Toolbar position. Click to cycle.',
      barMode: 'Bar Mode',
      quickPosition: 'Quick Position',
      switchSide: 'Switch Side (Left / Right)',
    },
    // Bottom Bar
    bottomBar: {
      online: 'online',
      offline: 'Offline',
      officialServer: 'Official Server: mc.crystaltidessmp.net',
      openAccounts: 'Open account manager',
      logout: 'Log out',
    },
    // Window Header Controls
    window: {
      minimize: 'Minimize',
      maximize: 'Maximize',
      close: 'Close',
      edition: 'Lite Edition',
      badgeTitle: 'CrystalTides Launcher Lite',
    },
    // Quick Hover Pill on Dock
    hoverBar: {
      editGui: 'Move / Edit GUI',
      settings: 'Settings',
    },
    // Settings Modal
    settings: {
      title: 'Launcher Settings',
      subtitle: 'Graphics, Java runtime, and visual customization',
      // Language Selector
      languageTitle: 'Language / Idioma',
      languageDesc: 'Select the interface language for the launcher.',
      spanish: 'Español (ES)',
      english: 'English (EN)',
      // Minecraft & Ram
      general: 'Minecraft & Performance',
      loaderType: 'Loader Type:',
      loaderVersion: 'Loader Version:',
      mcVersion: 'Minecraft Version:',
      memoryTitle: 'Allocated RAM Memory',
      memoryDesc: 'Controls maximum memory allocated to the Java virtual machine.',
      jvmArgsTitle: 'Custom JVM Arguments',
      jvmArgsPlaceholder: '-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646',
      gameDirTitle: 'Game Directory (.minecraft)',
      manualVersionPlaceholder: 'Type custom version / snapshot...',
      manualLoaderPlaceholder: 'Type manual version...',
      installedLocallyGroup: 'Installed Locally (PC)',
      officialMojangGroup: 'Official Mojang Versions',
      // Wallpaper
      wallpaperTitle: 'Wallpaper & Personalization',
      wallpaperDesc:
        'Select an official CrystalTides background or add your custom image, animated GIF or video (up to 500 MB):',
      resetOfficial: 'Reset official',
      uploadBtn: 'Upload Image, GIF or Video',
      directUrlPlaceholder: 'Or paste a direct URL (e.g. https://.../bg.mp4)',
      apply: 'Apply',
      videoInUse: 'Video background in use',
      gifInUse: 'Animated GIF in use',
      customBgInUse: 'Custom background in use',
      videoAudio: 'Video Background Audio:',
      soundMuted: 'Muted',
      soundActive: 'Unmuted',
      // Accent color
      accentColorTitle: 'Accent Color & Lighting',
      accentColorDesc: 'Select the ambient lighting palette for buttons, glows and borders:',
      custom: 'Custom',
      // Dock Customization
      dockCustomizationTitle: 'Dock & Main Menu Customization',
      resetDock: 'Reset Dock',
      dockScale: 'Dock Size:',
      dockScaleNormal: 'Standard',
      dockScaleCompact: 'Compact',
      dockOpacity: 'Background Opacity:',
      dockRadius: 'Border Radius:',
      dockBorder: 'Border Style:',
      dockBorderSubtle: 'Subtle (Gray)',
      dockBorderAccent: 'Bioluminescent (Accent Color)',
      startBtnStyle: 'Start Button Color:',
      startBtnAccent: 'Active Accent Color',
      startBtnEmerald: 'Classic Emerald Green',
      startBtnCustom: 'Custom',
      visibleButtonsTitle: 'Visible Buttons in Menu:',
      // Hardware Acceleration
      hwAccelTitle: 'Hardware Acceleration (GPU)',
      hwAccelDesc: 'Enable or disable hardware GPU acceleration for the launcher UI.',
      hwAccelDisable: 'Disable hardware acceleration (useful if flickering or black screens occur)',
      hwRestartRequiredTitle: 'Restart Required',
      hwRestartDisableDesc:
        'To disable GPU hardware acceleration, CrystalTides Launcher must be restarted.',
      hwRestartEnableDesc:
        'To re-enable GPU hardware acceleration, CrystalTides Launcher must be restarted.',
      restartNow: 'Restart Now',
      restartLater: 'On Next Launch',
      // Actions
      saveChanges: 'Save Changes',
      saving: 'Saving...',
      savedSuccess: 'Settings saved successfully!',
      cancel: 'Cancel',
      close: 'Close',
      openLogs: 'View Console Logs',
    },
    // Accounts Modal
    accounts: {
      title: 'Accounts',
      subtitle: 'Manage your profiles, secure credentials and customize your skin',
      addMicrosoft: 'Sign in with Microsoft',
      addGuest: 'Offline / Guest Mode',
      btnOffline: 'Offline Account',
      btnMicrosoft: 'Microsoft',
      usernamePlaceholder: 'Username...',
      activeTag: 'ACTIVE',
      select: 'Select',
      delete: 'Delete',
      noAccounts: 'No accounts added yet. Sign in with Microsoft or play as guest.',
      microsoftAuth: 'Microsoft Authenticated',
      offlineAccount: 'Offline Account',
      uploadSkinTitle: 'Upload or change Skin (.png)',
      deleteProfileTitle: 'Delete profile',
      skinLoaded: 'Skin Loaded',
      uploadSkinBtn: 'Upload Skin',
      cancelBtn: 'Cancel',
      saveProfileBtn: 'Save Profile',
      connecting: 'Connecting...',
      vaultBadge: 'AES-256-GCM Vault',
      logoutBtn: 'Log Out',
    },
    // About Modal
    about: {
      title: 'About CrystalTides',
      tagline: 'Lite Edition • High Performance Client',
      version: 'Version',
      edition: 'Lite Edition',
      description:
        'Ultra-lightweight, high-performance launcher optimized for the CrystalTidesSMP community.',
      checkUpdates: 'Check for Updates',
      upToDate: 'The launcher is up to date',
      highlightTitle: 'Ultra-lightweight Experience',
      highlightDesc:
        'Designed to boot in under 100ms, consume less than 30MB memory and protect your credentials with AES-256-GCM military-grade encryption.',
      specEngine: 'ENGINE',
      specSecurity: 'SECURITY',
      specServer: 'SERVER',
      specVersion: 'VERSION',
      developedWith: 'Built with',
      forCommunity: 'for the community',
    },
    // Instances Modal
    instances: {
      title: 'Instance Manager',
      subtitle:
        'Create isolated profiles for CrystalTides SMP or any other server with custom versions and mods.',
      tabInstances: 'Instances',
      tabNew: 'New Instance',
      activeTag: 'ACTIVE',
      officialTag: 'Official',
      play: 'Play',
      launching: 'Launching...',
      openFolder: 'Open Folder',
      delete: 'Delete',
      deleteConfirm: 'Are you sure you want to delete instance "{name}"?',
      formNameLabel: 'Instance Name',
      formNamePlaceholder: 'My Instance...',
      formVersionLabel: 'Minecraft Version',
      formLoaderLabel: 'Modloader Type',
      formIconLabel: 'Icon',
      formCreateBtn: 'Create Instance',
      formCancelBtn: 'Cancel',
      noInstances: 'No instances created yet.',
    },
  },
} as const;

type DeepString<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepString<T[K]> : string;
};

export type TranslationDictionary = DeepString<typeof translations.es>;

export function getTranslation(lang: Language): TranslationDictionary {
  return (
    (translations[lang] as unknown as TranslationDictionary) ||
    (translations.es as unknown as TranslationDictionary)
  );
}
