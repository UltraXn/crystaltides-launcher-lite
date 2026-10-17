import React, { useRef, useState } from 'react';
import { Sparkles, Sliders, RotateCcw, X, Palette, Image as ImageIcon } from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  type LauncherState,
  type DockButtonId,
} from '../store/launcherStore';
import { useModuleStore, type LauncherModule } from '../modules';
import { saveButtonMediaFile, clearButtonMedia, isVideoSource } from '../utils/wallpaperStorage';
import {
  DockButtonInspectorBgTab,
  DockButtonInspectorIconTab,
  DockButtonInspectorFxTab,
  DockButtonInspectorShapeTab,
} from './inspector/DockButtonInspectorTabs';

export type InspectorTab = 'bg' | 'icon' | 'fx' | 'shape';

interface DockButtonInspectorProps {
  buttonId: DockButtonId;
  initialTab?: InspectorTab;
  onClose: () => void;
  maxHeight?: number | string;
}

const BUTTON_NAMES: Record<string, string> = {
  instances: 'Instancias',
  about: 'Acerca de',
  accounts: 'Cuentas',
  settings: 'Ajustes',
  launch: 'Lanzar Juego',
};

const resolveButtonDisplayName = (id: DockButtonId, modules: LauncherModule[]): string => {
  if (BUTTON_NAMES[id]) return BUTTON_NAMES[id];
  if (id.startsWith('mod:')) {
    const modId = id.slice(4);
    const mod = modules.find((m) => m.id === modId);
    if (mod?.slots.dockButton?.label) return mod.slots.dockButton.label;
    if (mod?.name) return mod.name;
  }
  return id;
};

const saveUploadedButtonMedia = async (buttonId: DockButtonId, file: File): Promise<void> => {
  const isVideo = file.type.startsWith('video/') || isVideoSource(file.name);
  const res = await saveButtonMediaFile(buttonId, file, false);

  if (isVideo) {
    launcherActions.setDockButtonCustomization(buttonId, {
      bgType: 'video',
      bgVideo: res.url,
      bgImage: undefined,
      bgVideoOpacity: 0.85,
    });
  } else {
    launcherActions.setDockButtonCustomization(buttonId, {
      bgType: 'image',
      bgImage: res.url,
      bgVideo: undefined,
    });
  }
};

interface DockButtonInspectorHeaderProps {
  buttonDisplayName: string;
  uploadStatus: string | null;
  onClose?: () => void;
}

const DockButtonInspectorHeader: React.FC<DockButtonInspectorHeaderProps> = ({
  buttonDisplayName,
  uploadStatus,
  onClose,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '10px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      flexShrink: 0,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '5px',
          padding: '2px 7px',
          fontSize: '9.5px',
          fontWeight: 700,
          color: '#e2e8f0',
          letterSpacing: '0.6px',
        }}
      >
        EDITANDO
      </span>
      <span style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
        {buttonDisplayName}
      </span>
      {uploadStatus && (
        <span
          style={{
            fontSize: '10px',
            color: uploadStatus.includes('Error') ? '#f87171' : '#38bdf8',
            fontWeight: 600,
            marginLeft: '4px',
          }}
        >
          {uploadStatus}
        </span>
      )}
    </div>
    <button
      type="button"
      onClick={onClose}
      aria-label="Cerrar inspector"
      style={{
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <X size={15} />
    </button>
  </div>
);

interface DockButtonInspectorTabBarProps {
  activeTab: InspectorTab;
  setActiveTab: (tab: InspectorTab) => void;
}

const TAB_BUTTONS: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
  { id: 'bg', label: 'Fondo', icon: <Palette size={12} /> },
  { id: 'icon', label: 'Icono', icon: <ImageIcon size={12} /> },
  { id: 'fx', label: 'Efectos', icon: <Sparkles size={12} /> },
  { id: 'shape', label: 'Forma', icon: <Sliders size={12} /> },
];

const DockButtonInspectorTabBar: React.FC<DockButtonInspectorTabBarProps> = ({ activeTab, setActiveTab }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      background: 'rgba(0, 0, 0, 0.4)',
      borderRadius: '10px',
      padding: '3px',
      marginBottom: '10px',
      flexShrink: 0,
      border: '1px solid rgba(255, 255, 255, 0.06)',
    }}
  >
    {TAB_BUTTONS.map((t) => {
      const isActive = activeTab === t.id;
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => setActiveTab(t.id)}
          style={{
            background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            border: isActive ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
            color: isActive ? '#ffffff' : '#94a3b8',
            borderRadius: '8px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.15s ease',
          }}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      );
    })}
  </div>
);

