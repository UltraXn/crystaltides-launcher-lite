import { invoke } from "@tauri-apps/api/core";

export const getJavaVersionForMinecraft = (
  mcVersion: string,
  loaderType?: string,
  loaderVersion?: string
): number => {
  // NeoForge is strictly for modern Minecraft (1.20.2+), requiring Java 21
  if (loaderType?.toLowerCase() === "neoforge") {
    if (loaderVersion?.startsWith("20.2") || loaderVersion?.startsWith("20.3") || loaderVersion?.startsWith("20.4")) {
      return 17;
    }
    return 21;
  }

  // Modern snapshot or version (e.g. 26.x, 26w..., 25w...)
  if (/^2\d/.test(mcVersion)) return 25;

  if (mcVersion.startsWith("1.21") || mcVersion.startsWith("1.20.6") || mcVersion.startsWith("1.20.5")) {
    return 21;
  }
  if (mcVersion.startsWith("1.20") || mcVersion.startsWith("1.19") || mcVersion.startsWith("1.18")) {
    return 17;
  }
  if (mcVersion.startsWith("1.17")) {
    return 16;
  }

  // Legacy Minecraft (1.16.5 and below) uses Java 8
  return 8;
};

export const ensureJava = async (
  majorVersion: number,
  installDir: string
): Promise<string> => {
  const expectedDir = `${installDir}/java-${majorVersion}`;
  
  // Check if java is already installed in launcher runtimes
  try {
    const existingPath: string | null = await invoke("check_java_status", {
      installDir: expectedDir,
    });
    
    if (existingPath) {
      console.log(`Found existing Java ${majorVersion} at: ${existingPath}`);
      return existingPath;
    }
  } catch (err) {
    console.warn("Could not check Java status via Tauri invoke:", err);
  }

  // System fallback checks for Java 25 / 21
  if (majorVersion === 25) {
    try {
      const sysJava25 = "C:/Program Files/Java/jdk-25/bin/javaw.exe";
      const exists = await invoke<boolean>("check_file_exists", { path: sysJava25 }).catch(() => false);
      if (exists) {
        return sysJava25;
      }
    } catch {
      // Fallback
    }
  }

  console.log(`Installing Java ${majorVersion}...`);
  const installedPath: string = await invoke("install_java_runtime", {
    version: majorVersion,
    installDir,
  });
  
  return installedPath;
};
