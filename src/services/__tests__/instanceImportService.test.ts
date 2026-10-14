import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchExternalInstances,
  inspectCustomDirectory,
  pickInstanceFolder,
  importInstanceToLauncher,
  ImportableInstance,
} from '../instanceImportService';
import { getJavaVersionForMinecraft } from '../javaService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../dbService', () => ({
  saveDatabaseProfile: vi.fn().mockResolvedValue(true),
}));

describe('instanceImportService Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('fetchExternalInstances invoca scan_external_instances y devuelve lista', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockList: ImportableInstance[] = [
      {
        id: 'mojang-1',
        source: 'mojang',
        source_name: 'Minecraft Oficial',
        name: 'Perfil UltraXn',
        mc_version: '1.20.1',
        loader_type: 'vanilla',
        game_dir: 'C:/Users/test/.minecraft',
        mods_count: 0,
      },
      {
        id: 'cf-1',
        source: 'curseforge',
        source_name: 'CurseForge',
        name: 'CrystalTidesSMP',
        mc_version: '1.21.1',
        loader_type: 'neoforge',
        loader_version: '21.1.252',
        game_dir: 'C:/Users/test/curseforge/minecraft/Instances/CrystalTidesSMP',
        mods_count: 45,
      },
    ];

    vi.mocked(invoke).mockResolvedValueOnce(mockList);

    const result = await fetchExternalInstances();
    expect(invoke).toHaveBeenCalledWith('scan_external_instances');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Perfil UltraXn');
    expect(result[1].loader_type).toBe('neoforge');
  });

  it('inspectCustomDirectory invoca inspect_custom_instance_dir con la ruta', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const mockItem: ImportableInstance = {
      id: 'custom-inst',
      source: 'custom',
      source_name: 'Carpeta Personalizada',
      name: 'Custom Modpack',
      mc_version: '1.21.1',
      loader_type: 'fabric',
      game_dir: 'D:/Custom/Pack',
      mods_count: 12,
    };

    vi.mocked(invoke).mockResolvedValueOnce(mockItem);

    const result = await inspectCustomDirectory('D:/Custom/Pack');
    expect(invoke).toHaveBeenCalledWith('inspect_custom_instance_dir', { path: 'D:/Custom/Pack' });
    expect(result?.mods_count).toBe(12);
  });

  it('pickInstanceFolder invoca pick_instance_folder de Tauri', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce('C:/Games/MinecraftInstance');

    const folder = await pickInstanceFolder();
    expect(invoke).toHaveBeenCalledWith('pick_instance_folder');
    expect(folder).toBe('C:/Games/MinecraftInstance');
  });

  it('importInstanceToLauncher guarda la instancia y preserva metadatos y ruta', async () => {
    const item: ImportableInstance = {
      id: 'mr-resistence',
      source: 'modrinth',
      source_name: 'Modrinth App',
      name: 'Resistence Z 1.0.0',
      mc_version: '1.20.1',
      loader_type: 'fabric',
      loader_version: '0.15.11',
      game_dir: 'C:/Users/test/AppData/Roaming/ModrinthApp/profiles/Resistence Z',
      mods_count: 85,
    };

    const imported = await importInstanceToLauncher(item);
    expect(imported.name).toBe('Resistence Z 1.0.0');
    expect(imported.mcVersion).toBe('1.20.1');
    expect(imported.loaderType).toBe('fabric');
    expect(imported.gameDir).toBe('C:/Users/test/AppData/Roaming/ModrinthApp/profiles/Resistence Z');
    expect(imported.icon).toBe('feather');
    expect(imported.importedSourceId).toBe('mr-resistence');
  });

  it('getJavaVersionForMinecraft detecta Java 25 para snapshots 26.x y Quilt modern', () => {
    // Modern 26.2
    expect(getJavaVersionForMinecraft('26.2')).toBe(25);
    expect(getJavaVersionForMinecraft('26w04a')).toBe(25);
    expect(getJavaVersionForMinecraft('quilt-loader-0.31.0-beta.4-26.2', 'quilt')).toBe(25);

    // Modern 1.21.1
    expect(getJavaVersionForMinecraft('1.21.1')).toBe(21);
    expect(getJavaVersionForMinecraft('1.21.1', 'neoforge')).toBe(21);

    // 1.20.1
    expect(getJavaVersionForMinecraft('1.20.1')).toBe(17);
    expect(getJavaVersionForMinecraft('1.16.5')).toBe(8);
  });
});
