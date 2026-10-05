import { invoke } from '@tauri-apps/api/core';
import { ensureJava, getJavaVersionForMinecraft } from './javaService';
import {
  fetchGpuProfile,
  fetchHardwareProfile,
  applyOptimalGpuOptions,
  getAgentJvmArgs,
} from './gpuShaderService';

export interface LaunchParams {
  username: string;
  uuid: string;
  accessToken: string;
  mcVersion?: string;
  loaderType?: string;
  loaderVersion?: string;
  minRam?: number;
  maxRam: number;
  useOptimization?: boolean;
  gameDir?: string;
  javaArgs?: string;
  javaPath?: string;
  resolution?: string;
  fullscreen?: boolean;
}

interface VersionLibraryRule {
  action: string;
  os?: { name?: string };
}

interface VersionLibrary {
  rules?: VersionLibraryRule[];
  downloads?: { artifact?: { path?: string } };
  name?: string;
}

interface VersionManifest {
  id?: string;
  mainClass?: string;
  libraries?: VersionLibrary[];
  minecraftArguments?: string;
  arguments?: { game?: unknown[]; jvm?: unknown[] };
  assetIndex?: { id?: string };
  assets?: string;
  inheritsFrom?: string;
  javaVersion?: { component?: string; majorVersion?: number };
}

const isLibraryAllowed = (lib: VersionLibrary): boolean => {
  if (!lib.rules || lib.rules.length === 0) return true;
  let allowed = false;
  for (const rule of lib.rules) {
    if (rule.action === 'allow') {
      if (!rule.os) {
        allowed = true;
      } else if (rule.os.name === 'windows') {
        allowed = true;
      }
    } else if (rule.action === 'disallow') {
      if (!rule.os || rule.os.name === 'windows') {
        allowed = false;
      }
    }
  }
  return allowed;
};

const resolveLibraryPath = (lib: VersionLibrary): string | null => {
  if (lib.downloads?.artifact?.path) {
    return lib.downloads.artifact.path;
  }
  if (!lib.name) return null;

  const [coords, ext] = lib.name.split('@');
  const parts = coords.split(':');
  if (parts.length < 3) return null;

  const group = parts[0].replace(/\./g, '/');
  const artifact = parts[1];
  const version = parts[2];
  const classifier = parts.length > 3 ? `-${parts[3]}` : '';
  const extension = ext || 'jar';

  return `${group}/${artifact}/${version}/${artifact}-${version}${classifier}.${extension}`;
};

const buildClasspath = async (
  gameDirectory: string,
  versionId: string,
  mcVersion: string,
  versionData: VersionManifest,
  normalizedHome: string,
): Promise<string> => {
  const libRelPaths: string[] = [];
  const seenPaths = new Set<string>();

  const libraries = versionData.libraries;
  if (Array.isArray(libraries)) {
    for (const lib of libraries) {
      if (!isLibraryAllowed(lib)) continue;
      const relPath = resolveLibraryPath(lib);
      if (relPath && !seenPaths.has(relPath)) {
        seenPaths.add(relPath);
        libRelPaths.push(relPath);
      }
    }
  }

  try {
    const cp = await invoke<string>('resolve_classpath', {
      gameDir: gameDirectory,
      homeDir: normalizedHome,
      versionId,
      mcVersion,
      libRelPaths,
    });
    if (cp && cp.length > 0) {
      return cp;
    }
  } catch (err) {
    console.warn('[Launcher] resolve_classpath invoke failed, using JS fallback:', err);
  }

  const fallbackList: string[] = [];
  const seen = new Set<string>();
  const addJar = (p: string) => {
    const norm = p.replace(/\//g, '\\').toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      fallbackList.push(p.replace(/\//g, '\\'));
    }
  };

  if (versionId !== mcVersion) {
    addJar(`${gameDirectory}/versions/${versionId}/${versionId}.jar`);
  }
  addJar(`${gameDirectory}/versions/${mcVersion}/${mcVersion}.jar`);
  for (const rel of libRelPaths) {
    addJar(`${gameDirectory}/libraries/${rel}`);
  }

  return fallbackList.join(';');
};