export const DockButtonInspector: React.FC<DockButtonInspectorProps> = ({
  buttonId,
  initialTab = 'bg',
  onClose,
  maxHeight,
}) => {
  const [activeTab, setActiveTab] = useState<'bg' | 'icon' | 'fx' | 'shape'>(initialTab);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const dockBgInputRef = useRef<HTMLInputElement>(null);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const customization = dockConfig.buttonCustomizations?.[buttonId] || {};
  const modules = useModuleStore((s) => s.modules);

  const hasDockPanorama =
    (dockConfig.dockBgType === 'image' && Boolean(dockConfig.dockBgImage)) ||
    (dockConfig.dockBgType === 'video' && Boolean(dockConfig.dockBgVideo));
  const isParticipant =
    hasDockPanorama &&
    (!dockConfig.panoramaButtons || dockConfig.panoramaButtons.includes(buttonId));

  const buttonDisplayName = resolveButtonDisplayName(buttonId, modules);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus('Cargando...');
      await saveUploadedButtonMedia(buttonId, file);
      setUploadStatus('¡Guardado!');
      setTimeout(() => setUploadStatus(null), 2000);
    } catch (err) {
      console.error('Error saving local media:', err);
      setUploadStatus('Error al cargar');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus('Cargando icono...');
      const res = await saveButtonMediaFile(buttonId, file, true);
      launcherActions.setDockButtonCustomization(buttonId, {
        iconType: 'custom_image',
        customIconUrl: res.url,
      });
      setUploadStatus('¡Icono guardado!');
      setTimeout(() => setUploadStatus(null), 2000);
    } catch (err) {
      console.error('Error saving local icon:', err);
      setUploadStatus('Error');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleResetCustomization = async () => {
    await clearButtonMedia(buttonId, false);
    await clearButtonMedia(buttonId, true);
    launcherActions.resetDockButtonCustomization(buttonId);
  };

  return (
    <dialog
      ref={dialogRef}
      open
      data-inspector="true"
      aria-label="Inspector de Botón"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onScroll={(e) => {
        if (e.currentTarget.scrollTop !== 0) {
          e.currentTarget.scrollTop = 0;
        }
      }}
      style={{
        position: 'relative',
        zIndex: 1000,
        background: 'rgba(15, 18, 26, 0.96)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        padding: '14px 16px',
        margin: 0,
        minWidth: '330px',
        maxWidth: '390px',
        maxHeight: maxHeight ?? 'min(500px, calc(100vh - 120px))',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        color: '#f1f5f9',
        fontSize: '12px',
        userSelect: 'none',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Hidden file pickers for direct PC uploading */}
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*,video/*,.gif,.mp4,.webm"
        style={{ display: 'none' }}
        onChange={handleMediaUpload}
      />
      <input
        ref={iconFileInputRef}
        type="file"
        accept="image/*,.svg,.png,.webp,.gif"
        style={{ display: 'none' }}
        onChange={handleIconUpload}
      />

      <DockButtonInspectorHeader
        buttonDisplayName={buttonDisplayName}
        uploadStatus={uploadStatus}
        onClose={onClose}
      />

      <DockButtonInspectorTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Scrollable Tab Content Body */}
      <div
        className="hud-custom-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          overscrollBehaviorY: 'contain',
          paddingRight: '3px',
          paddingBottom: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {activeTab === 'bg' && (
          <DockButtonInspectorBgTab
            buttonId={buttonId}
            customization={customization}
            dockConfig={dockConfig}
            hasDockPanorama={hasDockPanorama}
            isParticipant={isParticipant}
            bgFileInputRef={bgFileInputRef}
            dockBgInputRef={dockBgInputRef}
            setUploadStatus={setUploadStatus}
          />
        )}

        {activeTab === 'icon' && (
          <DockButtonInspectorIconTab
            buttonId={buttonId}
            customization={customization}
            iconFileInputRef={iconFileInputRef}
          />
        )}

        {activeTab === 'fx' && (
          <DockButtonInspectorFxTab buttonId={buttonId} customization={customization} />
        )}

        {activeTab === 'shape' && (
          <div>
            <DockButtonInspectorShapeTab
              buttonId={buttonId}
              dockConfig={dockConfig}
              customization={customization}
            />
            <button
              type="button"
              onClick={handleResetCustomization}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '7px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '10px',
                width: '100%',
                flexShrink: 0,
              }}
            >
              <RotateCcw size={12} />
              <span>Restablecer Botón a Fábrica</span>
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
};
