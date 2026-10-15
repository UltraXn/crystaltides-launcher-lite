import { invoke } from '@tauri-apps/api/core';
import { ensureJava, getJavaVersionForMinecraft } from './javaService';
import { fetchHardwareProfile, fetchGpuProfile } from './hardwareService';
import { getAgentJvmArgs } from './agentIpcService';
import { extractCleanMinecraftVersion } from '../utils/settingsUtils';
import { logFrontend } from './logger';
import { redact } from '../utils/redact';

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
  profileId?: string;
  preLaunchCommand?: string;
  wrapperCommand?: string;
  postExitCommand?: string;
  environmentVariables?: string;
  javaDistribution?: 'adoptium' | 'graalvm';
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

const getCurrentOs = (): 'windows' | 'osx' | 'linux' => {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac') || ua.includes('darwin')) return 'osx';
    if (ua.includes('linux')) return 'linux';
  }
  return 'windows';
};

export const isWin = typeof navigator !== 'undefined' ? /win/i.test(navigator.userAgent) : true;
export const pathSep = isWin ? '\\' : '/';
export const cpSep = isWin ? ';' : ':';

const isRuleAllowed = (rules?: VersionLibraryRule[]): boolean => {
  if (!rules || rules.length === 0) return true;
  const currentOs = getCurrentOs();
  let allowed = false;
  for (const rule of rules) {
    const matchesOs = !rule.os || rule.os.name === currentOs;
    if (rule.action === 'allow') {
      if (matchesOs) {
        allowed = true;
      }
    } else if (rule.action === 'disallow') {
      if (matchesOs) {
        allowed = false;
      }
    }
  }
  return allowed;
};

const isLibraryAllowed = (lib: VersionLibrary): boolean => {
  return isRuleAllowed(lib.rules);
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
    const normalized = isWin ? p.replace(/\//g, '\\') : p.replace(/\\/g, '/');
    const lookupKey = normalized.toLowerCase();
    if (!seen.has(lookupKey)) {
      seen.add(lookupKey);
      fallbackList.push(normalized);
    }
  };

  if (versionId !== mcVersion) {
    addJar(`${gameDirectory}/versions/${versionId}/${versionId}.jar`);
  }
  addJar(`${gameDirectory}/versions/${mcVersion}/${mcVersion}.jar`);
  for (const rel of libRelPaths) {
    addJar(`${gameDirectory}/libraries/${rel}`);
  }

  return fallbackList.join(cpSep);
};

const GC_SELECTORS = [
  '-XX:+UseZGC',
  '-XX:+UseG1GC',
  '-XX:+UseShenandoahGC',
  '-XX:+UseParallelGC',
  '-XX:+UseSerialGC',
  '-XX:+UseEpsilonGC',
];

const resolveActiveGc = (rawJvmArgs: string[], userExplicitArgs?: string): string => {
  if (userExplicitArgs) {
    const found = GC_SELECTORS.find((gc) => userExplicitArgs.includes(gc));
    if (found) return found;
  }
  return rawJvmArgs.find((arg) => GC_SELECTORS.includes(arg)) ?? '-XX:+UseG1GC';
};

const isConflictingGcArg = (arg: string, activeGc: string): boolean => {
  if (GC_SELECTORS.includes(arg)) {
    return arg !== activeGc;
  }
  if (
    activeGc !== '-XX:+UseG1GC' &&
    (arg.startsWith('-XX:G1') ||
      arg === '-XX:+ParallelRefProcEnabled' ||
      arg === '-XX:-ParallelRefProcEnabled' ||
      arg.startsWith('-XX:InitiatingHeapOccupancyPercent='))
  ) {
    return true;
  }
  if (
    activeGc !== '-XX:+UseZGC' &&
    (arg === '-XX:+ZGenerational' ||
      arg === '-XX:-ZGenerational' ||
      arg.startsWith('-XX:ZAllocationSpikeTolerance='))
  ) {
    return true;
  }
  if (activeGc !== '-XX:+UseShenandoahGC' && arg.startsWith('-XX:Shenandoah')) {
    return true;
  }
  return false;
};

