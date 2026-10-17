import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveEffectiveResolution,
  resolveEffectiveLoaderVersion,
  buildLaunchOptions,
  sanitizeLauncherSettings,
  launcherActions,
  getLauncherState,
  shouldDeployBoost,
  useLauncherStore,
} from '../launcherStore';
import type { GameInstance } from '../../services/instanceService';
import type { UserAccount } from '../launcherStore';

vi.mock('../../services/launcherService', () => ({
  launchGame: vi.fn().mockImplementation((_opts, onProgress) => {
    if (onProgress) {
      onProgress('Verificando...', 10);
      onProgress('Descargando activos...', 30);
      onProgress('Iniciando proceso...', 92);
    }
    return Promise.resolve();
  }),
  killGame: vi.fn().mockResolvedValue(true),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'is_game_running') return Promise.resolve(true);
    if (cmd === 'get_home_dir' || cmd === 'resolve_data_dir') {
      return Promise.resolve('C:\\fake\\appdata');
    }
    return Promise.resolve(null);
  }),
}));

vi.mock('../../services/databaseService', () => ({
  getDatabaseAccounts: vi.fn().mockResolvedValue([]),
  saveDatabaseAccount: vi.fn().mockResolvedValue(true),
  deleteDatabaseAccount: vi.fn().mockResolvedValue(true),
  setActiveDatabaseAccount: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/microsoftAuthService', () => {
  class MockMicrosoftAuthError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'MicrosoftAuthError';
      this.code = code;
    }
  }

  return {
    MicrosoftAuthError: MockMicrosoftAuthError,
    refreshMicrosoftSession: vi.fn().mockResolvedValue({
      accessToken: 'refreshed-mc-token',
      refreshToken: 'new-refresh-token',
      username: 'RefreshedUser',
      uuid: 'refreshed-uuid',
    }),
  };
});

vi.mock('../../services/instanceService', () => ({
  resolveInstanceGameDir: vi.fn().mockResolvedValue('C:\\fake\\instances\\default-ct'),
  syncInstanceAssets: vi.fn().mockResolvedValue(true),
  getSavedInstances: vi.fn().mockReturnValue([
    {
      id: 'default-ct',
      name: 'CrystalTides SMP',
      mcVersion: '1.21.1',
      loaderType: 'neoforge',
      icon: 'cube',
    },
  ]),
  createNewInstance: vi.fn().mockImplementation((data) => ({
    id: 'inst-' + Date.now(),
    name: data.name,
    mcVersion: data.mcVersion,
    loaderType: data.loaderType,
    icon: data.icon || 'cube',
  })),
  duplicateInstance: vi.fn().mockImplementation((_id) => ({
    id: 'inst-dup-' + Date.now(),
    name: 'Prueba (Copia)',
    mcVersion: '1.20.4',
    loaderType: 'fabric',
    icon: 'cube',
  })),
  removeInstance: vi.fn(),
  updateInstance: vi.fn(),
  getActiveInstanceId: vi.fn().mockReturnValue('default-ct'),
  setActiveInstanceId: vi.fn(),
}));

