import { invoke } from "@tauri-apps/api/core";

export interface MojangVersionItem {
  id: string;
  type: string;
}

export interface LoaderItem {
  version: string;
  stable?: boolean;
}

export const fetchInstalledLocalVersions = async (): Promise<string[]> => {
  try {
    const list = await invoke<string[]>("get_installed_minecraft_versions");
    return list || [];
  } catch (err) {
    console.warn("Could not query local minecraft versions:", err);
    return [];
  }
};

export const fetchVanillaVersions = async (includeSnapshots = false): Promise<string[]> => {
  try {
    const url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const data = JSON.parse(responseText) as { versions?: MojangVersionItem[] };
    const versions = data.versions || [];
    if (includeSnapshots) {
      return versions.map((v) => v.id);
    }
    return versions
      .filter((v) => v.type === "release")
      .map((v) => v.id);
  } catch (err) {
    console.warn("Error fetching vanilla versions from Mojang, using fallback list:", err);
    return [
      "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21.0",
      "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20.0",
      "1.19.4", "1.19.2", "1.18.2", "1.16.5", "1.12.2", "1.8.9", "1.7.10"
    ];
  }
};

export const fetchFabricLoaderVersions = async (mcVersion?: string): Promise<string[]> => {
  try {
    const url = mcVersion
      ? `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`
      : "https://meta.fabricmc.net/v2/versions/loader";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const parsed = JSON.parse(responseText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === "object" && "loader" in parsed[0]) {
        // Response format for /loader/{mcVersion}
        const list = parsed.map((item: { loader?: { version?: string } }) => item.loader?.version).filter(Boolean) as string[];
        if (list.length > 0) return list;
      } else {
        const list = (parsed as LoaderItem[])
          .filter((l) => l.stable !== false)
          .map((l) => l.version);
        if (list.length > 0) return list;
      }
    }
    // If version-specific list was empty (e.g. rare snapshot or custom version), fallback to general loader list
    if (mcVersion) {
      return await fetchFabricLoaderVersions();
    }
    return ["0.16.10", "0.16.9", "0.15.11"];
  } catch (err) {
    console.warn("Error fetching Fabric loaders:", err);
    if (mcVersion) {
      return await fetchFabricLoaderVersions();
    }
    return ["0.16.10", "0.16.9", "0.15.11", "0.15.10", "0.14.25"];
  }
};

export const fetchQuiltLoaderVersions = async (mcVersion?: string): Promise<string[]> => {
  try {
    const url = mcVersion
      ? `https://meta.quiltmc.net/v3/versions/loader/${mcVersion}`
      : "https://meta.quiltmc.net/v3/versions/loader";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const parsed = JSON.parse(responseText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === "object" && "loader" in parsed[0]) {
        const list = parsed.map((item: { loader?: { version?: string } }) => item.loader?.version).filter(Boolean) as string[];
        if (list.length > 0) return list;
      } else {
        const list = (parsed as LoaderItem[]).map((l) => l.version);
        if (list.length > 0) return list;
      }
    }
    if (mcVersion) {
      return await fetchQuiltLoaderVersions();
    }
    return ["0.28.0", "0.26.4", "0.26.3", "0.23.1"];
  } catch (err) {
    console.warn("Error fetching Quilt loaders:", err);
    if (mcVersion) {
      return await fetchQuiltLoaderVersions();
    }
    return ["0.28.0", "0.26.4", "0.26.3", "0.23.1"];
  }
};

export const fetchNeoForgeVersions = async (mcVersion: string): Promise<string[]> => {
  try {
    const url = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const data = JSON.parse(responseText) as { versions?: string[] };
    const versions = data.versions || [];

    const filtered = versions.filter((v) => {
      const parts = v.split(".");
      if (parts.length < 2) return false;
      const major = parts[0];
      const minor = parts[1];

      let mappedMc = `1.${major}`;
      if (major === "20" || major === "21") {
        if (minor !== "0") {
          mappedMc = `1.${major}.${minor}`;
        }
      } else if (major === "47") {
        mappedMc = "1.20.1";
      }

      return mappedMc === mcVersion;
    });

    return filtered.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } catch (err) {
    console.warn("Error fetching NeoForge versions:", err);
    if (mcVersion === "1.21.1") return ["21.1.252", "21.1.65", "21.1.64", "21.1.19"];
    if (mcVersion === "1.20.1") return ["47.1.3", "47.1.0"];
    return [];
  }
};

export const fetchForgeVersions = async (mcVersion: string): Promise<string[]> => {
  try {
    const url = `https://bmclapi2.bangbang93.com/forge/${mcVersion}`;
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const forges = JSON.parse(responseText) as { version: string }[];
    const versions = forges.map((f) => f.version);
    return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } catch (err) {
    console.warn(`Error fetching Forge versions for ${mcVersion}:`, err);
    if (mcVersion === "1.20.1") return ["47.3.0", "47.2.20", "47.1.3"];
    if (mcVersion === "1.18.2") return ["40.2.14", "40.2.0"];
    if (mcVersion === "1.16.5") return ["36.2.39", "36.2.0"];
    if (mcVersion === "1.12.2") return ["14.23.5.2860", "14.23.5.2859"];
    return [];
  }
};

export const installLoader = async (
  loaderType: string,
  loaderVersion: string,
  mcVersion: string,
  gameDir: string,
  javaPath: string
): Promise<string> => {
  return await invoke<string>("install_mod_loader", {
    loaderType,
    loaderVersion,
    mcVersion,
    gameDir,
    javaPath,
  });
};
