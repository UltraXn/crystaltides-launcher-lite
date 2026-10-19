import React, { useState, useRef } from 'react';
import {
  Layout,
  RotateCcw,
  Move,
  Minus,
  ArrowDownToLine,
  ArrowUpToLine,
  Sparkles,
  CheckCircle2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  Layers,
  Info,
  User,
  Settings as SettingsIcon,
  Rocket,
} from 'lucide-react';
import {
  DockConfig,
  DockButtonId,
  PROTECTED_DOCK_BUTTONS,
  launcherActions,
  useT,
} from '../../../store/launcherStore';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { isNearOpacity, resolveActiveBtnColor } from '../../../utils/settingsUtils';

export interface SettingsDockSectionProps {
  dockConfig: DockConfig;
  accentColor: string;
  t: ReturnType<typeof useT>;
}

interface DockPositionPresetsProps {
  positionPreset: DockConfig['positionPreset'];
  customCoordinates?: { x: number; y: number };
  accentColor: string;
  t: ReturnType<typeof useT>;
}

const DockPositionPresets: React.FC<DockPositionPresetsProps> = ({
  positionPreset,
  customCoordinates,
  accentColor,
  t,
}) => {
  return (
    <div style={{ marginBottom: '14px' }}>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#e2e8f0',
          display: 'block',
          marginBottom: '6px',
        }}
      >
        {t.settings.dockPositionTitle}
      </span>
      <div className="dock-preset-group">
        <button
          type="button"
          onClick={() =>
            launcherActions.setDockConfig({
              positionPreset: 'center',
              customCoordinates: undefined,
            })
          }
          className={`dock-preset-pill ${positionPreset === 'center' ? 'active' : ''}`}
        >
          <Minus size={13} />
          <span>{t.settings.posCenter}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            launcherActions.setDockConfig({
              positionPreset: 'bottom',
              customCoordinates: undefined,
            })
          }
          className={`dock-preset-pill ${positionPreset === 'bottom' ? 'active' : ''}`}
        >
          <ArrowDownToLine size={13} />
          <span>{t.settings.posBottom}</span>
        </button>

        <button
          type="button"
          onClick={() =>
            launcherActions.setDockConfig({
              positionPreset: 'top',
              customCoordinates: undefined,
            })
          }
          className={`dock-preset-pill ${positionPreset === 'top' ? 'active' : ''}`}
        >
          <ArrowUpToLine size={13} />
          <span>{t.settings.posTop}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (positionPreset !== 'free') {
              launcherActions.setDockConfig({
                positionPreset: 'free',
                customCoordinates: { x: 50, y: 50 },
              });
            }
          }}
          className={`dock-preset-pill ${positionPreset === 'free' ? 'active' : ''}`}
        >
          <Move size={13} />
          <span>
            {t.settings.posFree}{' '}
            {positionPreset === 'free' && customCoordinates
              ? `(${customCoordinates.x}%, ${customCoordinates.y}%)`
              : t.settings.posDraggable}
          </span>
        </button>
      </div>
      {positionPreset === 'free' && (
        <p style={{ fontSize: '10.5px', color: accentColor, margin: '6px 0 0 0' }}>
          {t.settings.posFreeTip}
        </p>
      )}
    </div>
  );
};

interface DockStartBtnColorSelectorProps {
  startBtnColorMode: DockConfig['startBtnColorMode'];
  customStartBtnColor?: string;
  accentColor: string;
  t: ReturnType<typeof useT>;
}

const DockStartBtnColorSelector: React.FC<DockStartBtnColorSelectorProps> = ({
  startBtnColorMode,
  customStartBtnColor,
  accentColor,
  t,
}) => {
  return (
    <div style={{ marginBottom: '14px' }}>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#e2e8f0',
          display: 'block',
          marginBottom: '6px',
        }}
      >
        {t.settings.startBtnColorTitle}
      </span>
      <div className="dock-preset-group">
        <button
          type="button"
          onClick={() => launcherActions.setDockConfig({ startBtnColorMode: 'accent' })}
          className={`dock-preset-pill ${startBtnColorMode === 'accent' ? 'active' : ''}`}
        >
          <Sparkles size={13} style={{ color: accentColor }} />
          <span>
            {t.settings.syncWithAccent} ({accentColor.toUpperCase()})
          </span>
        </button>

        <button
          type="button"
          onClick={() => launcherActions.setDockConfig({ startBtnColorMode: 'emerald' })}
          className={`dock-preset-pill ${startBtnColorMode === 'emerald' ? 'active' : ''}`}
        >
          <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
          <span>{t.settings.emeraldGreen}</span>
        </button>

        <CustomColorPicker
          color={customStartBtnColor ?? '#22c55e'}
          onChange={(hex) =>
            launcherActions.setDockConfig({
              startBtnColorMode: 'custom',
              customStartBtnColor: hex,
            })
          }
          label={t.settings.customColor}
        />
      </div>
    </div>
  );
};

