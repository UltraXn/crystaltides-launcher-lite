import React, { useState, useEffect } from 'react';
import {
  Puzzle,
  Sparkles,
  Globe,
  MessageSquare,
  ShoppingBag,
  Compass,
  Folder,
  Gamepad2,
  Code,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useModuleStore, initializeBuiltinModules } from '../../../modules';
import { launcherActions } from '../../../store/launcherStore';
import type { CustomPluginManifest } from '../../../modules/types';

const ICON_OPTIONS = [
  { id: 'globe', label: 'Web', icon: <Globe size={14} /> },
  { id: 'chat', label: 'Discord / Chat', icon: <MessageSquare size={14} /> },
  { id: 'store', label: 'Tienda', icon: <ShoppingBag size={14} /> },
  { id: 'compass', label: 'Mapa', icon: <Compass size={14} /> },
  { id: 'folder', label: 'Carpeta', icon: <Folder size={14} /> },
  { id: 'gamepad', label: 'Juego', icon: <Gamepad2 size={14} /> },
  { id: 'sparkles', label: 'Especial', icon: <Sparkles size={14} /> },
  { id: 'code', label: 'Código', icon: <Code size={14} /> },
  { id: 'puzzle', label: 'Módulo', icon: <Puzzle size={14} /> },
];