const shouldKeepJvmArg = (arg: string, activeGc: string, seenExactFlags: Set<string>): boolean => {
  if (isConflictingGcArg(arg, activeGc)) return false;
  if (arg.startsWith('-XX:') || arg.startsWith('-D')) {
    const key = arg.includes('=') ? arg.split('=')[0] : arg;
    if (seenExactFlags.has(key)) return false;
    seenExactFlags.add(key);
  }
  return true;
};

const ensureActiveGcPresent = (sanitized: string[], activeGc: string): void => {
  if (sanitized.includes(activeGc)) return;
  const firstOptionIdx = sanitized.findIndex((a) => !a.startsWith('-Xm'));
  if (firstOptionIdx !== -1) {
    sanitized.splice(firstOptionIdx, 0, activeGc);
  } else {
    sanitized.push(activeGc);
  }
};

export const sanitizeJvmArgs = (rawJvmArgs: string[], userExplicitArgs?: string): string[] => {
  const activeGc = resolveActiveGc(rawJvmArgs, userExplicitArgs);
  const sanitized: string[] = [];
  const seenExactFlags = new Set<string>();

  let i = 0;
  while (i < rawJvmArgs.length) {
    const arg = rawJvmArgs[i];

    if (arg === '-cp') {
      sanitized.push(arg);
      if (i + 1 < rawJvmArgs.length) {
        i++;
        sanitized.push(rawJvmArgs[i]);
      }
      i++;
      continue;
    }

    if (shouldKeepJvmArg(arg, activeGc, seenExactFlags)) {
      sanitized.push(arg);
    }
    i++;
  }

  ensureActiveGcPresent(sanitized, activeGc);
  return sanitized;
};

const resolveOptimizationJvmFlags = (
  params: LaunchParams,
  hwRecommendedFlags?: string[],
  requiredJavaVersion?: number,
): string[] => {
  const result: string[] = [];

  if (params.useOptimization !== false) {
    if (hwRecommendedFlags && hwRecommendedFlags.length > 0) {
      result.push(...hwRecommendedFlags);
      if (!result.includes('-Djava.net.preferIPv4Stack=true')) {
        result.push('-Djava.net.preferIPv4Stack=true');
      }
    } else {
      const isJava21Plus =
        typeof requiredJavaVersion === 'number' ? requiredJavaVersion >= 21 : false;
      const hasEnoughRam = (params.maxRam ?? 4096) >= 4096;
      if (isJava21Plus && hasEnoughRam) {
        result.push(
          '-XX:+UseZGC',
          '-XX:+ZGenerational',
          '-XX:ZAllocationSpikeTolerance=5',
          '-Djava.net.preferIPv4Stack=true',
        );
      } else {
        result.push(
          '-XX:+UnlockExperimentalVMOptions',
          '-XX:+UseG1GC',
          '-XX:G1NewSizePercent=20',
          '-XX:G1ReservePercent=20',
          '-XX:MaxGCPauseMillis=50',
          '-Djava.net.preferIPv4Stack=true',
        );
      }
    }
    if (!result.includes('-XX:+UseSuperWord')) {
      result.push('-XX:+UseSuperWord');
    }
  } else {
    result.push('-XX:+UseG1GC');
  }

  if (params.javaArgs && params.javaArgs.trim().length > 0) {
    const rawTokens = params.javaArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    const userTokens = rawTokens
      .map((tok) => {
        let clean = tok.trim();
        if (
          (clean.startsWith('"') && clean.endsWith('"')) ||
          (clean.startsWith("'") && clean.endsWith("'"))
        ) {
          clean = clean.slice(1, -1);
        } else if (clean.includes('=')) {
          const eqIdx = clean.indexOf('=');
          const prefix = clean.substring(0, eqIdx + 1);
          const val = clean.substring(eqIdx + 1);
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            clean = `${prefix}${val.slice(1, -1)}`;
          }
        }
        return clean;
      })
      .filter(
        (arg) =>
          arg.length > 0 && !arg.includes('\0') && !arg.includes('\r') && !arg.includes('\n'),
      );
    result.push(...userTokens);
  }

  return result;
};