interface DockStyleDimensionsGroupProps {
  scale: DockConfig['scale'];
  showLabels: boolean;
  bgOpacity: number;
  dockBorderColorMode: DockConfig['dockBorderColorMode'];
  t: ReturnType<typeof useT>;
}

const DockStyleDimensionsGroup: React.FC<DockStyleDimensionsGroupProps> = ({
  scale,
  showLabels,
  bgOpacity,
  dockBorderColorMode,
  t,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '14px',
      }}
    >
      {/* Escala */}
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          {t.settings.dockScaleTitle}
        </span>
        <div className="dock-preset-group" style={{ margin: 0 }}>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ scale: 'normal' })}
            className={`dock-preset-pill ${scale === 'normal' ? 'active' : ''}`}
          >
            {t.settings.dockScaleNormal}
          </button>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ scale: 'compact' })}
            className={`dock-preset-pill ${scale === 'compact' ? 'active' : ''}`}
          >
            {t.settings.dockScaleCompact}
          </button>
        </div>
      </div>

      {/* Etiquetas */}
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          {t.settings.textLabelsTitle}
        </span>
        <div className="dock-preset-group" style={{ margin: 0 }}>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ showLabels: true })}
            className={`dock-preset-pill ${showLabels ? 'active' : ''}`}
          >
            {t.settings.iconsAndText}
          </button>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ showLabels: false })}
            className={`dock-preset-pill ${!showLabels ? 'active' : ''}`}
          >
            {t.settings.iconsOnly}
          </button>
        </div>
      </div>

      {/* Transparencia / Cristal */}
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          {t.settings.bgGlassTitle}
        </span>
        <div className="dock-preset-group" style={{ margin: 0 }}>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.92 })}
            className={`dock-preset-pill ${isNearOpacity(bgOpacity, 0.92) ? 'active' : ''}`}
          >
            {t.settings.glassSolid}
          </button>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.7 })}
            className={`dock-preset-pill ${isNearOpacity(bgOpacity, 0.7) ? 'active' : ''}`}
          >
            {t.settings.glassMedium}
          </button>
          <button
            type="button"
            onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.45 })}
            className={`dock-preset-pill ${isNearOpacity(bgOpacity, 0.45) ? 'active' : ''}`}
          >
            {t.settings.glassTranslucent}
          </button>
        </div>
      </div>

      {/* Borde */}
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          {t.settings.dockBordersTitle}
        </span>
        <div className="dock-preset-group" style={{ margin: 0 }}>
          <button
            type="button"
            onClick={() =>
              launcherActions.setDockConfig({ dockBorderColorMode: 'subtle' })
            }
            className={`dock-preset-pill ${dockBorderColorMode === 'subtle' ? 'active' : ''}`}
          >
            {t.settings.borderSubtleNeutral}
          </button>
          <button
            type="button"
            onClick={() =>
              launcherActions.setDockConfig({ dockBorderColorMode: 'accent' })
            }
            className={`dock-preset-pill ${dockBorderColorMode === 'accent' ? 'active' : ''}`}
          >
            {t.settings.borderAccentGlow}
          </button>
        </div>
      </div>
    </div>
  );
};

interface SettingsDockButtonRowProps {
  btnId: DockButtonId;
  index: number;
  totalButtons: number;
  isVisible: boolean;
  itemInfo: { name: string; icon: React.ReactNode };
  activeBtnColor: string;
  isCustomColor: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  hasCustomization: boolean;
  onDragStart: (e: React.DragEvent<HTMLElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLElement>, index: number) => void;
  onDragLeave: (index: number) => void;
  onDrop: (e: React.DragEvent<HTMLElement>, index: number) => void;
  onDragEnd: () => void;
  t: ReturnType<typeof useT>;
}

