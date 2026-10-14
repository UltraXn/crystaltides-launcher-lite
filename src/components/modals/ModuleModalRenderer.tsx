import React from 'react';
import { X, Puzzle } from 'lucide-react';
import { useModuleStore, getModuleContext } from '../../modules';
import { useLauncherStore, LauncherState } from '../../store/launcherStore';

export const ModuleModalRenderer: React.FC = () => {
  const activeModalModuleId = useModuleStore((s) => s.activeModalModuleId);
  const modules = useModuleStore((s) => s.modules);
  const closeModal = useModuleStore((s) => s.closeModal);
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const instances = useLauncherStore((s: LauncherState) => s.instances);
  const activeInstanceId = useLauncherStore((s: LauncherState) => s.activeInstanceId);
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);
  const serverStatus = useLauncherStore((s: LauncherState) => s.serverStatus);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);

  const ctx = React.useMemo(() => {
    if (!activeModalModuleId) return null;
    const baseCtx = getModuleContext(activeModalModuleId);
    const activeInstance = instances.find((i) => i.id === activeInstanceId);
    const activeAccount = accounts.find((a) => a.id === activeAccountId);
    return {
      ...baseCtx,
      activeInstance,
      activeAccount,
      serverStatus,
      accentColor,
    };
  }, [
    activeModalModuleId,
    instances,
    activeInstanceId,
    accounts,
    activeAccountId,
    serverStatus,
    accentColor,
  ]);

  if (isEditingHud || !activeModalModuleId || !ctx) return null;

  const currentModule = modules.find((m) => m.id === activeModalModuleId);
  if (!currentModule?.slots.modal) return null;

  const modalSlot = currentModule.slots.modal;
  const ModalComponent = modalSlot.component;

  return (
    <div className="papyrus-modal-overlay">
      <button
        type="button"
        aria-label="Cerrar modal"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
        onClick={closeModal}
      />
      <dialog
        open
        className="papyrus-settings-card"
        aria-label={modalSlot.title}
        style={{ width: modalSlot.width ?? '480px' }}
      >
        {/* Close Button on Top Right */}
        <button
          onClick={closeModal}
          className="settings-card-close"
          title="Cerrar módulo"
          type="button"
        >
          <X style={{ width: '16px', height: '16px' }} />
        </button>

        {/* Modal Header */}
        <div className="settings-header-block" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Puzzle size={18} color="#38bdf8" />
            <h2 className="settings-main-title">{modalSlot.title}</h2>
          </div>
          <span
            style={{
              fontSize: '11px',
              color: 'rgba(248, 250, 252, 0.4)',
              fontWeight: 600,
              fontFamily: 'var(--font-fira, monospace)',
            }}
          >
            {currentModule.name} v{currentModule.version}
          </span>
        </div>

        {/* Module Content */}
        <ModalComponent ctx={ctx} onClose={closeModal} />
      </dialog>
    </div>
  );
};