export const sanitizeJvmArgs = (
  rawJvmArgs: string[],
  userExplicitArgs?: string,
): string[] => {
  const GC_SELECTORS = [
    '-XX:+UseZGC',
    '-XX:+UseG1GC',
    '-XX:+UseShenandoahGC',
    '-XX:+UseParallelGC',
    '-XX:+UseSerialGC',
    '-XX:+UseEpsilonGC',
  ];

  // 1. Determinar el Garbage Collector único ganador
  let activeGc: string | undefined;
  if (userExplicitArgs) {
    activeGc = GC_SELECTORS.find((gc) => userExplicitArgs.includes(gc));
  }
  if (!activeGc) {
    activeGc = rawJvmArgs.find((arg) => GC_SELECTORS.includes(arg));
  }
  if (!activeGc) {
    activeGc = '-XX:+UseG1GC';
  }

  const sanitized: string[] = [];
  const seenExactFlags = new Set<string>();

  for (let i = 0; i < rawJvmArgs.length; i++) {
    const arg = rawJvmArgs[i];

    // Omitir cualquier selector de GC conflictivo diferente al seleccionado
    if (GC_SELECTORS.includes(arg)) {
      if (arg !== activeGc) {
        continue;
      }
    }

    // Si el GC activo no es G1GC, omitir flags específicos de G1
    if (activeGc !== '-XX:+UseG1GC') {
      if (
        arg.startsWith('-XX:G1') ||
        arg === '-XX:+ParallelRefProcEnabled' ||
        arg === '-XX:-ParallelRefProcEnabled' ||
        arg.startsWith('-XX:InitiatingHeapOccupancyPercent=')
      ) {
        continue;
      }
    }

    // Si el GC activo no es ZGC, omitir flags específicos de ZGC
    if (activeGc !== '-XX:+UseZGC') {
      if (
        arg === '-XX:+ZGenerational' ||
        arg === '-XX:-ZGenerational' ||
        arg.startsWith('-XX:ZAllocationSpikeTolerance=')
      ) {
        continue;
      }
    }

    // Si el GC activo no es Shenandoah, omitir flags de Shenandoah
    if (activeGc !== '-XX:+UseShenandoahGC') {
      if (arg.startsWith('-XX:Shenandoah')) {
        continue;
      }
    }

    // Preservar tokens de classpath (-cp <ruta>) en pares contiguos
    if (arg === '-cp') {
      sanitized.push(arg);
      if (i + 1 < rawJvmArgs.length) {
        i++;
        sanitized.push(rawJvmArgs[i]);
      }
      continue;
    }

    // Deduplicar banderas booleanas o propiedades del sistema idénticas
    if (arg.startsWith('-XX:') || arg.startsWith('-D')) {
      if (seenExactFlags.has(arg)) {
        continue;
      }
      seenExactFlags.add(arg);
    }

    sanitized.push(arg);
  }

  // Asegurar que el selector activo de GC esté presente
  if (!sanitized.includes(activeGc)) {
    const firstOptionIdx = sanitized.findIndex((a) => !a.startsWith('-Xm'));
    if (firstOptionIdx !== -1) {
      sanitized.splice(firstOptionIdx, 0, activeGc);
    } else {
      sanitized.push(activeGc);
    }
  }

  return sanitized;
};