const SettingsDockButtonRow: React.FC<SettingsDockButtonRowProps> = ({
  btnId,
  index,
  totalButtons,
  isVisible,
  itemInfo,
  activeBtnColor,
  isCustomColor,
  isDragging,
  isDragOver,
  hasCustomization,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  t,
}) => {
  return (
    <li
      aria-label={itemInfo.name}
      draggable={true}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={() => onDragLeave(index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`dock-reorder-item ${!isVisible ? 'disabled' : ''} ${
        isDragging ? 'dragging' : ''
      } ${isDragOver ? 'drag-over' : ''}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          className="dock-drag-handle"
          title={t.settings.dragToReorder}
          aria-label={t.settings.dragToReorder}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            cursor: 'grab',
          }}
        >
          <GripVertical size={13} style={{ color: 'rgba(248, 250, 252, 0.4)' }} />
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: activeBtnColor,
              boxShadow: `0 0 5px ${activeBtnColor}`,
              flexShrink: 0,
            }}
          />
        </div>
        {itemInfo.icon}
        <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#f8fafc' }}>
          {itemInfo.name}
        </span>
      </div>

      <div
        className="dock-reorder-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        {/* Advanced Customizer */}
        <button
          type="button"
          onClick={() => launcherActions.openButtonCustomizer(btnId)}
          className={`dock-action-customize-btn ${hasCustomization ? 'has-customization' : ''}`}
          title={t.settings.customizeBtnTitle}
        >
          <Sparkles size={12} />
          <span>{t.settings.customizeBtn}</span>
        </button>

        {/* Individual Color Picker */}
        <CustomColorPicker
          color={activeBtnColor}
          onChange={(hex) => launcherActions.setButtonColor(btnId, hex)}
          label={t.settings.paintBtn}
          compact={true}
          alignRight={true}
        />

        {isCustomColor && (
          <button
            type="button"
            onClick={() => launcherActions.setButtonColor(btnId, null)}
            className="dock-action-icon-btn"
            title={t.settings.resetThemeColor}
            style={{ color: '#94a3b8' }}
          >
            <RotateCcw size={12} />
          </button>
        )}

        {/* Move Left / Up */}
        <button
          type="button"
          onClick={() => launcherActions.moveDockButton(btnId, 'left')}
          disabled={index === 0}
          className="dock-action-icon-btn"
          title={t.settings.moveLeft}
        >
          <ChevronUp size={14} />
        </button>

        {/* Move Right / Down */}
        <button
          type="button"
          onClick={() => launcherActions.moveDockButton(btnId, 'right')}
          disabled={index === totalButtons - 1}
          className="dock-action-icon-btn"
          title={t.settings.moveRight}
        >
          <ChevronDown size={14} />
        </button>

        {/* Toggle Visibility */}
        {PROTECTED_DOCK_BUTTONS.includes(btnId) ? (
          <span
            className="dock-action-icon-btn protected-btn"
            title={t.settings.protectedButton}
          >
            <Lock size={12} color="#94a3b8" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => launcherActions.toggleDockButton(btnId)}
            className={`dock-action-icon-btn ${isVisible ? 'active-eye' : ''}`}
            title={isVisible ? t.settings.hideButton : t.settings.showButton}
          >
            {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
      </div>
    </li>
  );
};

export const SettingsDockSection: React.FC<SettingsDockSectionProps> = ({
  dockConfig,
  accentColor,
  t,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);

  const buttonLabels: Record<DockButtonId, { name: string; icon: React.ReactNode }> = {
    instances: {
      name: t.dock.instances,
      icon: <Layers size={14} color="#16A085" />,
    },
    about: {
      name: t.dock.about,
      icon: <Info size={14} color="#94a3b8" />,
    },
    accounts: {
      name: t.dock.accounts,
      icon: <User size={14} color="#a855f7" />,
    },
    settings: {
      name: t.dock.settings,
      icon: <SettingsIcon size={14} color="#cbd5e1" />,
    },
    launch: {
      name: t.dock.launch,
      icon: <Rocket size={14} color="#22c55e" />,
    },
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      e.preventDefault();
      return;
    }
    dragSourceIndexRef.current = index;
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch {}
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    let fromIndex = -1;
    try {
      const data = e.dataTransfer.getData('text/plain');
      if (data) fromIndex = parseInt(data, 10);
    } catch {}
    if (fromIndex === -1 || Number.isNaN(fromIndex)) {
      fromIndex = dragSourceIndexRef.current ?? (draggedIndex ?? -1);
    }
    if (fromIndex !== -1 && fromIndex !== index) {
      const newOrder = [...dockConfig.buttonOrder];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(index, 0, movedItem);
      launcherActions.reorderDockButtons(newOrder);
    }
    dragSourceIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragSourceIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const visibleButtonsSet = new Set(dockConfig.visibleButtons);

  return (
    <div
      className="settings-section"
      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px' }}
    >
      <div className="settings-section-header">
        <span
          className="settings-label-title"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Layout size={14} style={{ color: accentColor }} />
          {t.settings.dockCustomizationTitle}
        </span>
        <button
          type="button"
          onClick={() => launcherActions.resetDockConfig()}
          className="wallpaper-reset-btn"
          title={t.settings.resetDock}
        >
          <RotateCcw size={12} />
          {t.settings.resetDock}
        </button>
      </div>
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(248, 250, 252, 0.5)',
          margin: '2px 0 10px 0',
        }}
      >
        {t.settings.dockBannerDesc}
      </p>

      {/* Banner Destacado: Entrar al Modo Edición Visual */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background:
            'linear-gradient(135deg, rgba(20, 37, 62, 0.85) 0%, rgba(21, 61, 76, 0.6) 100%)',
          border: '1px solid rgba(22, 160, 133, 0.45)',
          boxShadow:
            '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(22, 160, 133, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '2px',
            }}
          >
            <Move size={15} style={{ color: '#16A085' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              {t.settings.dockBannerTitle}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.65)' }}>
            {t.settings.dockBannerDesc}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            launcherActions.closeModal();
            launcherActions.setEditingHud(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #156F69 0%, #16A085 100%)',
            border: '1px solid rgba(22, 160, 133, 0.6)',
            color: '#ffffff',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(22, 160, 133, 0.35)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Move size={13} />
          <span>{t.settings.enterEditModeBtn}</span>
        </button>
      </div>

      {/* 1. Posición en Pantalla */}
      <DockPositionPresets
        positionPreset={dockConfig.positionPreset}
        customCoordinates={dockConfig.customCoordinates}
        accentColor={accentColor}
        t={t}
      />

      {/* 2. Color del Botón Iniciar Juego */}
      <DockStartBtnColorSelector
        startBtnColorMode={dockConfig.startBtnColorMode}
        customStartBtnColor={dockConfig.customStartBtnColor}
        accentColor={accentColor}
        t={t}
      />

      {/* 3. Estilo y Dimensiones */}
      <DockStyleDimensionsGroup
        scale={dockConfig.scale}
        showLabels={dockConfig.showLabels}
        bgOpacity={dockConfig.bgOpacity}
        dockBorderColorMode={dockConfig.dockBorderColorMode}
        t={t}
      />

      {/* 4. Organización y Visibilidad de Botones */}
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          {t.settings.buttonsOrgTitle}
        </span>
        <p
          style={{
            fontSize: '10.5px',
            color: 'rgba(248, 250, 252, 0.45)',
            margin: '0 0 6px 0',
          }}
        >
          {t.settings.buttonsOrgDesc}
        </p>

        <ul
          aria-label={t.settings.buttonsOrgTitle}
          className={`dock-buttons-reorder-list ${draggedIndex !== null ? 'is-dragging' : ''}`}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const fromIndex =
              dragSourceIndexRef.current ?? (draggedIndex ?? -1);
            if (fromIndex !== -1 && fromIndex !== dockConfig.buttonOrder.length - 1) {
              const newOrder = [...dockConfig.buttonOrder];
              const [movedItem] = newOrder.splice(fromIndex, 1);
              newOrder.push(movedItem);
              launcherActions.reorderDockButtons(newOrder);
            }
            dragSourceIndexRef.current = null;
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
        >
          {dockConfig.buttonOrder.map((btnId: DockButtonId, index: number) => {
            const isVisible = visibleButtonsSet.has(btnId);
            const itemInfo = buttonLabels[btnId] ?? { name: btnId, icon: null };
            const isCustomColor = Boolean(dockConfig.customButtonColors?.[btnId]);
            const activeBtnColor = resolveActiveBtnColor(
              btnId,
              dockConfig.customButtonColors,
              dockConfig.startBtnColorMode,
              dockConfig.customStartBtnColor,
              accentColor,
            );
            const hasCustomization = Boolean(dockConfig.buttonCustomizations?.[btnId]);

            return (
              <SettingsDockButtonRow
                key={btnId}
                btnId={btnId}
                index={index}
                totalButtons={dockConfig.buttonOrder.length}
                isVisible={isVisible}
                itemInfo={itemInfo}
                activeBtnColor={activeBtnColor}
                isCustomColor={isCustomColor}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                hasCustomization={hasCustomization}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                t={t}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
};
