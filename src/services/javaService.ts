import { invoke } from "@tauri-apps/api/core";

const normalizeMinecraftVersion = (mcVersion: string): string => {
  const clean = mcVersion ?? '';
  if (clean.startsWith('quilt-loader-') || clean.startsWith('fabric-loader-')) {
    const parts = clean.split('-');
    return parts[parts.length - 1] ?? clean;
  }
  if (clean.includes('-forge-')) {
    return clean.split('-forge-')[0] ?? clean;
  }
  return clean;
};

const resolveLoaderJavaVersion = (
  cleanMc: string,
  loaderType?: string,
  loaderVersion?: string,
  originalMc?: string,
): number | null => {
  const lType = loaderType?.toLowerCase();
  if (cleanMc.startsWith('neoforge-') || lType === 'neoforge') {
    if (
      loaderVersion?.startsWith('20.2') ||
      loaderVersion?.startsWith('20.3') ||
      loaderVersion?.startsWith('20.4')
    ) {
      return 17;
    }
    return 21;
  }

  if (lType === 'quilt' || originalMc?.toLowerCase().includes('quilt')) {
    if (
      cleanMc.startsWith('1.18') ||
      cleanMc.startsWith('1.19') ||
      (cleanMc.startsWith('1.20') && !cleanMc.startsWith('1.20.5') && !cleanMc.startsWith('1.20.6'))
    ) {
      return 17;
    }
    if (/^2\d/.test(cleanMc)) return 25;
    return 21;
  }

  return null;
};

export const getJavaVersionForMinecraft = (
  mcVersion: string,
  loaderType?: string,
  loaderVersion?: string,
): number => {
  const cleanMc = normalizeMinecraftVersion(mcVersion);
  const loaderJava = resolveLoaderJavaVersion(cleanMc, loaderType, loaderVersion, mcVersion);
  if (loaderJava !== null) return loaderJava;

  // Modern snapshot or version (e.g. 26.x, 26w..., 25w...)
  if (/^2\d/.test(cleanMc)) return 25;

  if (cleanMc.startsWith('1.21') || cleanMc.startsWith('1.20.6') || cleanMc.startsWith('1.20.5')) {
    return 21;
  }
  if (cleanMc.startsWith('1.20') || cleanMc.startsWith('1.19') || cleanMc.startsWith('1.18')) {
    return 17;
  }
  if (cleanMc.startsWith('1.17')) {
    return 16;
  }

  if (
    loaderType?.toLowerCase() === 'fabric' &&
    !cleanMc.startsWith('1.16') &&
    !cleanMc.startsWith('1.15') &&
    !cleanMc.startsWith('1.14')
  ) {
    return 17;
  }

  // Legacy Minecraft (1.16.5 and below) uses Java 8
  return 8;
};

export const ensureJava = async (
  majorVersion: number,
  installDir: string,
  distribution?: 'adoptium' | 'graalvm'
): Promise<string> => {
  const dist = distribution ?? 'adoptium';
  const folderPrefix = dist === 'graalvm' ? 'graalvm' : 'java';
  const expectedDir = `${installDir}/${folderPrefix}-${majorVersion}`;
  
  // Check if java is already installed in launcher runtimes
  try {
    const existingPath: string | null = await invoke("check_java_status", {
      installDir: expectedDir,
    });
    
    if (existingPath) {
      console.log(`Found existing ${dist} ${majorVersion} at: ${existingPath}`);
      return existingPath;
    }
  } catch (err) {
    console.warn("Could not check Java status via Tauri invoke:", err);
  }

  // System fallback checks for Java 25 / 21
  if (majorVersion === 25) {
    try {
      const sysJava25 = await invoke<string | null>("check_java_status", {
        installDir: "C:/Program Files/Java/jdk-25",
      }).catch(() => null);
      if (sysJava25) {
        return sysJava25;
      }
    } catch {
      // Fallback
    }
  }

  console.log(`Installing ${dist} ${majorVersion}...`);
  const installedPath: string = await invoke("install_java_runtime", {
    version: majorVersion,
    installDir,
    distribution: dist,
  });
  
  return installedPath;
};
