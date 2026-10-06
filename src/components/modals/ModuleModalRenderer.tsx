import React from 'react';
import { X, Puzzle } from 'lucide-react';
import { useModuleStore, getModuleContext } from '../../modules';

export const ModuleModalRenderer: React.FC = () => {
  const activeModalModuleId = useModuleStore((s) => s.activeModalModuleId);
  const modules = useModuleStore((s) => s.modules);
  const closeModal = useModuleStore((s) => s.closeModal);

  if (!activeModalModuleId) return null;

  const currentModule = modules.find((m) => m.id === activeModalModuleId);
  if (!currentModule || !currentModule.slots.modal) return null;

  const modalSlot = currentModule.slots.modal;
  const ModalComponent = modalSlot.component;
  const ctx = getModuleContext(currentModule.id);

  return (
    <div
      className="papyrus-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeModal();
      }}
    >
      <div
        className="papyrus-settings-card"
        role="dialog"
        aria-modal="true"
        aria-label={modalSlot.title}
        style={{ width: modalSlot.width || '480px' }}
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
      </div>
    </div>
  );
};