interface ManifestJvmObject {
  rules?: VersionLibraryRule[];
  value: string | string[];
}

export const processManifestJvmArgs = (
  manifestJvm: unknown[],
  placeholders: Record<string, string>,
  cpString: string,
  mcVersion?: string,
  versionId?: string,
): { args: string[]; cpAlreadyAdded: boolean } => {
  const args: string[] = [];
  let cpAlreadyAdded = false;

  const appendProcessedArg = (rawVal: string) => {
    let val = rawVal;
    for (const [k, v] of Object.entries(placeholders)) {
      val = val.split('${' + k + '}').join(v);
    }
    if (val === '-cp' || val === cpString) {
      cpAlreadyAdded = true;
    }
    if (val.startsWith('-DignoreList=')) {
      const targetVersionId = versionId ?? placeholders.version_name;
      const targetMcVersion = mcVersion ?? placeholders.mc_version;
      if (
        targetMcVersion &&
        targetVersionId &&
        targetVersionId !== targetMcVersion &&
        !val.includes(`${targetMcVersion}.jar`)
      ) {
        val = `${val},${targetMcVersion}.jar`;
      }
    }
    args.push(val);
  };

  for (const item of manifestJvm) {
    if (typeof item === 'string') {
      appendProcessedArg(item);
    } else if (item && typeof item === 'object') {
      const obj = item as ManifestJvmObject;
      if (isRuleAllowed(obj.rules)) {
        if (typeof obj.value === 'string') {
          appendProcessedArg(obj.value);
        } else if (Array.isArray(obj.value)) {
          for (const v of obj.value) {
            if (typeof v === 'string') {
              appendProcessedArg(v);
            }
          }
        }
      }
    }
  }

  return { args, cpAlreadyAdded };
};

