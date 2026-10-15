import { describe, it, expect, vi } from 'vitest';
import {
  isLibraryAllowed,
  resolveLibraryPath,
  resolveActiveGc,
  isConflictingGcArg,
  shouldKeepJvmArg,
  ensureActiveGcPresent,
  sanitizeJvmArgs,
  resolveOptimizationJvmFlags,
  buildResolutionArgs,
  buildGameArgs,
  resolveVersionId,
  mergeParentManifest,
  buildJvmArgs,
  processManifestJvmArgs,
  extractCustomGameArgs,
  killGame,
  checkGameRunning,
  launchGame,
} from '../launcherService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('launcherService pure helpers', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
      writable: true,
    });
  });
  describe('isLibraryAllowed', () => {
    it('permite librerías sin reglas explícitas', () => {
      expect(isLibraryAllowed({})).toBe(true);
      expect(isLibraryAllowed({ rules: [] })).toBe(true);
    });

    it('aplica reglas allow generales y específicas de windows', () => {
      expect(isLibraryAllowed({ rules: [{ action: 'allow' }] })).toBe(true);
      expect(isLibraryAllowed({ rules: [{ action: 'allow', os: { name: 'windows' } }] })).toBe(
        true,
      );
      expect(isLibraryAllowed({ rules: [{ action: 'allow', os: { name: 'osx' } }] })).toBe(false);
    });

    it('aplica reglas disallow específicas de plataforma', () => {
      expect(
        isLibraryAllowed({
          rules: [{ action: 'allow' }, { action: 'disallow', os: { name: 'windows' } }],
        }),
      ).toBe(false);
    });
  });

  describe('resolveLibraryPath', () => {
    it('prioriza downloads.artifact.path si está presente', () => {
      const lib = { downloads: { artifact: { path: 'net/minecraft/library.jar' } } };
      expect(resolveLibraryPath(lib)).toBe('net/minecraft/library.jar');
    });

    it('resuelve coordenadas Maven estándar', () => {
      const lib = { name: 'org.ow2.asm:asm:9.5' };
      expect(resolveLibraryPath(lib)).toBe('org/ow2/asm/asm/9.5/asm-9.5.jar');
    });

    it('resuelve coordenadas Maven con classifier y extensión custom', () => {
      const lib = { name: 'org.lwjgl:lwjgl:3.3.3:natives-windows@zip' };
      expect(resolveLibraryPath(lib)).toBe('org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.zip');
    });

    it('devuelve null si el nombre es inválido o faltan coordenadas', () => {
      expect(resolveLibraryPath({})).toBeNull();
      expect(resolveLibraryPath({ name: 'solo-un-nombre' })).toBeNull();
    });
  });

  describe('resolveActiveGc & isConflictingGcArg', () => {
    it('resuelve GC especificado explícitamente por el usuario', () => {
      expect(resolveActiveGc(['-XX:+UseG1GC'], '-XX:+UseZGC')).toBe('-XX:+UseZGC');
      expect(resolveActiveGc([], '-XX:+UseShenandoahGC')).toBe('-XX:+UseShenandoahGC');
    });

    it('resuelve GC desde rawJvmArgs o cae en G1GC por defecto', () => {
      expect(resolveActiveGc(['-XX:+UseParallelGC'])).toBe('-XX:+UseParallelGC');
      expect(resolveActiveGc(['-Xmx4096M'])).toBe('-XX:+UseG1GC');
    });

    it('detecta argumentos de GC en conflicto según el recolector activo', () => {
      expect(isConflictingGcArg('-XX:+UseParallelGC', '-XX:+UseG1GC')).toBe(true);
      expect(isConflictingGcArg('-XX:+UseG1GC', '-XX:+UseG1GC')).toBe(false);

      // Argumentos específicos de G1 cuando el activo NO es G1
      expect(isConflictingGcArg('-XX:G1NewSizePercent=20', '-XX:+UseZGC')).toBe(true);
      expect(isConflictingGcArg('-XX:G1NewSizePercent=20', '-XX:+UseG1GC')).toBe(false);

      // Argumentos específicos de ZGC cuando el activo NO es ZGC
      expect(isConflictingGcArg('-XX:+ZGenerational', '-XX:+UseG1GC')).toBe(true);
      expect(isConflictingGcArg('-XX:+ZGenerational', '-XX:+UseZGC')).toBe(false);

      // Argumentos de Shenandoah cuando el activo NO es Shenandoah
      expect(isConflictingGcArg('-XX:ShenandoahGCHeuristics=adaptive', '-XX:+UseG1GC')).toBe(true);
      expect(
        isConflictingGcArg('-XX:ShenandoahGCHeuristics=adaptive', '-XX:+UseShenandoahGC'),
      ).toBe(false);
    });
  });

  describe('shouldKeepJvmArg & ensureActiveGcPresent', () => {
    it('filtra argumentos conflictivos y flags duplicadas exactas', () => {
      const seen = new Set<string>();
      expect(shouldKeepJvmArg('-XX:+UseParallelGC', '-XX:+UseG1GC', seen)).toBe(false);

      expect(shouldKeepJvmArg('-Dsun.io.useCanonCaches=false', '-XX:+UseG1GC', seen)).toBe(true);
      // Segunda aparición se descarta
      expect(shouldKeepJvmArg('-Dsun.io.useCanonCaches=false', '-XX:+UseG1GC', seen)).toBe(false);
    });

    it('asegura la presencia del GC activo en la lista saneada', () => {
      const list = ['-Xmx4096M', '-Dprop=true'];
      ensureActiveGcPresent(list, '-XX:+UseG1GC');
      expect(list).toContain('-XX:+UseG1GC');
      expect(list[1]).toBe('-XX:+UseG1GC');

      // Si ya está presente, no lo duplica
      ensureActiveGcPresent(list, '-XX:+UseG1GC');
      expect(list.filter((x) => x === '-XX:+UseG1GC')).toHaveLength(1);
    });
  });

  describe('sanitizeJvmArgs', () => {
    it('preserva tokens tras -cp y sanea flags conflictivas', () => {
      const raw = [
        '-Xmx4096M',
        '-cp',
        'libraries/a.jar;libraries/b.jar',
        '-XX:+UseParallelGC',
        '-XX:+UseG1GC',
        '-XX:G1NewSizePercent=20',
        '-XX:G1NewSizePercent=20',
      ];
      const result = sanitizeJvmArgs(raw, '-XX:+UseG1GC');

      expect(result).toContain('-cp');
      expect(result).toContain('libraries/a.jar;libraries/b.jar');
      expect(result).not.toContain('-XX:+UseParallelGC');
      expect(result).toContain('-XX:+UseG1GC');
      expect(result.filter((x) => x === '-XX:G1NewSizePercent=20')).toHaveLength(1);
    });
  });

  describe('resolveOptimizationJvmFlags', () => {
    it('respeta argumentos de javaArgs provistos por el usuario preservando optimizaciones', () => {
      const flags = resolveOptimizationJvmFlags({
        maxRam: 4096,
        javaArgs: '-XX:+UseZGC -XX:+ZGenerational',
      } as any);
      expect(flags).toContain('-XX:+UseZGC');
      expect(flags).toContain('-XX:+ZGenerational');
      expect(flags).toContain('-XX:+UseSuperWord');
    });

    it('permite comas y signos de igual en los tokens de javaArgs', () => {
      const flags = resolveOptimizationJvmFlags({
        maxRam: 4096,
        useOptimization: false,
        javaArgs: '-XX:CompileThreshold=1500 -Dcustom.prop=a,b,c',
      } as any);
      expect(flags).toContain('-XX:CompileThreshold=1500');
      expect(flags).toContain('-Dcustom.prop=a,b,c');
    });

    it('retorna flags básicas si useOptimization es false', () => {
      const flags = resolveOptimizationJvmFlags({
        maxRam: 4096,
        useOptimization: false,
      } as any);
      expect(flags).toEqual(['-XX:+UseG1GC']);
    });

    it('aplica flags recomendadas por hardware o defaults de alto rendimiento', () => {
      const customHw = ['-XX:+UseShenandoahGC'];
      const hwFlags = resolveOptimizationJvmFlags({ maxRam: 4096 } as any, customHw);
      expect(hwFlags).toContain('-XX:+UseShenandoahGC');
      expect(hwFlags).toContain('-Djava.net.preferIPv4Stack=true');
      expect(hwFlags).toContain('-XX:+UseSuperWord');

      const defaultFlags = resolveOptimizationJvmFlags({ maxRam: 4096 } as any);
      expect(defaultFlags).toContain('-XX:+UnlockExperimentalVMOptions');
      expect(defaultFlags).toContain('-XX:+UseG1GC');
      expect(defaultFlags).toContain('-XX:+UseSuperWord');
    });

    it('emite Generational ZGC si Java es >= 21 y la memoria es >= 4096M', () => {
      const zgcFlags = resolveOptimizationJvmFlags({ maxRam: 4096 } as any, undefined, 21);
      expect(zgcFlags).toContain('-XX:+UseZGC');
      expect(zgcFlags).toContain('-XX:+ZGenerational');
      expect(zgcFlags).toContain('-XX:ZAllocationSpikeTolerance=5');
      expect(zgcFlags).not.toContain('-XX:+UseG1GC');
    });

    it('mantiene G1GC si Java es < 21 incluso con memoria alta', () => {
      const g1Flags = resolveOptimizationJvmFlags({ maxRam: 8192 } as any, undefined, 17);
      expect(g1Flags).toContain('-XX:+UseG1GC');
      expect(g1Flags).not.toContain('-XX:+UseZGC');
    });

    it('retiene G1GC si la memoria es < 4096M incluso en Java 21', () => {
      const lowRamFlags = resolveOptimizationJvmFlags({ maxRam: 2048 } as any, undefined, 21);
      expect(lowRamFlags).toContain('-XX:+UseG1GC');
      expect(lowRamFlags).not.toContain('-XX:+UseZGC');
    });
  });

  describe('buildResolutionArgs & resolveVersionId', () => {
    it('parsea resolución de ventana y flag fullscreen', () => {
      expect(
        buildResolutionArgs({ maxRam: 4096, resolution: '1920x1080', fullscreen: true } as any),
      ).toEqual(['--width', '1920', '--height', '1080', '--fullscreen']);

      expect(buildResolutionArgs({ maxRam: 4096, resolution: 'Desktop' } as any)).toEqual([
        '--width',
        '1280',
        '--height',
        '720',
      ]);
    });

    it('resuelve IDs según modloader', () => {
      expect(
        resolveVersionId({ maxRam: 4096, mcVersion: '1.21.1', loaderType: 'vanilla' } as any),
      ).toBe('1.21.1');
      expect(
        resolveVersionId({
          maxRam: 4096,
          mcVersion: '1.21.1',
          loaderType: 'neoforge',
          loaderVersion: '21.1.252',
        } as any),
      ).toBe('neoforge-21.1.252');
      expect(
        resolveVersionId({
          maxRam: 4096,
          mcVersion: '1.20.1',
          loaderType: 'forge',
          loaderVersion: '47.3.0',
        } as any),
      ).toBe('1.20.1-forge-47.3.0');
      expect(
        resolveVersionId({
          maxRam: 4096,
          mcVersion: '1.21.1',
          loaderType: 'fabric',
          loaderVersion: '0.16.10',
        } as any),
      ).toBe('fabric-loader-0.16.10-1.21.1');
      expect(
        resolveVersionId({
          maxRam: 4096,
          mcVersion: '1.21.1',
          loaderType: 'quilt',
          loaderVersion: '0.27.1',
        } as any),
      ).toBe('quilt-loader-0.27.1-1.21.1');
    });
  });

  describe('mergeParentManifest', () => {
    it('combina manifiestos padre e hijo sin duplicar librerías', () => {
      const parent = {
        mainClass: 'net.minecraft.client.main.Main',
        libraries: [{ name: 'org.lwjgl:lwjgl:3.3.3' }],
      };
      const child = {
        inheritsFrom: '1.21.1',
        libraries: [{ name: 'net.neoforged:neoforge:21.1.252' }],
      };

      const merged = mergeParentManifest(parent, child, 'neoforge-21.1.252');
      expect(merged.versionData.mainClass).toBe('net.minecraft.client.main.Main');
      expect(merged.versionData.libraries?.length).toBe(2);
      expect(merged.effectiveVersionId).toBe('neoforge-21.1.252');
      expect(merged.baseMcVersion).toBe('1.21.1');
    });

    it('fusiona arguments jvm y game concatenando los arreglos de padre e hijo', () => {
      const parent = {
        arguments: {
          jvm: ['-Dparent=1'],
          game: ['--demo'],
        },
      };
      const child = {
        inheritsFrom: '1.21.1',
        arguments: {
          jvm: ['-Dchild=2'],
          game: ['--quickPlaySingleplayer', 'World'],
        },
      };

      const merged = mergeParentManifest(parent, child, 'custom-loader');
      expect(merged.versionData.arguments?.jvm).toEqual(['-Dparent=1', '-Dchild=2']);
      expect(merged.versionData.arguments?.game).toEqual([
        '--demo',
        '--quickPlaySingleplayer',
        'World',
      ]);
    });
  });

  describe('resolveVersionId mcVer cleaning', () => {
    it('limpia sufijos y decoraciones en mcVersion', () => {
      expect(
        resolveVersionId({ mcVersion: '1.21.1 (Vanilla)', loaderType: 'vanilla' } as any),
      ).toBe('1.21.1');
      expect(
        resolveVersionId({
          mcVersion: '1.21.1 (Fabric)',
          loaderType: 'fabric',
          loaderVersion: '0.16.10',
        } as any),
      ).toBe('fabric-loader-0.16.10-1.21.1');
    });
  });

  describe('buildJvmArgs & buildGameArgs', () => {
    it('construye argumentos JVM respetando RAM mínima, máxima y agentArgs', () => {
      const versionData = {
        arguments: {
          jvm: ['-Dtest.prop=1', '${library_directory}'],
        },
      };
      const params = {
        username: 'PlayerOne',
        uuid: 'uuid-123',
        accessToken: 'token-abc',
        maxRam: 8192,
        minRam: 2048,
      };

      const jvm = buildJvmArgs(
        versionData,
        params as any,
        'C:/game',
        '1.21.1',
        'cp.jar',
        undefined,
        ['-javaagent:agent.jar'],
      );

      expect(jvm).toContain('-Xmx8192M');
      expect(jvm).toContain('-Xms2048M');
      expect(jvm).toContain('-javaagent:agent.jar');
      expect(jvm).toContain('-Dtest.prop=1');
    });

    it('construye argumentos de juego con sustitución de placeholders', () => {
      const versionData = {
        arguments: {
          game: ['--username', '${auth_player_name}', '--uuid', '${auth_uuid}'],
        },
      };
      const params = {
        username: 'HeroSteve',
        uuid: 'steve-uuid-999',
        accessToken: 'access-token-111',
        maxRam: 4096,
      };

      const gameArgs = buildGameArgs(
        versionData,
        params as any,
        '1.21.1',
        '1.21.1',
        'C:/game',
        'C:/Users/Test',
      );

      expect(gameArgs).toContain('HeroSteve');
      expect(gameArgs).toContain('steve-uuid-999');
      expect(gameArgs).toContain('--width');
      expect(gameArgs).toContain('1280');
    });
  });

  describe('killGame & checkGameRunning Tauri invokers', () => {
    it('invoca comando kill_minecraft y maneja éxito y error', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(true);
      expect(await killGame()).toBe(true);

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Process not found'));
      expect(await killGame()).toBe(false);
    });

    it('invoca comando is_game_running y maneja estado booleano', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(true);
      expect(await checkGameRunning()).toBe(true);

      vi.mocked(invoke).mockRejectedValueOnce(new Error('IPC error'));
      expect(await checkGameRunning()).toBe(false);
    });
  });

  describe('launchGame execution sequence', () => {
    it('ejecuta launchGame de inicio a fin resolviendo runtime y despachando proceso', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
        if (cmd === 'get_home_dir') return 'C:/Users/TestUser';
        if (cmd === 'read_text_file') {
          if (args?.path?.includes('version.json')) {
            return JSON.stringify({
              mainClass: 'net.minecraft.client.main.Main',
              arguments: { game: ['--username', '${auth_player_name}'] },
              libraries: [],
            });
          }
          return 'fullscreen:false';
        }
        if (cmd === 'launch_minecraft') return 4321;
        if (cmd === 'is_game_running') return true;
        return true;
      });

      const progressUpdates: Array<{ status: string; progress: number }> = [];
      const pid = await launchGame(
        {
          mcVersion: '1.21.1',
          username: 'Alex',
          uuid: 'alex-uuid',
          accessToken: 'token-123',
          maxRam: 4096,
          fullscreen: true,
          useOptimization: true,
          javaPath: 'C:/Java/bin/javaw.exe',
        },
        (status, progress) => {
          progressUpdates.push({ status, progress });
        },
      );

      expect(pid).toBe(4321);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('no invoca prepare_crystal_agent cuando useOptimization es false', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const invokedCommands: string[] = [];
      vi.mocked(invoke).mockImplementation(async (cmd: string, args?: any) => {
        invokedCommands.push(cmd);
        if (cmd === 'get_home_dir') return 'C:/Users/TestUser';
        if (cmd === 'read_text_file') {
          if (args?.path?.includes('version.json')) {
            return JSON.stringify({
              mainClass: 'net.minecraft.client.main.Main',
              arguments: { game: ['--username', '${auth_player_name}'] },
              libraries: [],
            });
          }
          return 'fullscreen:false';
        }
        if (cmd === 'launch_minecraft') return 9999;
        return true;
      });

      await launchGame({
        mcVersion: '1.21.1',
        username: 'Alex',
        uuid: 'alex-uuid',
        accessToken: 'token-123',
        maxRam: 4096,
        useOptimization: false,
        javaPath: 'C:/Java/bin/javaw.exe',
      });

      expect(invokedCommands).not.toContain('prepare_crystal_agent');
    });
  });

  describe('processManifestJvmArgs & extractCustomGameArgs Phase 5 fixes', () => {
    it('soporta reglas OS en objetos JVM args y evalua platform allow/disallow', () => {
      const manifestJvm = [
        '-Dcommon=true',
        {
          rules: [{ action: 'allow', os: { name: 'osx' } }],
          value: ['-XstartOnFirstThread'],
        },
        {
          rules: [{ action: 'allow', os: { name: 'windows' } }],
          value: '-XX:HeapDumpPath=C:/dumps',
        },
      ];
      const placeholders = { version_name: '1.21.1' };
      const { args } = processManifestJvmArgs(manifestJvm, placeholders, 'cp.jar', '1.21.1', '1.21.1');

      expect(args).toContain('-Dcommon=true');
      expect(args).toContain('-XX:HeapDumpPath=C:/dumps');
      expect(args).not.toContain('-XstartOnFirstThread');
    });

    it('añade ,${mcVersion}.jar a -DignoreList cuando versionId !== mcVersion', () => {
      const manifestJvm = [
        '-DignoreList=${version_name}.jar,client.jar',
      ];
      const placeholders = { version_name: 'neoforge-21.1.252' };
      const { args } = processManifestJvmArgs(
        manifestJvm,
        placeholders,
        'cp.jar',
        '1.21.1',
        'neoforge-21.1.252',
      );

      expect(args[0]).toBe('-DignoreList=neoforge-21.1.252.jar,client.jar,1.21.1.jar');
    });

    it('no duplica ,${mcVersion}.jar si versionId === mcVersion o si ya está incluido', () => {
      const manifestJvm = [
        '-DignoreList=1.21.1.jar',
      ];
      const placeholders = { version_name: '1.21.1' };
      const { args } = processManifestJvmArgs(
        manifestJvm,
        placeholders,
        'cp.jar',
        '1.21.1',
        '1.21.1',
      );

      expect(args[0]).toBe('-DignoreList=1.21.1.jar');
    });

    it('extractCustomGameArgs cae en versionData.minecraftArguments si arguments.game es un array vacío (Forge clásico)', () => {
      const versionData = {
        arguments: { game: [] },
        minecraftArguments: '--username ${auth_player_name} --version ${version_name} --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker',
      };
      const placeholders = {
        auth_player_name: 'ClassicSteve',
        version_name: '1.12.2-forge-14.23.5.2860',
      };

      const extracted = extractCustomGameArgs(versionData, placeholders);
      expect(extracted).toContain('--tweakClass');
      expect(extracted).toContain('net.minecraftforge.fml.common.launcher.FMLTweaker');
      expect(extracted).toContain('ClassicSteve');
    });

    it('extractCustomGameArgs usa arguments.game cuando contiene elementos', () => {
      const versionData = {
        arguments: { game: ['--username', '${auth_player_name}'] },
        minecraftArguments: '--tweakClass shouldNotBeUsed',
      };
      const placeholders = { auth_player_name: 'ModernPlayer' };

      const extracted = extractCustomGameArgs(versionData, placeholders);
      expect(extracted).toEqual(['--username', 'ModernPlayer']);
    });
  });
});