const COLOR_PRESETS = [
  { label: 'Cian', value: '#16A085' },
  { label: 'Azul', value: '#38bdf8' },
  { label: 'Púrpura', value: '#a855f7' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Ámbar', value: '#f59e0b' },
  { label: 'Rosa', value: '#ec4899' },
];

export const SettingsPluginSdkSection: React.FC = () => {
  const modules = useModuleStore((s) => s.modules);
  const enabledModuleIds = useModuleStore((s) => s.enabledModuleIds);
  const installPlugin = useModuleStore((s) => s.installPlugin);
  const uninstallPlugin = useModuleStore((s) => s.uninstallPlugin);
  const toggleModule = useModuleStore((s) => s.toggleModule);
  const isModuleEnabled = useModuleStore((s) => s.isModuleEnabled);
  const openModuleModal = useModuleStore((s) => s.openModal);

  useEffect(() => {
    initializeBuiltinModules();
  }, []);

  const [showAddExtension, setShowAddExtension] = useState(false);
  const [newExtensionName, setNewExtensionName] = useState('');
  const [newExtensionDesc, setNewExtensionDesc] = useState('');
  const [newExtensionIcon, setNewExtensionIcon] = useState('globe');
  const [newExtensionActionType, setNewExtensionActionType] = useState<'url' | 'openDir' | 'modal'>(
    'url',
  );
  const [newExtensionTarget, setNewExtensionTarget] = useState('https://');
  const [newExtensionColor, setNewExtensionColor] = useState('#16A085');
  const [openCustomizerAfterCreate, setOpenCustomizerAfterCreate] = useState(false);

  const handleCreateExtension = () => {
    if (!newExtensionName.trim()) return;

    const pluginId = `custom.${Date.now()}`;
    const name = newExtensionName.trim();
    const desc = newExtensionDesc.trim() || 'Personalizada';
    const target =
      newExtensionActionType === 'openDir'
        ? newExtensionTarget.startsWith('{')
          ? newExtensionTarget
          : '{modsDir}'
        : newExtensionTarget.trim() || 'https://';

    const manifest: CustomPluginManifest = {
      id: pluginId,
      name,
      version: '1.0.0',
      description: desc,
      author: 'Usuario',
      category: 'tools',
      accentColor: newExtensionColor,
      slots: {
        dockButton: {
          label: name,
          tooltip: desc,
          iconName: newExtensionIcon,
          defaultColor: newExtensionColor,
          actionType: newExtensionActionType,
          actionTarget: target,
        },
        modal:
          newExtensionActionType === 'modal'
            ? {
                title: name,
                description: desc,
                externalUrl: target.startsWith('http') ? target : undefined,
              }
            : undefined,
      },
    };

    installPlugin(manifest);

    // Reset Form
    setNewExtensionName('');
    setNewExtensionDesc('');
    setNewExtensionTarget('https://');
    setShowAddExtension(false);

    // Si el usuario quiere personalizar forma y efectos inmediatamente
    if (openCustomizerAfterCreate) {
      launcherActions.openButtonCustomizer(`mod:${pluginId}`);
    }
  };

  const enabledSet = new Set(enabledModuleIds);

  return (
    <div
      className="settings-section"
      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px' }}
    >
      <div className="settings-section-header">
        <span
          className="settings-label-title"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16A085' }}
        >
          <Puzzle size={15} style={{ color: '#16A085' }} />
          Módulos &amp; Extensiones (Plugin SDK)
        </span>
        <button
          type="button"
          onClick={() => setShowAddExtension(!showAddExtension)}
          className="settings-action-btn"
          style={{ padding: '3px 8px', fontSize: '10.5px' }}
        >
          {showAddExtension ? 'Cancelar' : 'Agregar Extensión'}
        </button>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(248, 250, 252, 0.6)',
            fontFamily: 'var(--font-inter)',
          }}
        >
          {modules.filter((m) => isModuleEnabled(m.id)).length} / {modules.length} Activos
        </span>
      </div>

      <p
        style={{
          fontSize: '11px',
          color: 'rgba(248, 250, 252, 0.5)',
          margin: '2px 0 12px 0',
          lineHeight: 1.45,
        }}
      >
        Arquitectura extensible SDK. Activa o desactiva herramientas modulares integradas
        (calculadoras, hubs, widgets) con integración viva en el Dock y el Launcher:
      </p>

      {/* Panel Avanzado para Crear Extensiones */}
      {showAddExtension && (
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'rgba(22, 160, 133, 0.09)',
            border: '1px solid rgba(22, 160, 133, 0.35)',
            marginBottom: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label
              htmlFor="settings-new-extension-name"
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#16A085',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={14} />
              <span>Instalar Extensión (Plugin SDK)</span>
            </label>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Crea tu botón personalizado y define su acción
            </span>
          </div>

          {/* Nombre y Descripción */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
                Nombre del Botón:
              </span>
              <input
                id="settings-new-extension-name"
                type="text"
                placeholder="ej: Discord Oficial, Tienda, Mapa"
                value={newExtensionName}
                onChange={(e) => setNewExtensionName(e.target.value)}
                className="login-text-input"
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '10px',
                  background: 'rgba(5, 9, 14, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
                Descripción / Subtítulo:
              </span>
              <input
                type="text"
                placeholder="ej: Acceso directo a la comunidad..."
                value={newExtensionDesc}
                onChange={(e) => setNewExtensionDesc(e.target.value)}
                className="login-text-input"
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '10px',
                  background: 'rgba(5, 9, 14, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
            </div>
          </div>

          {/* Selector de Icono */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              Icono del Botón:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ICON_OPTIONS.map((opt) => {
                const isSelected = newExtensionIcon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewExtensionIcon(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: isSelected
                        ? '1px solid #16A085'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      background: isSelected
                        ? 'rgba(22, 160, 133, 0.25)'
                        : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#5eead4' : '#94a3b8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Acción al pulsar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              Acción al hacer clic en el Dock:
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'url', label: '🌐 Abrir Enlace Web (URL)' },
                { id: 'openDir', label: '📂 Abrir Carpeta Local' },
                { id: 'modal', label: '🪟 Ventana Modal en Launcher' },
              ].map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setNewExtensionActionType(act.id as 'url' | 'openDir' | 'modal');
                    if (act.id === 'openDir') setNewExtensionTarget('{modsDir}');
                    if (act.id === 'url') setNewExtensionTarget('https://');
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border:
                      newExtensionActionType === act.id
                        ? '1px solid #16A085'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    background:
                      newExtensionActionType === act.id
                        ? 'rgba(22, 160, 133, 0.2)'
                        : 'rgba(255, 255, 255, 0.04)',
                    color: newExtensionActionType === act.id ? '#5eead4' : '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {act.label}
                </button>
              ))}
            </div>

            {/* Input según tipo de acción */}
            {newExtensionActionType === 'url' && (
              <input
                type="url"
                placeholder="https://discord.gg/ejemplo o https://tienda..."
                value={newExtensionTarget}
                onChange={(e) => setNewExtensionTarget(e.target.value)}
                className="login-text-input"
                style={{
                  width: '100%',
                  height: '32px',
                  paddingLeft: '10px',
                  background: 'rgba(5, 9, 14, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  color: '#f8fafc',
                }}
              />
            )}

            {newExtensionActionType === 'openDir' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: '{modsDir}', label: 'Carpeta de Mods' },
                  { id: '{instanceDir}', label: 'Raíz de la Instancia' },
                  { id: '{logsDir}', label: 'Carpeta de Logs' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setNewExtensionTarget(d.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '5px',
                      border:
                        newExtensionTarget === d.id
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                      background:
                        newExtensionTarget === d.id
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(255, 255, 255, 0.04)',
                      color: newExtensionTarget === d.id ? '#7dd3fc' : '#94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color del botón & Checkbox para abrir personalizador */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              paddingTop: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
                Color del Botón:
              </span>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setNewExtensionColor(c.value)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: c.value,
                    border:
                      newExtensionColor === c.value
                        ? '2px solid #ffffff'
                        : '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: newExtensionColor === c.value ? `0 0 8px ${c.value}` : 'none',
                    cursor: 'pointer',
                  }}
                  title={c.label}
                />
              ))}
            </div>

            <label
              htmlFor="settings-customizer-dock-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: '#e2e8f0',
                cursor: 'pointer',
              }}
            >
              <input
                id="settings-customizer-dock-checkbox"
                type="checkbox"
                checked={openCustomizerAfterCreate}
                onChange={(e) => setOpenCustomizerAfterCreate(e.target.checked)}
                style={{ accentColor: '#16A085' }}
              />
              <span>Personalizar forma y FX en el Dock al crear</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleCreateExtension}
            className="settings-action-btn primary"
            style={{
              alignSelf: 'flex-start',
              fontSize: '11.5px',
              padding: '6px 14px',
              marginTop: '4px',
              background: 'linear-gradient(135deg, #156F69 0%, #16A085 100%)',
              color: '#ffffff',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(22, 160, 133, 0.35)',
            }}
          >
            Crear e Instalar Extensión
          </button>
        </div>
      )}

      {/* Lista de Módulos & Extensiones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {modules.map((mod) => {
          const enabled = enabledSet.has(mod.id);
          const modAccent = mod.accentColor || mod.slots.dockButton?.defaultColor || '#16A085';
          const hasModal = Boolean(mod.slots.modal);

          return (
            <div
              key={mod.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: enabled ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.015)',
                border: enabled
                  ? `1px solid ${modAccent}44`
                  : '1px solid rgba(255, 255, 255, 0.06)',
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: `${modAccent}18`,
                      border: `1px solid ${modAccent}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: modAccent,
                      flexShrink: 0,
                    }}
                  >
                    <Puzzle size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: enabled ? '#f8fafc' : 'rgba(248, 250, 252, 0.6)',
                        }}
                      >
                        {mod.name}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'rgba(248, 250, 252, 0.5)',
                          fontWeight: 600,
                        }}
                      >
                        v{mod.version}
                      </span>
                      {mod.author && (
                        <span style={{ fontSize: '10px', color: 'rgba(248, 250, 252, 0.4)' }}>
                          por {mod.author}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: '11px',
                        color: 'rgba(248, 250, 252, 0.55)',
                        margin: '2px 0 0 0',
                        lineHeight: 1.35,
                      }}
                    >
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Acciones de la Extensión */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Botón Personalizar Forma/Dimensiones/FX del Botón en Dock */}
                  {mod.slots.dockButton && (
                    <button
                      type="button"
                      onClick={() => launcherActions.openButtonCustomizer(`mod:${mod.id}`)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: '6px',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      title="Personalizar forma, dimensiones libres, radio de borde, fondo y efectos especiales en el Dock"
                    >
                      <Sparkles size={11} />
                      <span>Personalizar Botón</span>
                    </button>
                  )}

                  {hasModal && enabled && (
                    <button
                      type="button"
                      onClick={() => openModuleModal(mod.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${modAccent}55`,
                        background: `${modAccent}15`,
                        color: modAccent,
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>Abrir</span>
                      <ExternalLink size={11} />
                    </button>
                  )}

                  {/* Conmutador Habilitado / Deshabilitado */}
                  <button
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: enabled
                        ? `1px solid ${modAccent}66`
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      background: enabled ? `${modAccent}25` : 'rgba(255, 255, 255, 0.04)',
                      color: enabled ? '#f8fafc' : 'rgba(248, 250, 252, 0.5)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {enabled ? (
                      <>
                        <Check size={12} color={modAccent} />
                        Habilitado
                      </>
                    ) : (
                      'Deshabilitado'
                    )}
                  </button>

                  {/* Desinstalar si es Custom */}
                  {mod.isCustom && (
                    <button
                      type="button"
                      onClick={() => uninstallPlugin(mod.id)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#f87171',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Desinstalar y eliminar extensión personalizada"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tags informativos */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                {mod.slots.dockButton && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'rgba(22, 160, 133, 0.14)',
                      color: '#16A085',
                      border: '1px solid rgba(22, 160, 133, 0.3)',
                    }}
                  >
                    Dock Integrado
                  </span>
                )}
                {mod.slots.modal && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'rgba(168, 85, 247, 0.1)',
                      color: '#a855f7',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                    }}
                  >
                    Herramienta Modal
                  </span>
                )}
                {mod.isCustom && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                    }}
                  >
                    Personalizado (Custom)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