export const buildJvmArgs = (
  versionData: VersionManifest,
  params: LaunchParams,
  gameDirectory: string,
  versionId: string,
  cpString: string,
  hwRecommendedFlags?: string[],
  agentArgs?: string[],
  requiredJavaVersion?: number,
  mcVersion?: string,
): string[] => {
  const maxRam = Math.max(1024, params.maxRam ?? 4096);
  const minRam = Math.min(maxRam, Math.max(512, params.minRam ?? 1024));
  const args: string[] = [`-Xmx${maxRam}M`, `-Xms${minRam}M`];

  if (agentArgs && agentArgs.length > 0) {
    const filteredAgentArgs = agentArgs.filter((arg) => !arg.startsWith('-Djava.library.path='));
    args.push(...filteredAgentArgs);
  }

  args.push(...resolveOptimizationJvmFlags(params, hwRecommendedFlags, requiredJavaVersion));

  const normalizePath = (p: string) => (isWin ? p.replace(/\//g, '\\') : p.replace(/\\/g, '/'));
  const libDir = normalizePath(`${gameDirectory}/libraries`);
  const nativesPath = normalizePath(`${gameDirectory}/versions/${versionId}/natives`);
  const agentNatives = normalizePath(`${gameDirectory}/natives`);
  const combinedNatives = `${nativesPath}${cpSep}${agentNatives}`;

  const effectiveMcVer = mcVersion ?? params.mcVersion ?? '1.21.1';
  const jvmPlaceholders: Record<string, string> = {
    library_directory: libDir,
    classpath_separator: cpSep,
    version_name: versionId,
    natives_directory: combinedNatives,
    launcher_name: 'CrystalTides',
    launcher_version: '1.0.0',
    classpath: cpString,
    mc_version: effectiveMcVer,
  };

  let cpAlreadyAdded = false;
  if (versionData.arguments?.jvm && Array.isArray(versionData.arguments.jvm)) {
    const processed = processManifestJvmArgs(
      versionData.arguments.jvm,
      jvmPlaceholders,
      cpString,
      effectiveMcVer,
      versionId,
    );
    const filteredProcessed = processed.args.filter(
      (arg) => !arg.startsWith('-Djava.library.path='),
    );
    args.push(...filteredProcessed);
    cpAlreadyAdded = processed.cpAlreadyAdded;
  }

  args.push(`-Djava.library.path=${combinedNatives}`);
  if (!cpAlreadyAdded) {
    args.push('-cp', cpString);
  }

  return args;
};

const substitutePlaceholders = (
  tokens: string[],
  placeholders: Record<string, string>,
): string[] => {
  return tokens.map((token) => {
    let val = token;
    for (const [k, v] of Object.entries(placeholders)) {
      val = val.split('${' + k + '}').join(v);
    }
    return val;
  });
};

const extractCustomGameArgs = (
  versionData: VersionManifest,
  placeholders: Record<string, string>,
): string[] => {
  if (
    versionData.arguments?.game &&
    Array.isArray(versionData.arguments.game) &&
    versionData.arguments.game.length > 0
  ) {
    const rawStrings = versionData.arguments.game.filter(
      (item): item is string => typeof item === 'string',
    );
    return substitutePlaceholders(rawStrings, placeholders);
  }
  if (versionData.minecraftArguments) {
    const rawTokens = versionData.minecraftArguments.split(' ');
    return substitutePlaceholders(rawTokens, placeholders);
  }
  return [];
};

const buildResolutionArgs = (params: LaunchParams): string[] => {
  const parsedArgs: string[] = [];
  const res =
    params.resolution && params.resolution.includes('x') && params.resolution !== 'Desktop'
      ? params.resolution
      : '1280x720';
  const [w, h] = res.split('x');
  if (w && h) {
    parsedArgs.push('--width', w.trim(), '--height', h.trim());
  }
  if (params.fullscreen) {
    parsedArgs.push('--fullscreen');
  }
  return parsedArgs;
};

const buildGameArgs = (
  versionData: VersionManifest,
  params: LaunchParams,
  versionId: string,
  mcVer: string,
  gameDirectory: string,
  _normalizedHome: string,
): string[] => {
  const assetsRoot = `${gameDirectory}/assets`;
  const assetIndexId =
    versionData.assetIndex?.id ?? versionData.assets ?? (mcVer.startsWith('1.21') ? '17' : mcVer);

  const placeholders: Record<string, string> = {
    auth_player_name: params.username,
    version_name: versionId,
    game_directory: gameDirectory,
    assets_root: assetsRoot,
    assets_index_name: assetIndexId,
    auth_uuid: params.uuid,
    auth_access_token: params.accessToken ?? '00000000-0000-0000-0000-000000000000',
    user_type: 'mojang',
    version_type: 'release',
    clientid: params.uuid,
    auth_xuid: params.uuid,
  };

  const parsedArgs: string[] = extractCustomGameArgs(versionData, placeholders);

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
      params.accessToken ?? '00000000-0000-0000-0000-000000000000',
      '--userType',
      'mojang',
      '--versionType',
      'release',
    );
  }

  parsedArgs.push(...buildResolutionArgs(params));
  return parsedArgs;
};

