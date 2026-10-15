import { invoke } from "@tauri-apps/api/core";

export interface MojangVersionItem {
  id: string;
  type: string;
}

export interface LoaderItem {
  version: string;
  stable?: boolean;
}

export const isBetaLoaderVersion = (version: string, stable?: boolean): boolean => {
  if (stable === false) return true;
  const lower = version.toLowerCase();
  return (
    lower.includes("-beta") ||
    lower.includes(".beta") ||
    lower.includes("-alpha") ||
    lower.includes(".alpha") ||
    lower.includes("-rc") ||
    lower.includes(".rc") ||
    lower.includes("-pre") ||
    lower.includes(".pre") ||
    lower.includes("-preview") ||
    lower.includes("snapshot")
  );
};

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

export function parseLoaderList(parsed: unknown, includeBetas = false): string[] {
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  const results: string[] = [];
  const seen = new Set<string>();

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    let version = "";
    let stable: boolean | undefined = undefined;

    if ("loader" in item && item.loader && typeof item.loader === "object") {
      const loaderObj = item.loader as { version?: string; stable?: boolean };
      version = loaderObj.version ?? "";
      stable = loaderObj.stable;
    } else if ("version" in item && typeof item.version === "string") {
      version = item.version;
      stable = (item as { stable?: boolean }).stable;
    }

    if (!version) continue;

    const isBeta = isBetaLoaderVersion(version, stable);
    if (!includeBetas && isBeta) {
      continue;
    }
    if (!seen.has(version)) {
      seen.add(version);
      results.push(version);
    }
  }

  return results;
}

export const fetchFabricLoaderVersions = async (
  mcVersion?: string,
  includeBetas = false
): Promise<string[]> => {
  try {
    const url = mcVersion
      ? `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`
      : "https://meta.fabricmc.net/v2/versions/loader";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const list = parseLoaderList(JSON.parse(responseText), includeBetas);
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Error fetching Fabric loaders:", err);
  }
  if (mcVersion) {
    return fetchFabricLoaderVersions(undefined, includeBetas);
  }
  const stableFallback = [
    "0.16.10", "0.16.9", "0.16.7", "0.16.5", "0.15.11", "0.15.10", "0.15.9", "0.15.7", "0.14.25", "0.14.24"
  ];
  const betaFallback = [
    "0.19.5-beta.1", "0.19.4", "0.19.3", "0.17.0-beta.2", "0.16.0-beta.1"
  ];
  return includeBetas ? [...betaFallback, ...stableFallback] : stableFallback;
};

export const fetchQuiltLoaderVersions = async (
  mcVersion?: string,
  includeBetas = false
): Promise<string[]> => {
  try {
    const url = mcVersion
      ? `https://meta.quiltmc.net/v3/versions/loader/${mcVersion}`
      : "https://meta.quiltmc.net/v3/versions/loader";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    const list = parseLoaderList(JSON.parse(responseText), includeBetas);
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Error fetching Quilt loaders:", err);
  }
  if (mcVersion) {
    return fetchQuiltLoaderVersions(undefined, includeBetas);
  }
  const betaFallback = [
    "0.31.0-beta.4",
    "0.31.0-beta.3",
    "0.31.0-beta.2",
    "0.31.0-beta.1",
    "0.25.0-beta.2",
    "0.24.0-beta.1",
    "0.21.1-beta.1",
    "0.20.2-beta.1",
  ];
  const stableFallback = [
    "0.30.2",
    "0.30.1",
    "0.30.0",
    "0.28.0",
    "0.26.4",
    "0.26.3",
    "0.26.0",
    "0.25.0",
    "0.24.0",
    "0.23.1",
    "0.21.1",
    "0.20.2",
    "0.19.2",
    "0.18.10",
  ];
  return includeBetas ? [...betaFallback, ...stableFallback] : stableFallback;
};

export const mapNeoForgeVersion = (major: string, minor: string): string => {
  if (major === "20" || major === "21") {
    return minor !== "0" ? `1.${major}.${minor}` : `1.${major}`;
  }
  if (major === "47") return "1.20.1";
  return `${major}.${minor}`;
};

export const matchesNeoForgeMc = (version: string, mcVersion: string): boolean => {
  const parts = version.split(".");
  if (parts.length < 2) return false;
  const major = parts[0];
  const minor = parts[1];
  const mapped = mapNeoForgeVersion(major, minor);
  if (mapped === mcVersion) return true;
  if (`1.${major}.${minor}` === mcVersion) return true;
  if (`${major}.${minor}` === mcVersion) return true;
  if (major === "47" && (mcVersion === "1.20.1" || mcVersion === "47.1")) return true;
  if (major === "20" && minor === "1" && mcVersion === "1.20.1") return true;
  if (mcVersion === "26.3" && major === "26" && minor === "3") return true;
  if (mcVersion === "1.26.3" && major === "26" && minor === "3") return true;
  return false;
};