describe('launcherStore helpers & actions', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      accounts: [
        {
          id: 'acc1',
          username: 'Steve',
          uuid: '11111111-2222-3333-4444-555555555555',
          type: 'guest',
          lastUsed: Date.now(),
        },
      ],
      activeAccountId: 'acc1',
      launch: {
        status: 'IDLE',
        progress: 0,
        message: 'Listo para jugar',
      },
      instances: [
        {
          id: 'default-ct',
          name: 'CrystalTides SMP',
          mcVersion: '1.21.1',
          loaderType: 'neoforge',
          icon: 'cube',
        } as any,
      ],
      activeInstanceId: 'default-ct',
    });
  });

  describe('resolveEffectiveResolution', () => {
    it('returns custom resolution when instance defines positive width and height', () => {
      const instance = {
        resolutionWidth: 1920,
        resolutionHeight: 1080,
      } as unknown as GameInstance;

      expect(resolveEffectiveResolution(instance)).toBe('1920x1080');
    });

    it('falls back to default settings resolution when instance resolution is missing or invalid', () => {
      const instance = {
        resolutionWidth: 0,
        resolutionHeight: 0,
      } as unknown as GameInstance;

      const res = resolveEffectiveResolution(instance);
      expect(typeof res).toBe('string');
      expect(res).toContain('x');
    });
  });

  describe('resolveEffectiveLoaderVersion', () => {
    it('returns undefined for vanilla loader', () => {
      expect(resolveEffectiveLoaderVersion('vanilla', '1.20.1')).toBeUndefined();
    });

    it('auto-upgrades neoforge default or outdated 21.1.65 to 21.1.252', () => {
      expect(resolveEffectiveLoaderVersion('neoforge', '')).toBe('21.1.252');
      expect(resolveEffectiveLoaderVersion('neoforge', '21.1.65')).toBe('21.1.252');
    });

    it('preserves specific neoforge or fabric versions', () => {
      expect(resolveEffectiveLoaderVersion('neoforge', '21.1.100')).toBe('21.1.100');
      expect(resolveEffectiveLoaderVersion('fabric', '0.15.11')).toBe('0.15.11');
    });

    it('extracts compound beta loader version from mcVersion when rawVersion is empty', () => {
      expect(
        resolveEffectiveLoaderVersion('quilt', '', 'quilt-loader-0.31.0-beta.4-26.2'),
      ).toBe('0.31.0-beta.4');
      expect(
        resolveEffectiveLoaderVersion('quilt', '', 'quilt-loader-0.31.0-beta.4-26.2 (quilt)'),
      ).toBe('0.31.0-beta.4');
      expect(
        resolveEffectiveLoaderVersion('fabric', '', 'fabric-loader-0.16.10-1.21.1'),
      ).toBe('0.16.10');
    });
  });

  describe('buildLaunchOptions', () => {
    it('constructs options converting GB to MB and resolving effective values', () => {
      const account: UserAccount = {
        id: 'acc1',
        username: 'Steve',
        uuid: '11111111-2222-3333-4444-555555555555',
        type: 'guest',
        lastUsed: Date.now(),
      };

      const instance: GameInstance = {
        id: 'inst1',
        name: 'Modded',
        mcVersion: '1.21.1',
        loaderType: 'fabric',
        loaderVersion: '0.15.11',
        minRamGb: 2,
        maxRamGb: 6,
        gameDir: 'C:/fake/gameDir',
      } as unknown as GameInstance;

      const options = buildLaunchOptions(account, instance, 'C:/fake/gameDir');
      expect(options.username).toBe('Steve');
      expect(options.mcVersion).toBe('1.21.1');
      expect(options.loaderType).toBe('fabric');
      expect(options.loaderVersion).toBe('0.15.11');
      expect(options.minRam).toBe(2048);
      expect(options.maxRam).toBe(6144);
      expect(options.gameDir).toBe('C:/fake/gameDir');
    });
  });

  describe('launcherActions & Launch Flows', () => {
    it('updates dock config via setDockConfig', () => {
      launcherActions.setDockConfig({
        positionPreset: 'bottom',
        scale: 'compact',
      });

      const state = getLauncherState();
      expect(state.dockConfig.positionPreset).toBe('bottom');
      expect(state.dockConfig.scale).toBe('compact');
    });

    it('updates hudManualSide via setHudManualSide', () => {
      launcherActions.setHudManualSide('right');
      expect(getLauncherState().hudManualSide).toBe('right');

      launcherActions.setHudManualSide('auto');
      expect(getLauncherState().hudManualSide).toBe('auto');
    });

    it('updates layoutMode via setLayoutMode', () => {
      launcherActions.setLayoutMode('free_buttons');
      expect(getLauncherState().dockConfig.layoutMode).toBe('free_buttons');

      launcherActions.setLayoutMode('dock');
      expect(getLauncherState().dockConfig.layoutMode).toBe('dock');
    });

    it('permite personalizar y restablecer botones del dock', () => {
      launcherActions.setDockButtonCustomization('settings', {
        bgColor: '#38bdf8',
        specialEffect: 'neon_pulse',
      });
      expect(getLauncherState().dockConfig.buttonCustomizations?.settings?.bgColor).toBe('#38bdf8');

      launcherActions.resetDockButtonCustomization('settings');
      expect(getLauncherState().dockConfig.buttonCustomizations?.settings).toBeUndefined();
    });

    it('permite configurar y limpiar el fondo del dock y su transformación', () => {
      launcherActions.setDockBackground('image', 'file:///dock.png', 0.9);
      expect(getLauncherState().dockConfig.dockBgType).toBe('image');
      expect(getLauncherState().dockConfig.dockBgImage).toBe('file:///dock.png');

      launcherActions.updateDockBackgroundTransform({ posX: 55, posY: 65, scale: 110 });
      expect(getLauncherState().dockConfig.dockBgPosX).toBe(55);

      launcherActions.clearDockBackground();
      expect(getLauncherState().dockConfig.dockBgType).toBe('default');
    });

    it('maneja cancelLaunchFlow restableciendo estado IDLE', () => {
      launcherActions.cancelLaunchFlow();
      expect(getLauncherState().launch.status).toBe('IDLE');
    });

    it('ejecuta startLaunchFlow exitosamente pasando por verificación y ejecución', async () => {
      await launcherActions.startLaunchFlow();
      const state = getLauncherState();
      expect(state.launch.status).toBe('RUNNING');
      expect(state.launch.progress).toBe(100);
    });

    it('detecta invalid_grant por code al renovar sesión y marca requiresReauth', async () => {
      const msAccount: UserAccount = {
        id: 'acc-ms-test',
        username: 'TestMS',
        uuid: '11111111-2222-3333-4444-555555555555',
        type: 'microsoft',
        accessToken: '', // Vacío para forzar renovación de token
        refreshToken: 'stale-refresh-token',
        lastUsed: Date.now(),
      };

      useLauncherStore.setState({
        accounts: [msAccount],
        activeAccountId: 'acc-ms-test',
        launch: { status: 'IDLE', progress: 0, message: '' },
      });

      const { refreshMicrosoftSession, MicrosoftAuthError } =
        await import('../../services/microsoftAuthService');
      vi.mocked(refreshMicrosoftSession).mockRejectedValueOnce(
        new MicrosoftAuthError(
          'The provided value for the input parameter is not valid.',
          'invalid_grant',
        ),
      );

      await launcherActions.startLaunchFlow();

      const state = getLauncherState();
      expect(state.launch.status).toBe('IDLE');
      expect(state.launch.message).toContain('invalid_grant');
      const updatedAccount = state.accounts.find((a) => a.id === 'acc-ms-test');
      expect(updatedAccount?.requiresReauth).toBe(true);
    });

    it('ignora startLaunchFlow si el estado no es IDLE', async () => {
      useLauncherStore.setState({
        launch: { status: 'LAUNCHING', progress: 50, message: 'En progreso...' },
      });

      await launcherActions.startLaunchFlow();
      expect(getLauncherState().launch.status).toBe('LAUNCHING');
    });

    it('maneja killGameFlow deteniendo el juego y regresando a IDLE', async () => {
      await launcherActions.killGameFlow();
      expect(getLauncherState().launch.status).toBe('IDLE');
      expect(getLauncherState().launch.message).toBe('Juego detenido.');
    });

    it('maneja killGameFlow cuando killGame lanza un error registrando el mensaje de error', async () => {
      const { killGame } = await import('../../services/launcherService');
      vi.mocked(killGame).mockRejectedValueOnce(new Error('Failed to terminate process'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await launcherActions.killGameFlow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Launcher Store] Kill game failed:',
        'Failed to terminate process',
      );
      expect(getLauncherState().launch.status).toBe('IDLE');
      expect(getLauncherState().launch.message).toBe('Juego detenido.');

      consoleSpy.mockRestore();
    });

    it('permite gestionar cuentas mediante addAccount, setActiveAccount y removeAccount', async () => {
      const newAcc: UserAccount = {
        id: 'acc2',
        username: 'Alex',
        uuid: '22222222-3333-4444-5555-666666666666',
        type: 'microsoft',
        lastUsed: Date.now(),
      };

      await launcherActions.addAccount(newAcc);
      expect(getLauncherState().accounts.some((a) => a.id === 'acc2')).toBe(true);

      await launcherActions.setActiveAccount('acc2');
      expect(getLauncherState().activeAccountId).toBe('acc2');

      await launcherActions.removeAccount('acc2');
      expect(getLauncherState().accounts.some((a) => a.id === 'acc2')).toBe(false);
    });

    it('permite crear, seleccionar, duplicar y borrar instancias sincronizando settings', () => {
      const inst = launcherActions.createInstance({
        name: 'Prueba',
        mcVersion: '1.20.4',
        loaderType: 'fabric',
      });
      expect(inst).toBeDefined();
      expect(getLauncherState().settings.mcVersion).toBe('1.20.4');
      expect(getLauncherState().settings.loaderType).toBe('fabric');

      launcherActions.selectInstance(inst.id);
      expect(getLauncherState().activeInstanceId).toBe(inst.id);
      expect(getLauncherState().settings.mcVersion).toBe('1.20.4');
      expect(getLauncherState().settings.loaderType).toBe('fabric');

      const duplicated = launcherActions.duplicateInstance(inst.id);
      expect(duplicated).toBeDefined();
      expect(duplicated.name).toBe('Prueba (Copia)');
      expect(getLauncherState().activeInstanceId).toBe(duplicated.id);
      expect(getLauncherState().settings.mcVersion).toBe('1.20.4');

      launcherActions.deleteInstance(inst.id);
      launcherActions.deleteInstance(duplicated.id);
    });

    it('permite alternar botones panorama y tema GUI', () => {
      launcherActions.togglePanoramaButton('instances');
      launcherActions.resetGuiTheme();
      expect(getLauncherState().guiTheme).toBeDefined();
    });

    it('actualiza fondos personalizados, color de acento y ajustes de tema', () => {
      launcherActions.setCustomWallpaper('file:///custom.mp4', true);
      expect(getLauncherState().customWallpaperUrl).toBe('file:///custom.mp4');
      expect(getLauncherState().isVideoWallpaper).toBe(true);

      launcherActions.setAccentColor('#22c55e');
      expect(getLauncherState().accentColor).toBe('#22c55e');

      launcherActions.setGuiTheme({ bgMode: 'obsidian' });
      expect(getLauncherState().guiTheme.bgMode).toBe('obsidian');

      useLauncherStore.setState((prev) => ({
        settings: { ...prev.settings, maxRamGb: 8, fullscreen: true },
      }));
      expect(getLauncherState().settings.maxRamGb).toBe(8);
      expect(getLauncherState().settings.fullscreen).toBe(true);
    });
  });

  describe('sanitizeLauncherSettings', () => {
    it('devuelve defaultSettings cuando el argumento es nulo, no objeto o primitivo', () => {
      expect(sanitizeLauncherSettings(null)).toBeDefined();
      expect(sanitizeLauncherSettings(undefined)).toBeDefined();
      expect(sanitizeLauncherSettings('invalid')).toBeDefined();
      expect(sanitizeLauncherSettings(123)).toBeDefined();
    });

    it('sanitiza valores de ram fuera de rango y loaders desconocidos', () => {
      const sanitized = sanitizeLauncherSettings({
        minRamGb: -10,
        maxRamGb: 1000,
        loaderType: 'unknown_loader',
        loaderVersion: '999',
        resolution: 'invalid-resolution',
        fullscreen: 'no-boolean',
        autoCloseLauncher: null,
      });

      expect(sanitized.minRamGb).toBeGreaterThanOrEqual(1);
      expect(sanitized.maxRamGb).toBeLessThanOrEqual(64);
      expect(sanitized.loaderType).toBeDefined();
      expect(sanitized.resolution).toMatch(/^\d+x\d+$/);
    });

    it('corrige la versión de neoforge cuando es 21.1.65 o vacía a 21.1.252', () => {
      const sanitized = sanitizeLauncherSettings({
        loaderType: 'neoforge',
        loaderVersion: '21.1.65',
      });
      expect(sanitized.loaderVersion).toBe('21.1.252');

      const sanitizedEmpty = sanitizeLauncherSettings({
        loaderType: 'neoforge',
        loaderVersion: '',
      });
      expect(sanitizedEmpty.loaderVersion).toBe('21.1.252');
    });
  });

  describe('buildLaunchOptions branches', () => {
    it('construye opciones con comandos personalizados y fullscreen explícito de la instancia', () => {
      const testAccount: UserAccount = {
        id: 'acc-opts',
        username: 'Hero',
        uuid: '00000000-0000-0000-0000-000000000001',
        accessToken: 'valid-token',
        type: 'microsoft',
        lastUsed: Date.now(),
      };

      const customInst: GameInstance = {
        id: 'inst-custom',
        name: 'Custom Fabric Instance',
        mcVersion: '1.20.1',
        loaderType: 'fabric',
        loaderVersion: '0.15.11',
        fullscreen: true,
        maxRamGb: 4,
        minRamGb: 2,
        preLaunchCommand: 'echo pre',
        wrapperCommand: 'gamemoderun',
        postExitCommand: 'echo post',
        environmentVariables: 'MESA_GL_VERSION_OVERRIDE=4.6',
        icon: 'cube',
        createdAt: Date.now(),
      };

      const opts = buildLaunchOptions(testAccount, customInst, 'C:\\custom\\gameDir');

      expect(opts.username).toBe('Hero');
      expect(opts.fullscreen).toBe(true);
      expect(opts.loaderType).toBe('fabric');
      expect(opts.loaderVersion).toBe('0.15.11');
      expect(opts.preLaunchCommand).toBe('echo pre');
      expect(opts.wrapperCommand).toBe('gamemoderun');
      expect(opts.postExitCommand).toBe('echo post');
      expect(opts.environmentVariables).toBe('MESA_GL_VERSION_OVERRIDE=4.6');
      expect(opts.maxRam).toBe(4096);
      expect(opts.minRam).toBe(2048);
    });

    it('construye opciones para vanilla omitiendo loaderType y loaderVersion', () => {
      const testAccount: UserAccount = {
        id: 'acc-vanilla',
        username: 'VanillaSteve',
        uuid: '',
        accessToken: '',
        type: 'guest',
        lastUsed: Date.now(),
      };

      const vanillaInst: GameInstance = {
        id: 'inst-vanilla',
        name: 'Pure Vanilla',
        mcVersion: '1.21.1',
        loaderType: 'vanilla',
        icon: 'cube',
        createdAt: Date.now(),
      };

      const opts = buildLaunchOptions(testAccount, vanillaInst, 'C:\\vanilla\\gameDir');

      expect(opts.loaderType).toBeUndefined();
      expect(opts.loaderVersion).toBeUndefined();
      expect(opts.uuid).toBe('00000000-0000-0000-0000-000000000000');
      expect(opts.accessToken).toBe('00000000-0000-0000-0000-000000000000');
    });
  });

  describe('shouldDeployBoost', () => {
    it('debe devolver true para fabric 1.21.1', () => {
      expect(shouldDeployBoost('fabric', '1.21.1')).toBe(true);
    });

    it('debe devolver true para neoforge 1.21.1', () => {
      expect(shouldDeployBoost('neoforge', '1.21.1')).toBe(true);
    });

    it('debe devolver true para quilt 1.21.1', () => {
      expect(shouldDeployBoost('quilt', '1.21.1')).toBe(true);
    });

    it('debe devolver false para fabric 1.20.1', () => {
      expect(shouldDeployBoost('fabric', '1.20.1')).toBe(false);
    });

    it('debe devolver false para forge 1.21.1', () => {
      expect(shouldDeployBoost('forge', '1.21.1')).toBe(false);
    });

    it('debe devolver false para neoforge 1.21.4', () => {
      expect(shouldDeployBoost('neoforge', '1.21.4')).toBe(false);
    });

    it('debe devolver false para cadenas vacías o undefined', () => {
      expect(shouldDeployBoost('', '1.21.1')).toBe(false);
      expect(shouldDeployBoost('fabric', '')).toBe(false);
      expect(shouldDeployBoost('', '')).toBe(false);
      expect(shouldDeployBoost(undefined, '1.21.1')).toBe(false);
      expect(shouldDeployBoost('fabric', undefined)).toBe(false);
      expect(shouldDeployBoost(undefined, undefined)).toBe(false);
    });
  });
});

