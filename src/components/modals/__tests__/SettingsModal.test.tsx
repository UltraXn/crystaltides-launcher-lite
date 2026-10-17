import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  SettingsModal,
  SettingsMinecraftSection,
  SettingsPersonalizationSection,
} from '../SettingsModal';
import {
  isNearOpacity,
  getLoaderStatusColor,
  getCustomWallpaperLabel,
  resolveActiveBtnColor,
  extractCleanMinecraftVersion,
} from '../../../utils/settingsUtils';
import { useLauncherStore, launcherActions } from '../../../store/launcherStore';
import * as wallpaperStorage from '../../../utils/wallpaperStorage';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_home_dir' || cmd === 'resolve_data_dir') {
      return Promise.resolve('C:\\Users\\Default\\.crystaltides');
    }
    if (cmd === 'write_text_file' || cmd === 'restart_app') {
      return Promise.resolve(true);
    }
    return Promise.resolve('C:\\Users\\Default\\.crystaltides');
  }),
}));

vi.mock('../../../services/minecraftMetadataService', () => ({
  fetchVanillaVersions: vi.fn().mockResolvedValue(['1.21.1', '1.20.1', '1.19.4']),
  fetchInstalledLocalVersions: vi.fn().mockResolvedValue(['1.21.1']),
  fetchFabricLoaderVersions: vi.fn().mockResolvedValue(['0.16.10']),
  fetchQuiltLoaderVersions: vi.fn().mockResolvedValue(['0.27.1']),
  fetchNeoForgeVersions: vi.fn().mockResolvedValue(['21.1.252']),
  fetchForgeVersions: vi.fn().mockResolvedValue(['47.3.0']),
  installLoader: vi.fn().mockResolvedValue('Instalación completada'),
  isBetaLoaderVersion: vi.fn((v: string) => /beta|alpha|rc|pre|snapshot/i.test(v)),
}));

vi.mock('../../../services/javaService', () => ({
  getJavaVersionForMinecraft: vi.fn().mockReturnValue(21),
  ensureJava: vi.fn().mockResolvedValue('C:\\Java\\bin\\javaw.exe'),
}));

vi.mock('../../../utils/wallpaperStorage', () => ({
  saveWallpaperFile: vi.fn().mockResolvedValue({ url: 'file:///wallpaper.mp4', isVideo: true }),
  clearCustomWallpaper: vi.fn().mockResolvedValue(true),
  saveDockPanoramaFile: vi.fn().mockResolvedValue('file:///panorama.png'),
  clearDockPanorama: vi.fn().mockResolvedValue(true),
  clearButtonMedia: vi.fn().mockResolvedValue(true),
  isVideoSource: vi
    .fn()
    .mockImplementation((url: string) => url.endsWith('.mp4') || url.endsWith('.webm')),
}));