export const buildJvmArgs = (
  versionData: VersionManifest,
  params: LaunchParams,
  gameDirectory: string,
  versionId: string,
  cpString: string,
  hwRecommendedFlags?: string[],
  agentArgs?: string[],
): string[] => {
  const maxRam = Math.max(1024, params.maxRam || 4096);
  const minRam = Math.min(maxRam, Math.max(512, params.minRam || 1024));
  const args: string[] = [`-Xmx${maxRam}M`, `-Xms${minRam}M`];

  if (agentArgs && agentArgs.length > 0) {
    args.push(...agentArgs);
  }

  if (params.javaArgs && params.javaArgs.trim().length > 0) {
    const safeTokens = params.javaArgs
      .trim()
      .split(/\s+/)
      .filter((arg) => /^-[a-zA-Z0-9:._=/\\-]+$/.test(arg));
    args.push(...safeTokens);
  } else if (params.useOptimization !== false) {
    if (hwRecommendedFlags && hwRecommendedFlags.length > 0) {
      args.push(...hwRecommendedFlags);
      if (!args.includes('-Djava.net.preferIPv4Stack=true')) {
        args.push('-Djava.net.preferIPv4Stack=true');
      }
    } else {
      args.push(
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+UseG1GC',
        '-XX:G1NewSizePercent=20',
        '-XX:G1ReservePercent=20',
        '-XX:MaxGCPauseMillis=50',
        '-Djava.net.preferIPv4Stack=true',
      );
    }
  } else {
    args.push('-XX:+UseG1GC');
  }

  const libDir = `${gameDirectory}/libraries`.replace(/\//g, '\\');
  const nativesPath = `${gameDirectory}/versions/${versionId}/natives`.replace(/\//g, '\\');

  const jvmPlaceholders: Record<string, string> = {
    library_directory: libDir,
    classpath_separator: ';',
    version_name: versionId,
    natives_directory: nativesPath,
    launcher_name: 'CrystalTides',
    launcher_version: '1.0.0',
    classpath: cpString,
  };

  // Add manifest JVM arguments (Critical for NeoForge module path, add-opens, etc.)
  let cpAlreadyAdded = false;
  if (versionData.arguments?.jvm && Array.isArray(versionData.arguments.jvm)) {
    for (const item of versionData.arguments.jvm) {
      if (typeof item === 'string') {
        let val = item;
        for (const [k, v] of Object.entries(jvmPlaceholders)) {
          val = val.split('${' + k + '}').join(v);
        }
        if (val === '-cp' || val === cpString) {
          cpAlreadyAdded = true;
        }
        args.push(val);
      }
    }
  }

  if (!cpAlreadyAdded) {
    args.push(`-Djava.library.path=${nativesPath}`, '-cp', cpString);
  }

  return args;
};

const buildGameArgs = (
  versionData: VersionManifest,
  params: LaunchParams,
  versionId: string,
  mcVer: string,
  gameDirectory: string,
  normalizedHome: string,
): string[] => {
  const fallbackAssets = `${normalizedHome}/AppData/Roaming/.minecraft/assets`;
  const assetsRoot = fallbackAssets;
  const assetIndexId =
    versionData.assetIndex?.id || versionData.assets || (mcVer.startsWith('1.21') ? '17' : mcVer);

  const placeholders: Record<string, string> = {
    auth_player_name: params.username,
    version_name: versionId,
    game_directory: gameDirectory,
    assets_root: assetsRoot,
    assets_index_name: assetIndexId,
    auth_uuid: params.uuid,
    auth_access_token: params.accessToken || '00000000-0000-0000-0000-000000000000',
    user_type: 'mojang',
    version_type: 'release',
    clientid: params.uuid,
    auth_xuid: params.uuid,
  };

  const parsedArgs: string[] = [];

  // 1. Mod Loader / Version game arguments (e.g. NeoForge --fml.neoForgeVersion, --launchTarget, etc.)
  if (versionData.arguments?.game && Array.isArray(versionData.arguments.game)) {
    for (const item of versionData.arguments.game) {
      if (typeof item === 'string') {
        let val = item;
        for (const [k, v] of Object.entries(placeholders)) {
          val = val.split('${' + k + '}').join(v);
        }
        parsedArgs.push(val);
      }
    }
  } else if (versionData.minecraftArguments) {
    const rawTokens = versionData.minecraftArguments.split(' ');
    for (const token of rawTokens) {
      let val = token;
      for (const [k, v] of Object.entries(placeholders)) {
        val = val.split('${' + k + '}').join(v);
      }
      parsedArgs.push(val);
    }
  }

  // 2. Standard game arguments (if not already included)
  if (!parsedArgs.includes('--username')) {
    parsedArgs.push(
      '--username',
      params.username,
      '--version',
      versionId,
      '--gameDir',
      gameDirectory,
      '--assetsDir',
      assetsRoot,
      '--assetIndex',
      assetIndexId,
      '--uuid',
      params.uuid,
      '--accessToken',
      params.accessToken || '00000000-0000-0000-0000-000000000000',
      '--userType',
      'mojang',
      '--versionType',
      'release',
    );
  }

  // 3. Resolution and Windowed Mode
  if (params.fullscreen) {
    parsedArgs.push('--fullscreen');
  } else {
    const res =
      params.resolution && params.resolution.includes('x') && params.resolution !== 'Desktop'
        ? params.resolution
        : '1280x720';
    const [w, h] = res.split('x');
    if (w && h) {
      parsedArgs.push('--width', w.trim(), '--height', h.trim());
    }
  }

  return parsedArgs;
};

const resolveVersionId = (params: LaunchParams): string => {
  const mcVer = params.mcVersion || '1.21.1';

  if (params.loaderType && params.loaderType !== 'vanilla') {
    if (params.loaderType === 'neoforge') {
      const ver =
        params.loaderVersion && params.loaderVersion !== '21.1.65'
          ? params.loaderVersion
          : '21.1.252';
      return `neoforge-${ver}`;
    }
    if (params.loaderType === 'forge') {
      const ver = params.loaderVersion || '47.3.0';
      return `${mcVer}-forge-${ver}`;
    }
    if (params.loaderType === 'fabric') {
      const ver = params.loaderVersion || '0.16.10';
      return `fabric-loader-${ver}-${mcVer}`;
    }
    if (params.loaderType === 'quilt') {
      const ver = params.loaderVersion || '0.27.1';
      return `quilt-loader-${ver}-${mcVer}`;
    }
  }
  return mcVer;
};

const readVersionManifest = async (
  gameDirectory: string,
  versionId: string,
  mcVersion: string,
): Promise<{ versionData: VersionManifest; effectiveVersionId: string; baseMcVersion: string }> => {
  const versionJsonPath = `${gameDirectory}/versions/${versionId}/${versionId}.json`;
  try {
    const versionJsonContent = await invoke<string>('read_text_file', { path: versionJsonPath });
    const parsed = JSON.parse(versionJsonContent) as VersionManifest;
    if (parsed.inheritsFrom) {
      try {
        const parentJsonPath = `${gameDirectory}/versions/${parsed.inheritsFrom}/${parsed.inheritsFrom}.json`;
        const parentContent = await invoke<string>('read_text_file', { path: parentJsonPath });
        const parentParsed = JSON.parse(parentContent) as VersionManifest;
        const libMap = new Map<string, VersionLibrary>();
        for (const lib of parentParsed.libraries || []) {
          const key = lib.name || resolveLibraryPath(lib);
          if (key) libMap.set(key, lib);
        }
        for (const lib of parsed.libraries || []) {
          const key = lib.name || resolveLibraryPath(lib);
          if (key) libMap.set(key, lib);
        }

        return {
          versionData: {
            ...parentParsed,
            ...parsed,
            libraries: Array.from(libMap.values()),
            assetIndex: parsed.assetIndex || parentParsed.assetIndex,
            assets: parsed.assets || parentParsed.assets,
          },
          effectiveVersionId: versionId,
          baseMcVersion: parsed.inheritsFrom,
        };
      } catch {
        // Parent not found, use parsed directly
      }
    }
    return {
      versionData: parsed,
      effectiveVersionId: versionId,
      baseMcVersion: parsed.inheritsFrom || mcVersion,
    };
  } catch {
    if (versionId !== mcVersion) {
      const vanillaJsonPath = `${gameDirectory}/versions/${mcVersion}/${mcVersion}.json`;
      try {
        const vanillaContent = await invoke<string>('read_text_file', { path: vanillaJsonPath });
        return {
          versionData: JSON.parse(vanillaContent) as VersionManifest,
          effectiveVersionId: mcVersion,
          baseMcVersion: mcVersion,
        };
      } catch {
        // Fallback minimal manifest
      }
    }
    return {
      versionData: {
        mainClass: 'net.minecraft.client.main.Main',
        libraries: [],
        assetIndex: { id: '17' },
        assets: '17',
      },
      effectiveVersionId: mcVersion,
      baseMcVersion: mcVersion,
    };
  }
};

export const launchGame = async (
  params: LaunchParams,
  onProgress?: (status: string, progress: number) => void,
): Promise<number> => {
  const log = (msg: string, level = 'INFO') => {
    invoke('log_frontend', { msg, level }).catch(() => {});
  };

  try {
    const rawMcVer = params.mcVersion || '1.21.1';
    const mcVer = rawMcVer;
    log(
      `Iniciando secuencia de lanzamiento para versión: ${mcVer} (${params.loaderType || 'vanilla'})`,
    );
    onProgress?.('Resolviendo directorios del juego...', 10);

    let homeDir: string | null = null;
    try {
      homeDir = await invoke<string | null>('get_home_dir');
    } catch {
      // Browser preview mode fallback
    }

    const normalizedHome = (homeDir || 'C:/Users/Default').replace(/\\/g, '/');
    const gameDirectory = params.gameDir || `${normalizedHome}/.crystaltides`;

    onProgress?.('Cargando perfil de Minecraft...', 20);
    let versionId = resolveVersionId(params);
    log(`Perfil de versión resuelto: ${versionId}`);

    onProgress?.('Verificando archivos de la versión...', 35);
    try {
      await invoke('prepare_minecraft_version', {
        versionId: mcVer,
        gameDir: gameDirectory,
      });
    } catch (prepErr) {
      log(`Nota al preparar versión base ${mcVer}: ${prepErr}`, 'WARN');
    }

    // If mod loader is requested, auto-install if not present
    if (params.loaderType && params.loaderType !== 'vanilla' && params.loaderVersion) {
      const loaderJsonPath = `${gameDirectory}/versions/${versionId}/${versionId}.json`;
      let loaderInstalled = false;
      try {
        await invoke<string>('read_text_file', { path: loaderJsonPath });
        loaderInstalled = true;
      } catch {
        loaderInstalled = false;
      }

      if (!loaderInstalled) {
        onProgress?.(`Instalando cargador ${params.loaderType} ${params.loaderVersion}...`, 45);
        log(
          `Instalador de ${params.loaderType} no detectado localmente. Iniciando auto-instalación...`,
        );
        try {
          await invoke('install_mod_loader', {
            loaderType: params.loaderType,
            loaderVersion: params.loaderVersion,
            mcVersion: mcVer,
            gameDir: gameDirectory,
            javaPath:
              params.javaPath && !params.javaPath.startsWith('Auto')
                ? params.javaPath
                : 'javaw.exe',
          });
          log(`Cargador ${params.loaderType} instalado exitosamente.`);
        } catch (loaderErr) {
          log(
            `No se pudo instalar cargador ${params.loaderType}: ${loaderErr}. Continuando con versión base vanilla ${mcVer}.`,
            'WARN',
          );
          versionId = mcVer;
        }
      }
    }

    const { versionData, effectiveVersionId, baseMcVersion } = await readVersionManifest(
      gameDirectory,
      versionId,
      mcVer,
    );
    versionId = effectiveVersionId;
    const effectiveMc = baseMcVersion || mcVer;
    const mainClass = versionData.mainClass || 'net.minecraft.client.main.Main';

    onProgress?.('Comprobando entorno de Java...', 60);
    const requiredJavaVersion =
      versionData.javaVersion?.majorVersion ||
      getJavaVersionForMinecraft(effectiveMc, params.loaderType, params.loaderVersion);
    const runtimesDir = `${normalizedHome}/.crystaltides/runtimes`;

    let javaPath = params.javaPath;
    if (!javaPath || javaPath.startsWith('Auto')) {
      try {
        javaPath = await ensureJava(requiredJavaVersion, runtimesDir);
        log(`Java runtime resuelto automáticamente (Java ${requiredJavaVersion}): ${javaPath}`);
      } catch (e) {
        log(`No se pudo resolver Java automáticamente, usando javaw por defecto: ${e}`, 'WARN');
        javaPath = 'javaw.exe';
      }
    } else {
      log(`Java runtime manual configurado: ${javaPath}`);
    }

    onProgress?.('Construyendo argumentos de ejecución...', 80);
    const cpString = await buildClasspath(
      gameDirectory,
      versionId,
      effectiveMc,
      versionData,
      normalizedHome,
    );
    let hwRecommendedFlags: string[] = [];
    if (params.useOptimization !== false) {
      try {
        const hwProfile = await fetchHardwareProfile();
        if (hwProfile && hwProfile.jvm_recommended_flags) {
          hwRecommendedFlags = hwProfile.jvm_recommended_flags;
          log(
            `Optimización CPU (${hwProfile.brand}): P/E Cores: ${hwProfile.is_hybrid}, X3D: ${hwProfile.is_ryzen_x3d_dual_ccd}, Mask: 0x${hwProfile.recommended_affinity_mask.toString(16)}`,
          );
        }

        const gpuProfile = await fetchGpuProfile();
        await applyOptimalGpuOptions(gameDirectory, gpuProfile);
        log(
          `Ajuste gráfico GPU (${gpuProfile.model} - Tier ${gpuProfile.tier}): Shader ${gpuProfile.recommended_shader}, RenderScale ${gpuProfile.recommended_render_scale}`,
        );
      } catch (optErr) {
        log(`Nota al aplicar optimizaciones de hardware/GPU: ${optErr}`, 'WARN');
      }
    }

    let agentArgs: string[] = [];
    try {
      agentArgs = await getAgentJvmArgs(gameDirectory);
      if (agentArgs.length > 0) {
        log(`Crystal Agent JVM inyectado: ${agentArgs.join(' ')}`);
      }
    } catch (agentErr) {
      log(`Nota al obtener Crystal Agent JVM: ${agentErr}`, 'WARN');
    }

    const rawJvmArgs = buildJvmArgs(
      versionData,
      params,
      gameDirectory,
      versionId,
      cpString,
      hwRecommendedFlags,
      agentArgs,
    );

    const jvmArgs = sanitizeJvmArgs(rawJvmArgs, params.javaArgs);

    const gameArgs = buildGameArgs(
      versionData,
      params,
      versionId,
      effectiveMc,
      gameDirectory,
      normalizedHome,
    );
    const fullArgs = [...jvmArgs, mainClass, ...gameArgs];

    log(
      `Main class: ${mainClass}, argumentos JVM/Juego: ${fullArgs.length} tokens, RAM: ${params.maxRam || 4096}MB`,
    );

    // Ensure options.txt conforms to requested window/fullscreen mode
    try {
      const optionsPath = `${gameDirectory}/options.txt`;
      let optionsContent = '';
      try {
        optionsContent = await invoke<string>('read_text_file', { path: optionsPath });
      } catch {
        // options.txt might not exist yet
      }

      if (optionsContent) {
        let updated = optionsContent;
        if (!params.fullscreen) {
          updated = updated
            .replace(/fullscreen:true/g, 'fullscreen:false')
            .replace(/exclusiveFullscreen:true/g, 'exclusiveFullscreen:false');
        } else {
          updated = updated.replace(/fullscreen:false/g, 'fullscreen:true');
        }
        if (updated !== optionsContent) {
          await invoke('write_text_file', { path: optionsPath, content: updated });
        }
      }
    } catch (optErr) {
      log(`Nota al sincronizar options.txt: ${optErr}`, 'WARN');
    }

    onProgress?.('Iniciando proceso de Minecraft...', 92);
    console.log(`[Launcher] Executing Java at ${javaPath} with args:`, fullArgs);

    let pid = 0;
    try {
      pid = await invoke<number>('launch_minecraft', {
        javaPath,
        args: fullArgs,
        gameDir: gameDirectory,
      });
      log(`Proceso de Minecraft despachado exitosamente con PID: ${pid}`);
    } catch (invokeErr) {
      log(`Error invocando launch_minecraft: ${invokeErr}`, 'ERROR');
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        throw invokeErr;
      }
    }

    onProgress?.('¡Minecraft en ejecución!', 100);
    return pid;
  } catch (err) {
    log(
      `Fallo crítico al iniciar el juego: ${err instanceof Error ? err.message : String(err)}`,
      'ERROR',
    );
    console.error('[Launcher] Failed to launch game:', err);
    throw err;
  }
};

export const killGame = async (): Promise<boolean> => {
  try {
    return await invoke<boolean>('kill_minecraft');
  } catch (err) {
    console.error('[Launcher] Failed to kill game process:', err);
    return false;
  }
};

export const checkGameRunning = async (): Promise<boolean> => {
  try {
    return await invoke<boolean>('is_game_running');
  } catch {
    return false;
  }
};