const resolveVersionId = (params: LaunchParams): string => {
  const rawMc = params.mcVersion ?? '1.21.1';
  // Si la versión seleccionada ya es un ID completo de loader instalado localmente
  if (
    rawMc.startsWith('quilt-loader-') ||
    rawMc.startsWith('fabric-loader-') ||
    rawMc.startsWith('neoforge-') ||
    rawMc.includes('-forge-')
  ) {
    return rawMc;
  }
  const mcVer = extractCleanMinecraftVersion(rawMc);
  if (!params.loaderType || params.loaderType === 'vanilla') {
    return mcVer;
  }
  switch (params.loaderType) {
    case 'neoforge': {
      const ver =
        params.loaderVersion && params.loaderVersion !== '21.1.65'
          ? params.loaderVersion
          : '21.1.252';
      return `neoforge-${ver}`;
    }
    case 'forge': {
      const ver = params.loaderVersion ?? '47.3.0';
      return `${mcVer}-forge-${ver}`;
    }
    case 'fabric': {
      const ver = params.loaderVersion ?? '0.16.10';
      return `fabric-loader-${ver}-${mcVer}`;
    }
    case 'quilt': {
      const ver = params.loaderVersion ?? '0.31.0-beta.4';
      return `quilt-loader-${ver}-${mcVer}`;
    }
    default:
      return mcVer;
  }
};

const mergeParentManifest = (
  parentParsed: VersionManifest,
  parsed: VersionManifest,
  versionId: string,
): { versionData: VersionManifest; effectiveVersionId: string; baseMcVersion: string } => {
  const libMap = new Map<string, VersionLibrary>();
  for (const lib of parentParsed.libraries ?? []) {
    const key = lib.name ?? resolveLibraryPath(lib);
    if (key) libMap.set(key, lib);
  }
  for (const lib of parsed.libraries ?? []) {
    const key = lib.name ?? resolveLibraryPath(lib);
    if (key) libMap.set(key, lib);
  }

  const mergedJvm = [
    ...(Array.isArray(parentParsed.arguments?.jvm) ? parentParsed.arguments.jvm : []),
    ...(Array.isArray(parsed.arguments?.jvm) ? parsed.arguments.jvm : []),
  ];
  const mergedGame = [
    ...(Array.isArray(parentParsed.arguments?.game) ? parentParsed.arguments.game : []),
    ...(Array.isArray(parsed.arguments?.game) ? parsed.arguments.game : []),
  ];

  return {
    versionData: {
      ...parentParsed,
      ...parsed,
      libraries: Array.from(libMap.values()),
      arguments:
        mergedJvm.length > 0 || mergedGame.length > 0
          ? { jvm: mergedJvm, game: mergedGame }
          : (parsed.arguments ?? parentParsed.arguments),
      assetIndex: parsed.assetIndex ?? parentParsed.assetIndex,
      assets: parsed.assets ?? parentParsed.assets,
    },
    effectiveVersionId: versionId,
    baseMcVersion: parsed.inheritsFrom ?? '',
  };
};

const readJsonFileWithFallbacks = async (
  relativeSubpath: string,
  gameDirectory: string,
  normalizedHome?: string,
): Promise<string> => {
  const currentOs = getCurrentOs();
  const mcRelativeDir =
    currentOs === 'osx' ? 'Library/Application Support/minecraft' : '.minecraft';

  const candidates = [
    `${gameDirectory}/${relativeSubpath}`,
    ...(normalizedHome
      ? [
          `${normalizedHome}/.crystaltides/${relativeSubpath}`,
          `${normalizedHome}/${mcRelativeDir}/${relativeSubpath}`,
          ...(currentOs === 'windows'
            ? [`${normalizedHome}/AppData/Roaming/.minecraft/${relativeSubpath}`]
            : []),
        ]
      : []),
  ];

  const uniqueCandidates = Array.from(new Set(candidates));

  for (const p of uniqueCandidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await invoke<string>('read_text_file', { path: p });
    } catch {
      // try next candidate
    }
  }
  throw new Error(`File not found: ${relativeSubpath}`);
};