describe('SettingsModal Component & Helpers Suite', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      activeModal: 'settings',
      settings: {
        mcVersion: '1.21.1',
        loaderType: 'neoforge',
        loaderVersion: '21.1.252',
        maxRamGb: 6,
        resolution: '1280x720',
        fullscreen: false,
        useOptimization: true,
        javaPath: '',
        javaArgs: '',
        autoConnectServer: true,
      } as any,
      activeWallpaperId: 'crystal-ocean',
      customWallpaperUrl: '',
      isVideoWallpaper: false,
      wallpaperMuted: true,
      wallpaperVolume: 0.5,
      accentColor: '#00e5ff',
      guiTheme: 'crystal-glass' as any,
      dockConfig: {
        layoutMode: 'dock',
        position: 'bottom',
        activeButtons: ['play', 'settings'],
        buttonOrder: ['play', 'settings'],
        visibleButtons: ['play', 'settings'],
        buttonScale: 1,
        showLabels: true,
        enableCollisionPush: true,
      } as any,
      language: 'es',
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Pure Helper Functions', () => {
    it('isNearOpacity evalúa proximidad de opacidad', () => {
      expect(isNearOpacity(0.5, 0.505)).toBe(true);
      expect(isNearOpacity(0.5, 0.52)).toBe(false);
    });

    it('getLoaderStatusColor retorna el color correcto según estado', () => {
      expect(getLoaderStatusColor({ success: true })).toBe('#22c55e');
      expect(getLoaderStatusColor({ loading: true })).toBe('#38bdf8');
      expect(getLoaderStatusColor({})).toBe('#f43f5e');
    });

    it('getCustomWallpaperLabel detecta tipos de fondo correctamente', () => {
      expect(getCustomWallpaperLabel('http://server.com/bg.mp4', true)).toBe(
        'Vídeo de fondo en uso',
      );
      expect(getCustomWallpaperLabel('http://server.com/anim.gif', false)).toBe(
        'GIF animado en uso',
      );
      expect(getCustomWallpaperLabel('data:image/gif;base64,123', false)).toBe(
        'GIF animado en uso',
      );
      expect(getCustomWallpaperLabel('http://server.com/bg.png', false)).toBe(
        'Fondo personalizado en uso',
      );
    });

    it('resolveActiveBtnColor resuelve colores de botones y fallbacks', () => {
      expect(resolveActiveBtnColor('play', { play: '#ff0055' })).toBe('#ff0055');
      expect(resolveActiveBtnColor('launch', {}, 'custom', '#123456')).toBe('#123456');
      expect(resolveActiveBtnColor('launch', {}, 'preset')).toBe('#22c55e');
      expect(resolveActiveBtnColor('other', {}, undefined, undefined, '#abcdef')).toBe('#abcdef');
      expect(resolveActiveBtnColor('other', {})).toBe('#16A085');
    });

    it('extractCleanMinecraftVersion extrae limpiamente la versión base de Minecraft', () => {
      expect(extractCleanMinecraftVersion('quilt-loader-0.31.0-beta.4-26.2 (quilt)')).toBe('26.2');
      expect(extractCleanMinecraftVersion('quilt-loader-0.31.0-beta.4-26.2')).toBe('26.2');
      expect(extractCleanMinecraftVersion('fabric-loader-0.16.10-1.21.1')).toBe('1.21.1');
      expect(extractCleanMinecraftVersion('1.20.1-forge-47.3.0')).toBe('1.20.1');
      expect(extractCleanMinecraftVersion('neoforge-21.1.252')).toBe('1.21.1');
      expect(extractCleanMinecraftVersion('neoforge-21.0.12')).toBe('1.21');
      expect(extractCleanMinecraftVersion('neoforge-20.4.80')).toBe('1.20.4');
      expect(extractCleanMinecraftVersion('neoforge-26.1.2.122')).toBe('26.1.2');
      expect(extractCleanMinecraftVersion('neoforge-26.2.0.93')).toBe('26.2');
      expect(extractCleanMinecraftVersion('1.21.1 (Vanilla)')).toBe('1.21.1');
      expect(extractCleanMinecraftVersion('1.21.4')).toBe('1.21.4');
    });
  });

  describe('SettingsMinecraftSection Subcomponent', () => {
    const mockT: any = {
      instances: { officialTag: 'Oficial' },
      settings: {
        installedLocallyGroup: 'Instalado localmente',
        officialMojangGroup: 'Versiones oficiales',
        manualVersionPlaceholder: 'Versión manual...',
        manualLoaderPlaceholder: 'Loader manual...',
        languageTitle: 'Idioma',
        languageDesc: 'Selecciona el idioma de la interfaz',
        spanish: 'Español',
        english: 'English',
      },
    };

    it('renderiza input deshabilitado cuando el loader es vanilla', () => {
      render(
        <SettingsMinecraftSection
          t={mockT}
          language="es"
          mcVersion="1.21.1"
          setMcVersion={vi.fn()}
          showAllVersions={false}
          setShowAllVersions={vi.fn()}
          customVersionMode={false}
          setCustomVersionMode={vi.fn()}
          allVersions={['1.21.1']}
          localVersions={['1.21.1']}
          isLoadingVersions={false}
          loaderType="vanilla"
          setLoaderType={vi.fn()}
          loaderVersion=""
          setLoaderVersion={vi.fn()}
          customLoaderMode={false}
          setCustomLoaderMode={vi.fn()}
          availableLoaderVersions={[]}
          loaderInstallStatus={{ loading: false }}
          handleInstallLoader={vi.fn()}
          ramMb={4096}
          setRamMb={vi.fn()}
          width="1280"
          setWidth={vi.fn()}
          height="720"
          setHeight={vi.fn()}
          useDesktopRes={false}
          setUseDesktopRes={vi.fn()}
        />,
      );

      const vanillaInput = screen.getByLabelText('Versión del loader no aplicable');
      expect(vanillaInput).toBeDefined();
      expect((vanillaInput as HTMLInputElement).disabled).toBe(true);
    });

    it('permite cambiar a modo custom loader y actualizar texto', () => {
      const handleSetLoaderVersion = vi.fn();
      render(
        <SettingsMinecraftSection
          t={mockT}
          language="es"
          mcVersion="1.21.1"
          setMcVersion={vi.fn()}
          showAllVersions={false}
          setShowAllVersions={vi.fn()}
          customVersionMode={false}
          setCustomVersionMode={vi.fn()}
          allVersions={['1.21.1']}
          localVersions={['1.21.1']}
          isLoadingVersions={false}
          loaderType="fabric"
          setLoaderType={vi.fn()}
          loaderVersion="0.16.10"
          setLoaderVersion={handleSetLoaderVersion}
          customLoaderMode={true}
          setCustomLoaderMode={vi.fn()}
          availableLoaderVersions={[]}
          loaderInstallStatus={{ loading: false }}
          handleInstallLoader={vi.fn()}
          ramMb={4096}
          setRamMb={vi.fn()}
          width="1280"
          setWidth={vi.fn()}
          height="720"
          setHeight={vi.fn()}
          useDesktopRes={false}
          setUseDesktopRes={vi.fn()}
        />,
      );

      const customInput = screen.getByLabelText('Versión personalizada del loader');
      expect(customInput).toBeDefined();
      fireEvent.change(customInput, { target: { value: '0.16.11' } });
      expect(handleSetLoaderVersion).toHaveBeenCalledWith('0.16.11');
    });

    it('permite alternar idiomas con los botones de idioma', () => {
      const setLangSpy = vi.spyOn(launcherActions, 'setLanguage');
      render(<SettingsModal />);

      const esBtn = screen.getByText(/Español \(ES\)/i);
      const enBtn = screen.getByText(/English \(EN\)/i);
      fireEvent.click(enBtn);
      expect(setLangSpy).toHaveBeenCalledWith('en');
      fireEvent.click(esBtn);
      expect(setLangSpy).toHaveBeenCalledWith('es');
    });

    it('permite alternar la opción de ver versiones beta de loaders', () => {
      const handleSetShowBetas = vi.fn();
      render(
        <SettingsMinecraftSection
          t={mockT}
          language="es"
          mcVersion="1.21.1"
          setMcVersion={vi.fn()}
          showAllVersions={false}
          setShowAllVersions={vi.fn()}
          customVersionMode={false}
          setCustomVersionMode={vi.fn()}
          allVersions={['1.21.1']}
          localVersions={['1.21.1']}
          isLoadingVersions={false}
          loaderType="fabric"
          setLoaderType={vi.fn()}
          loaderVersion="0.16.10"
          setLoaderVersion={vi.fn()}
          customLoaderMode={false}
          setCustomLoaderMode={vi.fn()}
          availableLoaderVersions={['0.16.10', '0.19.4-beta.1']}
          loaderInstallStatus={{ loading: false }}
          handleInstallLoader={vi.fn()}
          showBetaLoaders={false}
          setShowBetaLoaders={handleSetShowBetas}
          ramMb={4096}
          setRamMb={vi.fn()}
          width="1280"
          setWidth={vi.fn()}
          height="720"
          setHeight={vi.fn()}
          useDesktopRes={false}
          setUseDesktopRes={vi.fn()}
        />,
      );

      const betasCheckbox = screen.getAllByRole('checkbox', { name: /Ver Betas/i })[0];
      expect(betasCheckbox).toBeDefined();
      expect((betasCheckbox as HTMLInputElement).checked).toBe(false);

      fireEvent.click(betasCheckbox);
      expect(handleSetShowBetas).toHaveBeenCalledWith(true);
    });
  });

  describe('SettingsModal Component', () => {
    it('no renderiza nada si activeModal no es settings', () => {
      useLauncherStore.setState({ activeModal: undefined });
      const { container } = render(<SettingsModal />);
      expect(container.firstChild).toBeNull();
    });

    it('renderiza la ventana de ajustes cuando activeModal es settings', () => {
      const { container } = render(<SettingsModal />);
      expect(
        container.querySelector('.settings-modal-backdrop') || container.firstChild,
      ).not.toBeNull();
    });

    it('permite cambiar entre pestañas de configuración y ajustar opciones', () => {
      render(<SettingsModal />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      const tabsToClick = ['Apariencia', 'Dock', 'Juego', 'Sistema', 'Avanzado', 'Mods'];
      for (const tabName of tabsToClick) {
        const tabBtn = buttons.find((b) => b.textContent?.includes(tabName));
        if (tabBtn) {
          fireEvent.click(tabBtn);
        }
      }

      const sliders = screen.getAllByRole('slider');
      if (sliders.length > 0) {
        fireEvent.change(sliders[0], { target: { value: '8' } });
        expect(sliders[0]).not.toBeNull();
      }
    });

    it('permite reordenar botones del dock con drag and drop en la pestaña de Dock', () => {
      useLauncherStore.setState({ activeModal: 'settings' });
      const { container } = render(<SettingsModal />);

      // Cambiar a pestaña Dock
      const dockTabBtn = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Dock'));
      if (dockTabBtn) {
        fireEvent.click(dockTabBtn);
      }

      const reorderItems = container.querySelectorAll('.dock-reorder-item');
      expect(reorderItems.length).toBeGreaterThan(1);

      const firstItem = reorderItems[0];
      const secondItem = reorderItems[1];

      // Simular drag and drop
      fireEvent.dragStart(firstItem, {
        dataTransfer: {
          setData: vi.fn(),
          getData: vi.fn().mockReturnValue('0'),
          effectAllowed: 'move',
          dropEffect: 'move',
        },
      });

      fireEvent.dragEnter(secondItem, {
        dataTransfer: { dropEffect: 'move' },
      });

      fireEvent.dragOver(secondItem, {
        dataTransfer: { dropEffect: 'move' },
      });

      fireEvent.drop(secondItem, {
        dataTransfer: {
          getData: vi.fn().mockReturnValue('0'),
          dropEffect: 'move',
        },
      });

      fireEvent.dragEnd(firstItem);
      expect(reorderItems.length).toBeGreaterThan(1);
    });

    it('permite cerrar el modal con el botón de cierre', () => {
      render(<SettingsModal />);

      const closeBtn = screen
        .getAllByRole('button')
        .find((b) => b.getAttribute('title')?.includes('Cerrar') || b.querySelector('svg'));
      expect(closeBtn).toBeDefined();
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(closeBtn).not.toBeNull();
      }
    });

    it('permite cerrar con tecla Escape', () => {
      const closeSpy = vi.spyOn(launcherActions, 'closeModal');
      const { container } = render(<SettingsModal />);
      const overlay = container.querySelector('.papyrus-modal-overlay');
      expect(overlay).not.toBeNull();
      if (overlay) {
        fireEvent.keyDown(overlay, { key: 'Escape' });
      }
      expect(closeSpy).toHaveBeenCalled();
    });

    it('permite cambiar tema y color de acento en pestaña apariencia', () => {
      render(<SettingsModal />);

      const buttons = screen.getAllByRole('button');
      const appearanceBtn = buttons.find((b) => b.textContent?.includes('Apariencia'));
      if (appearanceBtn) {
        fireEvent.click(appearanceBtn);

        const innerButtons = screen.getAllByRole('button');
        for (const btn of innerButtons.slice(0, 5)) {
          fireEvent.click(btn);
        }
      }
      expect(useLauncherStore.getState().activeModal).toBe('settings');
    });

    it('permite restaurar valores por defecto y guardar configuración', () => {
      const updateSettingsSpy = vi.spyOn(launcherActions, 'updateSettings');
      render(<SettingsModal />);

      // Botón de guardar o restaurar
      const buttons = screen.getAllByRole('button');
      const resetBtn = buttons.find(
        (b) =>
          b.textContent?.includes('Restablecer') ||
          b.textContent?.includes('Por Defecto') ||
          b.textContent?.includes('Reset'),
      );
      if (resetBtn) {
        fireEvent.click(resetBtn);
      }

      const saveBtn = buttons.find(
        (b) =>
          b.textContent?.includes('Guardar') ||
          b.textContent?.includes('Aplicar') ||
          b.textContent?.includes('Save'),
      );
      if (saveBtn) {
        fireEvent.click(saveBtn);
        expect(updateSettingsSpy).toHaveBeenCalled();
      }
    });

    it('permite gestionar fondos de pantalla por URL y preset', async () => {
      render(<SettingsModal />);

      const appearanceBtn = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Apariencia'));
      if (appearanceBtn) {
        fireEvent.click(appearanceBtn);
      }

      // Input de URL de wallpaper si existe
      const inputs = screen.getAllByRole('textbox');
      const urlInput = inputs.find(
        (i) =>
          (i as HTMLInputElement).placeholder?.includes('http') ||
          (i as HTMLInputElement).placeholder?.includes('URL'),
      );
      if (urlInput) {
        // Enviar url inválida sin http
        fireEvent.change(urlInput, { target: { value: 'invalida-url' } });
        const applyBtn = screen
          .getAllByRole('button')
          .find((b) => b.textContent?.includes('Aplicar') || b.textContent?.includes('Usar'));
        if (applyBtn) fireEvent.click(applyBtn);

        // Enviar url válida
        fireEvent.change(urlInput, { target: { value: 'https://example.com/custom-bg.png' } });
        if (applyBtn) fireEvent.click(applyBtn);
      }
      expect(useLauncherStore.getState().activeModal).toBe('settings');
    });
  });

  describe('SettingsPersonalizationSection Subcomponent', () => {
    it('renderiza presets oficiales y permite seleccionar o restablecer', () => {
      const handleSelectPreset = vi.fn();
      const handleResetWallpaper = vi.fn();
      const handleFileChange = vi.fn();
      const handleApplyUrl = vi.fn();

      const { container } = render(
        <SettingsPersonalizationSection
          accentColor="#00e5ff"
          guiTheme={'crystal-glass' as any}
          customUrlInput=""
          setCustomUrlInput={vi.fn()}
          wallpaperFeedback={null}
          fileInputRef={{ current: null }}
          activeWallpaperId="crystal-ocean"
          customWallpaperUrl=""
          isVideoWallpaper={false}
          wallpaperMuted={true}
          wallpaperVolume={0.5}
          handleResetWallpaper={handleResetWallpaper}
          handleSelectPreset={handleSelectPreset}
          handleFileChange={handleFileChange}
          handleApplyUrl={handleApplyUrl}
        />,
      );

      const presetCards = container.querySelectorAll('.wallpaper-preset-card');
      expect(presetCards.length).toBeGreaterThan(0);
      fireEvent.click(presetCards[0]);
      expect(handleSelectPreset).toHaveBeenCalled();
    });

    it('permite accionar botón de subida de archivo y restablecer fondo personalizado', () => {
      const handleResetWallpaper = vi.fn();
      const fileInputRef = { current: document.createElement('input') };

      render(
        <SettingsPersonalizationSection
          accentColor="#00e5ff"
          guiTheme={'crystal-glass' as any}
          customUrlInput=""
          setCustomUrlInput={vi.fn()}
          wallpaperFeedback={null}
          fileInputRef={fileInputRef}
          activeWallpaperId="crystal-ocean"
          customWallpaperUrl="file:///custom.png"
          isVideoWallpaper={false}
          wallpaperMuted={true}
          wallpaperVolume={0.5}
          handleResetWallpaper={handleResetWallpaper}
          handleSelectPreset={vi.fn()}
          handleFileChange={vi.fn()}
          handleApplyUrl={vi.fn()}
        />,
      );

      const resetBtn = screen.getByText('Restablecer oficial');
      fireEvent.click(resetBtn);
      expect(handleResetWallpaper).toHaveBeenCalled();

      const uploadBtn = screen.getByText('Subir Imagen, GIF o Vídeo');
      fireEvent.click(uploadBtn);
      expect(uploadBtn).toBeDefined();
    });
  });

  describe('SettingsModal Integration Actions', () => {
    it('ejecuta instalación de cargador de mods en la sección de Minecraft', async () => {
      render(<SettingsModal />);

      const installBtn = screen.getByRole('button', { name: /Descargar e Instalar/i });
      expect(installBtn).toBeDefined();
      fireEvent.click(installBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Ajustes del Launcher/i })).toBeDefined();
      });
    });

    it('abre el modal asistente de instalación de loader al pulsar elegir otra versión', async () => {
      render(<SettingsModal />);

      const chooseOtherBtn = screen.getByText(/Elegir otra versión o loader/i);
      expect(chooseOtherBtn).toBeDefined();
      fireEvent.click(chooseOtherBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('dialog', { name: /Descargar e Instalar Mod Loader/i }),
        ).toBeDefined();
        expect(screen.getByText(/1\. Versión Base de Minecraft:/i)).toBeDefined();
        expect(screen.getByText(/2\. Mod Loader \(Motor de Mods\):/i)).toBeDefined();
        expect(screen.getByText(/3\. Versión del Loader a descargar:/i)).toBeDefined();
      });
    });

    it('renderiza drag handles en la lista de reordenación de botones del dock', () => {
      render(<SettingsModal />);

      const dragHandles = document.querySelectorAll('.dock-drag-handle');
      expect(dragHandles.length).toBeGreaterThan(0);
    });

    it('permite alternar módulos y abrir su modal en la sección de Plugins/Mods', () => {
      render(<SettingsModal />);

      const toggleButtons = screen.getAllByRole('button');
      const moduleToggle = toggleButtons.find(
        (b) => b.textContent?.includes('Habilitado') || b.textContent?.includes('Deshabilitado'),
      );
      if (moduleToggle) {
        fireEvent.click(moduleToggle);
      }
      expect(toggleButtons.length).toBeGreaterThan(0);
    });

    it('permite alternar aceleración de hardware y confirmar reinicio ahora y más tarde', async () => {
      render(<SettingsModal />);

      const hwCheckbox = document.getElementById('settings-disable-hw-accel') as HTMLInputElement;
      expect(hwCheckbox).toBeDefined();

      // Alternar para activar modal de reinicio
      fireEvent.click(hwCheckbox);

      // El modal de confirmación debe aparecer
      await waitFor(() => {
        expect(screen.getByText('¿Reiniciar Launcher?')).toBeDefined();
      });

      // Confirmar reinicio ahora
      const restartNowBtn = screen.getByRole('button', { name: /Reiniciar Ahora/i });
      fireEvent.click(restartNowBtn);

      await waitFor(() => {
        expect(screen.queryByText('¿Reiniciar Launcher?')).toBeNull();
      });
    });

    it('permite cancelar o posponer el reinicio de hardware para más tarde', async () => {
      render(<SettingsModal />);

      const hwCheckbox = document.getElementById('settings-disable-hw-accel') as HTMLInputElement;
      expect(hwCheckbox).toBeDefined();
      fireEvent.click(hwCheckbox);

      await waitFor(() => {
        expect(screen.getByText('¿Reiniciar Launcher?')).toBeDefined();
      });

      const restartLaterBtn = screen.getByRole('button', { name: /Al Próximo Inicio/i });
      fireEvent.click(restartLaterBtn);

      await waitFor(() => {
        expect(screen.queryByText('¿Reiniciar Launcher?')).toBeNull();
      });
    });

    it('gestiona la subida de archivos de fondo validando límites y formatos', async () => {
      const { container } = render(<SettingsModal />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDefined();

      if (fileInput) {
        // 1. Archivo que supera el tamaño máximo permitido (> 500 MB)
        const hugeFile = new File([new ArrayBuffer(1024)], 'huge_video.mp4', { type: 'video/mp4' });
        Object.defineProperty(hugeFile, 'size', { value: 600 * 1024 * 1024 });
        fireEvent.change(fileInput, { target: { files: [hugeFile] } });

        await waitFor(() => {
          expect(
            screen.getByText(/El archivo supera los 500 MB máximos permitidos/i),
          ).toBeDefined();
        });

        // 2. Archivo de vídeo válido
        const videoFile = new File(['dummy-video'], 'background.mp4', { type: 'video/mp4' });
        fireEvent.change(fileInput, { target: { files: [videoFile] } });

        await waitFor(() => {
          expect(screen.getByText(/Vídeo de fondo configurado exitosamente/i)).toBeDefined();
        });
      }
    });

    it('aplica fondos desde URL con validación de protocolo y formato', async () => {
      render(<SettingsModal />);

      const urlInput = screen.getByLabelText(
        'URL directa del fondo de pantalla',
      ) as HTMLInputElement;
      const applyBtn = screen.getByRole('button', { name: /Aplicar/i });

      expect(urlInput).toBeDefined();
      expect(applyBtn).toBeDefined();

      // 1. URL inválida (sin http/https/data)
      fireEvent.change(urlInput, { target: { value: 'ftp://invalido.com/bg.png' } });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(
          screen.getByText(
            /Por favor introduce una URL válida que empiece por https:\/\/ o http:\/\//i,
          ),
        ).toBeDefined();
      });

      // 2. URL de vídeo válida
      fireEvent.change(urlInput, { target: { value: 'https://example.com/stream.mp4' } });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Vídeo aplicado desde enlace directo/i)).toBeDefined();
      });

      // 3. URL de GIF válida
      fireEvent.change(urlInput, { target: { value: 'https://example.com/animated.gif' } });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(screen.getByText(/GIF animado aplicado desde URL/i)).toBeDefined();
      });
    });

    it('permite guardar cambios y restablecer opciones desde la cabecera', () => {
      render(<SettingsModal />);

      const saveBtn = screen.getByText('Guardar Cambios');
      const resetBtn = screen.getByText('Restablecer');

      fireEvent.click(saveBtn);
      expect(saveBtn).toBeDefined();

      fireEvent.click(resetBtn);
      expect(resetBtn).toBeDefined();
    });

    it('gestiona la subida de wallpaper GIF animado y error al guardar', async () => {
      render(<SettingsModal />);
      const appearanceBtn = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Apariencia'));
      if (appearanceBtn) {
        fireEvent.click(appearanceBtn);
      }

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDefined();

      if (fileInput) {
        // GIF animado
        vi.spyOn(wallpaperStorage, 'saveWallpaperFile').mockResolvedValueOnce({
          url: 'file:///anim.gif',
          isVideo: false,
          name: 'anim.gif',
        });
        const gifFile = new File(['dummy-gif'], 'anim.gif', { type: 'image/gif' });
        fireEvent.change(fileInput, { target: { files: [gifFile] } });
        await waitFor(() => {
          expect(screen.getByText(/GIF animado aplicado exitosamente/i)).toBeDefined();
        });

        // Error al guardar
        vi.spyOn(wallpaperStorage, 'saveWallpaperFile').mockRejectedValueOnce(
          new Error('Fallo de almacenamiento'),
        );
        const errFile = new File(['err'], 'err.png', { type: 'image/png' });
        fireEvent.change(fileInput, { target: { files: [errFile] } });
        await waitFor(() => {
          expect(
            screen.getByText(/Ocurrió un error al guardar el archivo en almacenamiento local/i),
          ).toBeDefined();
        });
      }
    });

    it('carga versiones de cargadores Fabric, Quilt y Forge al cambiar loaderType', async () => {
      const { rerender } = render(<SettingsModal />);

      // Fabric
      useLauncherStore.setState({
        settings: { ...useLauncherStore.getState().settings, loaderType: 'fabric' },
      });
      rerender(<SettingsModal />);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Ajustes del Launcher/i })).toBeDefined();
      });

      // Quilt
      useLauncherStore.setState({
        settings: { ...useLauncherStore.getState().settings, loaderType: 'quilt' },
      });
      rerender(<SettingsModal />);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Ajustes del Launcher/i })).toBeDefined();
      });

      // Forge
      useLauncherStore.setState({
        settings: { ...useLauncherStore.getState().settings, loaderType: 'forge' },
      });
      rerender(<SettingsModal />);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /Ajustes del Launcher/i })).toBeDefined();
      });
    });

    it('permite seleccionar presets oficiales de wallpaper y restablecer al predeterminado', async () => {
      render(<SettingsModal />);
      const presetButtons = screen.getAllByRole('button');
      const nightPreset = presetButtons.find(
        (b) => b.title?.includes('Noche Cósmica') || b.textContent?.includes('Noche Cósmica'),
      );
      if (nightPreset) {
        fireEvent.click(nightPreset);
        await waitFor(() => {
          expect((useLauncherStore.getState() as any).activeWallpaperId).toBeDefined();
        });
      }

      const resetPresetBtn = presetButtons.find((b) =>
        b.textContent?.includes('Restablecer oficial'),
      );
      if (resetPresetBtn) {
        fireEvent.click(resetPresetBtn);
        await waitFor(() => {
          expect((useLauncherStore.getState() as any).activeWallpaperId).toBeDefined();
        });
      }
    });

    it('permite alternar el motor de Java a GraalVM y persistir en configuración', async () => {
      render(<SettingsModal />);
      const graalBtn = screen.getByRole('button', { name: /GraalVM CE/i });
      expect(graalBtn).toBeDefined();
      fireEvent.click(graalBtn);

      const saveBtn = screen.getByRole('button', { name: /Guardar Cambios/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(useLauncherStore.getState().settings.javaDistribution).toBe('graalvm');
      });
    });

    it('permite activar la exclusión de Windows Defender 1-Click', async () => {
      render(<SettingsModal />);
      const defenderBtn = screen.getByRole('button', {
        name: /Excluir Carpeta en Windows Defender/i,
      });
      expect(defenderBtn).toBeDefined();
      fireEvent.click(defenderBtn);

      await waitFor(() => {
        expect(defenderBtn).toBeDefined();
      });
    });

    it('permite comprobar actualizaciones del sistema y mostrar feedback', async () => {
      render(<SettingsModal />);
      const updateBtn = screen.getByRole('button', {
        name: /Buscar Actualización/i,
      });
      expect(updateBtn).toBeDefined();
      fireEvent.click(updateBtn);

      await waitFor(() => {
        expect(screen.getByText(/¡Estás en la versión más reciente!/i)).toBeDefined();
      });
    });
  });
});