export const fetchNeoForgeVersions = async (
  mcVersion: string,
  includeBetas = false
): Promise<string[]> => {
  try {
    const url = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    let versions: string[] = [];

    if (responseText.trim().startsWith("<")) {
      const matches = responseText.matchAll(/<version>([^<]+)<\/version>/g);
      versions = Array.from(matches, (m) => m[1]);
    } else {
      const data = JSON.parse(responseText) as { versions?: string[] };
      versions = data.versions || [];
    }

    const filtered = versions.filter((v) => {
      if (!matchesNeoForgeMc(v, mcVersion)) return false;
      const isBeta = isBetaLoaderVersion(v);
      if (!includeBetas && isBeta) return false;
      return true;
    });

    const sorted = filtered.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (sorted.length > 0) return sorted;
  } catch (err) {
    console.warn("Error fetching NeoForge versions:", err);
  }

  if (mcVersion === "1.21.1") {
    const stables = ["21.1.252", "21.1.65", "21.1.64", "21.1.19", "21.1.18", "21.1.17", "21.1.10"];
    const betas = ["21.1.32-beta", "21.1.31-beta", "21.1.25-beta", "21.1.20-beta", "21.1.1-beta"];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  if (mcVersion === "1.20.4") {
    const stables = ["20.4.237", "20.4.150", "20.4.80", "20.4.0"];
    const betas = ["20.4.80-beta", "20.4.0-beta"];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  if (mcVersion === "1.20.1") {
    const stables = ["47.1.106", "47.1.84", "47.1.3", "47.1.0"];
    const betas = ["47.1.3-beta", "47.1.0-beta"];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  if (mcVersion === "26.3" || mcVersion === "1.26.3") {
    const stables = ["26.3.0.76"];
    const betas = [
      "26.3.0.75-beta",
      "26.3.0.74-beta",
      "26.3.0.73-beta",
      "26.3.0.72-beta",
      "26.3.0.71-beta",
    ];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  return [];
};

export const isForgeBuildNewerThan = (version: string, recommended: string): boolean => {
  if (!version || !recommended) return false;
  return version.localeCompare(recommended, undefined, { numeric: true }) > 0;
};

export const fetchForgeVersions = async (
  mcVersion: string,
  includeBetas = false
): Promise<string[]> => {
  try {
    const url = `https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`;
    const responseText = await invoke<string>("http_get", { url, headers: {} });
    let versions: string[] = [];

    if (responseText.trim().startsWith("<")) {
      const matches = responseText.matchAll(/<version>([^<]+)<\/version>/g);
      versions = Array.from(matches, (m) => {
        let v = m[1];
        if (v.includes("-")) {
          const parts = v.split("-");
          v = parts[parts.length - 1];
        }
        return v;
      });
    } else {
      const forges = JSON.parse(responseText) as Array<{ version?: string }>;
      versions = forges
        .map((f) => f.version)
        .filter((v): v is string => Boolean(v));
    }

    let recommendedBuild = "";
    try {
      const promoUrl = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
      const promoText = await invoke<string>("http_get", { url: promoUrl, headers: {} });
      const promoData = JSON.parse(promoText) as { promos?: Record<string, string> };
      recommendedBuild = promoData.promos?.[`${mcVersion}-recommended`] ?? "";
    } catch {
      // Ignore promotions failure
    }

    const filtered = versions.filter((v) => {
      const isBeta =
        isBetaLoaderVersion(v) ||
        (recommendedBuild ? isForgeBuildNewerThan(v, recommendedBuild) : false);
      if (!includeBetas && isBeta) return false;
      return true;
    });

    const result = filtered.length > 0 ? filtered : versions;
    return result.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } catch (err) {
    console.warn(`Error fetching Forge versions for ${mcVersion}:`, err);
  }

  if (mcVersion === "1.21.1") {
    const stables = ["52.1.0", "52.0.9", "52.0.8", "52.0.7", "52.0.6", "51.0.33", "51.0.27", "51.0.8"];
    const betas = ["52.1.19", "52.1.18", "52.1.17", "52.1.16", "52.1.10"];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  if (mcVersion === "1.20.4") {
    const stables = ["49.1.0", "49.0.38", "49.0.30", "49.0.19"];
    const betas = ["49.1.4", "49.1.3", "49.1.2"];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  if (mcVersion === "1.20.1") {
    const stables = ["47.3.0", "47.2.20", "47.2.0", "47.1.3", "47.1.0"];
    const betas = ["47.3.11", "47.3.10", "47.3.7", "47.3.5"];
    return includeBetas ? [...betas, ...stables] : stables;
  }
  if (mcVersion === "1.18.2") return ["40.2.14", "40.2.0"];
  if (mcVersion === "1.16.5") return ["36.2.39", "36.2.0"];
  if (mcVersion === "1.12.2") return ["14.23.5.2860", "14.23.5.2859"];
  return [];
};

export const resolveBaseMinecraftVersion = (version: string): string => {
  if (!version) return '1.21.1';
  const trimmed = version.trim();
  if (trimmed.startsWith('quilt-loader-') || trimmed.startsWith('fabric-loader-')) {
    const parts = trimmed.split('-');
    const last = parts[parts.length - 1];
    if (last && /\d+\.\d+/.test(last)) return last;
  }
  const match = trimmed.match(/(\d+\.\d+(?:\.\d+)?)/);
  if (match) return match[1];
  return trimmed;
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
