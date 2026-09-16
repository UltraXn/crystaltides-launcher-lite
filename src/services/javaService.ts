import { invoke } from "@tauri-apps/api/core";

export const getJavaVersionForMinecraft = (mcVersion: string): number => {
  if (mcVersion.startsWith("1.21")) return 21;
  if (mcVersion.startsWith("1.20.6")) return 21;
  if (mcVersion.startsWith("1.20")) return 17;
  if (mcVersion.startsWith("1.19")) return 17;
  if (mcVersion.startsWith("1.18")) return 17;
  if (mcVersion.startsWith("1.17")) return 16;
  return 8;
};

export const ensureJava = async (
  majorVersion: number,
  installDir: string
): Promise<string> => {
  const expectedDir = `${installDir}/java-${majorVersion}`;
  
  // Check if java is already installed
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

  console.log(`Installing Java ${majorVersion}...`);
  const installedPath: string = await invoke("install_java_runtime", {
    version: majorVersion,
    installDir,
  });
  
  return installedPath;
};