const readVersionManifest = async (
  gameDirectory: string,
  versionId: string,
  mcVersion: string,
  normalizedHome?: string,
): Promise<{ versionData: VersionManifest; effectiveVersionId: string; baseMcVersion: string }> => {
  try {
    const versionJsonContent = await readJsonFileWithFallbacks(
      `versions/${versionId}/${versionId}.json`,
      gameDirectory,
      normalizedHome,
    );
    const parsed = JSON.parse(versionJsonContent) as VersionManifest;
    if (parsed.inheritsFrom) {
      try {
        const parentContent = await readJsonFileWithFallbacks(
          `versions/${parsed.inheritsFrom}/${parsed.inheritsFrom}.json`,
          gameDirectory,
          normalizedHome,
        );
        return mergeParentManifest(JSON.parse(parentContent) as VersionManifest, parsed, versionId);
      } catch {
        // Parent not found, use parsed directly
      }
    }
    return {
      versionData: parsed,
      effectiveVersionId: versionId,
      baseMcVersion: parsed.inheritsFrom ?? mcVersion,
    };
  } catch {
    if (versionId !== mcVersion) {
      try {
        const vanillaContent = await readJsonFileWithFallbacks(
          `versions/${mcVersion}/${mcVersion}.json`,
          gameDirectory,
          normalizedHome,
        );
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

const resolveJavaRuntime = async (
  mcVer: string,
  params: LaunchParams,
  normalizedHome: string,
  log: (msg: string, level?: string) => void,
): Promise<string> => {
  const requiredJavaVersion = getJavaVersionForMinecraft(
    mcVer,
    params.loaderType,
    params.loaderVersion,
  );
  const runtimesDir = `${normalizedHome}/.crystaltides/runtimes`;

  let javaPath = params.javaPath;
  if (!javaPath || javaPath.startsWith('Auto')) {
    try {
      javaPath = await ensureJava(requiredJavaVersion, runtimesDir, params.javaDistribution);
      log(
        `Java runtime resuelto automáticamente (${params.javaDistribution ?? 'OpenJDK'} Java ${requiredJavaVersion}): ${javaPath}`,
      );
    } catch (e) {
      log(`No se pudo resolver Java automáticamente, usando javaw por defecto: ${e}`, 'WARN');
      javaPath = 'javaw.exe';
    }
  } else {
    log(`Java runtime manual configurado: ${javaPath}`);
  }
  return javaPath;
};

const ensureLoaderInstalled = async (
  params: LaunchParams,
  mcVer: string,
  gameDirectory: string,
  javaPath: string,
  versionId: string,
  onProgress: ((status: string, progress: number) => void) | undefined,
  log: (msg: string, level?: string) => void,
): Promise<string> => {
  if (
    !params.loaderType ||
    params.loaderType === 'vanilla' ||
    !params.loaderVersion ||
    mcVer.startsWith('quilt-loader-') ||
    mcVer.startsWith('fabric-loader-') ||
    mcVer.startsWith('neoforge-') ||
    mcVer.includes('-forge-')
  ) {
    return versionId;
  }

  const loaderJsonPath = `${gameDirectory}/versions/${versionId}/${versionId}.json`;
  let loaderInstalled = false;
  try {
    await invoke<string>('read_text_file', { path: loaderJsonPath });
    loaderInstalled = true;
  } catch {
    loaderInstalled = false;
  }

  if (loaderInstalled) {
    return versionId;
  }

  onProgress?.(`Instalando cargador ${params.loaderType} ${params.loaderVersion}...`, 50);
  log(`Instalador de ${params.loaderType} no detectado localmente. Iniciando auto-instalación...`);
  try {
    await invoke('install_mod_loader', {
      loaderType: params.loaderType,
      loaderVersion: params.loaderVersion,
      mcVersion: mcVer,
      gameDir: gameDirectory,
      javaPath: javaPath || 'javaw.exe',
    });
    log(`Cargador ${params.loaderType} instalado exitosamente.`);
    return versionId;
  } catch (loaderErr) {
    log(
      `No se pudo instalar cargador ${params.loaderType}: ${loaderErr}. Continuando con versión base vanilla ${mcVer}.`,
      'WARN',
    );
    return mcVer;
  }
};

const applyHardwareAndGpuOptimizations = async (
  params: LaunchParams,
  _gameDirectory: string,
  log: (msg: string, level?: string) => void,
  javaVersion?: number,
): Promise<string[]> => {
  if (params.useOptimization === false) {
    return [];
  }
  let hwRecommendedFlags: string[] = [];
  try {
    const [hwProfile, gpuProfile] = await Promise.all([
      fetchHardwareProfile(javaVersion),
      fetchGpuProfile(),
    ]);

    if (hwProfile?.jvm_recommended_flags) {
      hwRecommendedFlags = hwProfile.jvm_recommended_flags;
      log(
        `Optimización CPU (${hwProfile.brand}): P/E Cores: ${hwProfile.is_hybrid}, X3D: ${hwProfile.is_ryzen_x3d_dual_ccd}, Mask: 0x${hwProfile.recommended_affinity_mask.toString(16)}`,
      );
    }

    if (gpuProfile) {
      const vramStr = gpuProfile.vram_mb != null ? `${gpuProfile.vram_mb}MB` : 'N/A';
      log(
        `Optimización GPU detectada: ${gpuProfile.model} (${gpuProfile.vendor}) - Tier: ${gpuProfile.tier}, VRAM: ${vramStr}`,
      );
    }
  } catch (optErr) {
    log(`Nota al aplicar optimizaciones de hardware: ${optErr}`, 'WARN');
  }
  return hwRecommendedFlags;
};

const syncOptionsFile = async (
  gameDirectory: string,
  fullscreen: boolean | undefined,
  log: (msg: string, level?: string) => void,
): Promise<void> => {
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
      if (!fullscreen) {
        updated = updated
          .replace(/^fullscreen:true$/gm, 'fullscreen:false')
          .replace(/^exclusiveFullscreen:true$/gm, 'exclusiveFullscreen:false');
      } else {
        updated = updated.replace(/^fullscreen:false$/gm, 'fullscreen:true');
      }
      if (updated !== optionsContent) {
        await invoke('write_text_file', { path: optionsPath, content: updated });
      }
    }
  } catch (optErr) {
    log(`Nota al sincronizar options.txt: ${optErr}`, 'WARN');
  }
};

const dispatchMinecraftProcess = async (
  javaPath: string,
  fullArgs: string[],
  gameDirectory: string,
  params: LaunchParams,
  log: (msg: string, level?: string) => void,
): Promise<number> => {
  try {
    const pid = await invoke<number>('launch_minecraft', {
      javaPath,
      args: fullArgs,
      gameDir: gameDirectory,
      profileId: params.profileId ?? null,
      preLaunchCommand: params.preLaunchCommand ?? null,
      wrapperCommand: params.wrapperCommand ?? null,
      postExitCommand: params.postExitCommand ?? null,
      environmentVariables: params.environmentVariables ?? null,
    });
    log(`Proceso de Minecraft despachado exitosamente con PID: ${pid}`);
    return pid;
  } catch (invokeErr) {
    log(`Error invocando launch_minecraft: ${invokeErr}`, 'ERROR');
    throw invokeErr;
  }
};

export const launchGame = async (
  params: LaunchParams,
  onProgress?: (status: string, progress: number) => void,
  isCancelled?: () => boolean,
): Promise<number> => {
  const log = (msg: string, level = 'INFO') => {
    logFrontend(level, msg);
  };

  try {
    if (isCancelled?.()) {
      throw new Error('Lanzamiento cancelado por el usuario.');
    }

    const rawMcVer = params.mcVersion ?? '1.21.1';
    const mcVer = extractCleanMinecraftVersion(rawMcVer);
    log(
      `Iniciando secuencia de lanzamiento para versión: ${mcVer} (${params.loaderType ?? 'vanilla'})`,
    );
    onProgress?.('Resolviendo directorios del juego...', 10);

    let homeDir: string | null = null;
    try {
      homeDir = await invoke<string | null>('get_home_dir');
    } catch {
      // Browser preview mode fallback
    }

    const normalizedHome = (homeDir ?? 'C:/Users/Default').replace(/\\/g, '/');
    const gameDirectory = params.gameDir ?? `${normalizedHome}/.crystaltides`;

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
      try {
        await readVersionManifest(gameDirectory, mcVer, mcVer, normalizedHome);
      } catch {
        throw new Error(
          `No se pudo preparar ni descargar la versión ${mcVer} y no existe localmente: ${prepErr}`,
        );
      }
    }

    onProgress?.('Comprobando entorno de Java...', 40);
    const javaPath = await resolveJavaRuntime(mcVer, params, normalizedHome, log);

    if (isCancelled?.()) {
      log('Lanzamiento cancelado por el usuario antes de instalar loader.', 'WARN');
      throw new Error('Lanzamiento cancelado por el usuario.');
    }

    versionId = await ensureLoaderInstalled(
      params,
      mcVer,
      gameDirectory,
      javaPath,
      versionId,
      onProgress,
      log,
    );

    const { versionData, effectiveVersionId, baseMcVersion } = await readVersionManifest(
      gameDirectory,
      versionId,
      mcVer,
      normalizedHome,
    );
    versionId = effectiveVersionId;
    const effectiveMc = baseMcVersion ?? mcVer;
    const mainClass = versionData.mainClass ?? 'net.minecraft.client.main.Main';

    onProgress?.('Construyendo argumentos de ejecución...', 80);
    const cpString = await buildClasspath(
      gameDirectory,
      versionId,
      effectiveMc,
      versionData,
      normalizedHome,
    );

    const requiredJavaVersion = getJavaVersionForMinecraft(
      mcVer,
      params.loaderType,
      params.loaderVersion,
    );

    const hwRecommendedFlags = await applyHardwareAndGpuOptimizations(
      params,
      gameDirectory,
      log,
      requiredJavaVersion,
    );

    let agentArgs: string[] = [];
    if (params.useOptimization !== false && requiredJavaVersion >= 17) {
      try {
        await invoke('prepare_crystal_agent', { gameDir: gameDirectory });
        agentArgs = await getAgentJvmArgs(gameDirectory);
        if (agentArgs.length > 0) {
          log(`Crystal Agent JVM inyectado: ${agentArgs.map((arg) => redact(arg)).join(' ')}`);
        }
      } catch (agentErr) {
        log(`Nota al obtener Crystal Agent JVM: ${agentErr}`, 'WARN');
      }
    }

    const rawJvmArgs = buildJvmArgs(
      versionData,
      params,
      gameDirectory,
      versionId,
      cpString,
      hwRecommendedFlags,
      agentArgs,
      requiredJavaVersion,
      effectiveMc,
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

    await syncOptionsFile(gameDirectory, params.fullscreen, log);

    onProgress?.('Iniciando proceso de Minecraft...', 92);
    console.log(`[Launcher] Executing Java at ${javaPath} with args:`, fullArgs.map((a) => redact(a)));

    if (isCancelled?.()) {
      log('Lanzamiento cancelado por el usuario antes de despachar el proceso.', 'WARN');
      throw new Error('Lanzamiento cancelado por el usuario.');
    }

    const pid = await dispatchMinecraftProcess(javaPath, fullArgs, gameDirectory, params, log);

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

export {
  isLibraryAllowed,
  isRuleAllowed,
  resolveLibraryPath,
  resolveActiveGc,
  isConflictingGcArg,
  shouldKeepJvmArg,
  ensureActiveGcPresent,
  resolveOptimizationJvmFlags,
  extractCustomGameArgs,
  buildResolutionArgs,
  buildGameArgs,
  resolveVersionId,
  mergeParentManifest,
};
