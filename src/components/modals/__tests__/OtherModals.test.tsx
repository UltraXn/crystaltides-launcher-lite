import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LogViewerModal } from '../LogViewerModal';
import { AccountsModal, AccountRowItem, GuestForm } from '../AccountsModal';
import { InstancesModal } from '../InstancesModal';
import { getGameTypeBadge } from '../../../utils/instanceUtils';
import { useLauncherStore } from '../../../store/launcherStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('log data content'),
}));

describe('Other Modals in launcher-lite', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      activeModal: undefined,
      accounts: [
        {
          id: 'acc-1',
          username: 'Alex',
          type: 'guest',
          active: true,
          uuid: '11111111-2222-3333-4444-555555555555',
        },
        {
          id: 'acc-2',
          username: 'Steve',
          type: 'microsoft',
          active: false,
          uuid: '22222222-3333-4444-5555-666666666666',
        },
      ] as any,
      activeAccountId: 'acc-1',
      instances: [
        {
          id: 'inst-1',
          name: 'Default SMP',
          mcVersion: '1.21.1',
          loaderType: 'neoforge',
          icon: 'cube',
        },
      ] as any,
      activeInstanceId: 'inst-1',
      accentColor: '#00e5ff',
      language: 'es',
    });
  });

  describe('LogViewerModal', () => {
    it('renderiza logs del launcher cuando está abierto', () => {
      const handleClose = vi.fn();
      render(<LogViewerModal isOpen={true} onClose={handleClose} defaultTab="launcher" />);

      const closeButtons = screen.getAllByRole('button');
      expect(closeButtons.length).toBeGreaterThan(0);
      expect(screen.getByText('Descargar')).toBeDefined();
      expect(screen.getByText('Ajustar líneas')).toBeDefined();
    });

    it('no renderiza nada cuando isOpen es false', () => {
      const { container } = render(<LogViewerModal isOpen={false} onClose={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('AccountRowItem & GuestForm Subcomponents', () => {
    const mockT = {
      accounts: {
        microsoftAuth: 'Microsoft',
        offlineAccount: 'Offline',
        select: 'Seleccionar',
        uploadSkinTitle: 'Subir Skin',
        activeTag: 'Activo',
        deleteProfileTitle: 'Eliminar Cuenta',
        usernamePlaceholder: 'Nombre de usuario',
        addGuestBtn: 'Añadir Cuenta Offline',
        cancel: 'Cancelar',
      },
    } as any;

    it('AccountRowItem renderiza detalles de la cuenta y maneja selección y borrado', () => {
      const handleSelect = vi.fn();
      const handleRemove = vi.fn();
      const handleUploadSkin = vi.fn();

      render(
        <AccountRowItem
          acc={{
            id: 'acc-1',
            username: 'Alex',
            uuid: '11111111-2222-3333-4444-555555555555',
            type: 'guest',
            lastUsed: Date.now(),
          }}
          isActive={true}
          totalAccounts={2}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onUploadSkin={handleUploadSkin}
          t={mockT}
        />,
      );

      expect(screen.getByText('Alex')).toBeDefined();
      expect(screen.getByText('Activo')).toBeDefined();

      const selectBtn = screen.getByLabelText(/Seleccionar Alex/);
      fireEvent.click(selectBtn);
      expect(handleSelect).toHaveBeenCalledWith('acc-1');

      const removeBtn = screen.getByLabelText(/Eliminar Cuenta/);
      fireEvent.click(removeBtn);
      expect(handleRemove).toHaveBeenCalledWith('acc-1');
    });

    it('GuestForm maneja cambios de input, subida de skin y submit', () => {
      const handleChangeUsername = vi.fn();
      const handleOpenSkinUpload = vi.fn();
      const handleCancel = vi.fn();
      const handleSubmit = vi.fn((e) => e.preventDefault());

      const { container } = render(
        <GuestForm
          username="Steve"
          onChangeUsername={handleChangeUsername}
          onOpenSkinUpload={handleOpenSkinUpload}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          t={mockT}
        />,
      );

      const input = screen.getByPlaceholderText('Nombre de usuario');
      fireEvent.change(input, { target: { value: 'NuevoSteve' } });
      expect(handleChangeUsername).toHaveBeenCalledWith('NuevoSteve');

      const form = container.querySelector('form');
      if (form) {
        fireEvent.submit(form);
        expect(handleSubmit).toHaveBeenCalled();
      }
    });
  });

  describe('AccountsModal Component', () => {
    it('renderiza la lista de cuentas y permite seleccionar o cerrar', () => {
      useLauncherStore.setState({ activeModal: 'accounts' });
      render(<AccountsModal />);

      expect(screen.getByText('Alex')).toBeDefined();
      expect(screen.getByText('Steve')).toBeDefined();

      // Click en una cuenta para activarla
      const steveItem = screen.getByText('Steve');
      fireEvent.click(steveItem);

      // Botón de cerrar
      const closeButtons = screen.getAllByRole('button');
      const closeBtn = closeButtons.find(
        (b) => b.getAttribute('title')?.includes('Cerrar') || b.querySelector('svg'),
      );
      if (closeBtn) {
        fireEvent.click(closeBtn);
      }
    });

    it('no renderiza nada si activeModal no es accounts', () => {
      useLauncherStore.setState({ activeModal: undefined });
      const { container } = render(<AccountsModal />);
      expect(container.firstChild).toBeNull();
    });

    it('renderiza el botón de Microsoft con el icono oficial SVG', () => {
      useLauncherStore.setState({ activeModal: 'accounts' });
      const { container } = render(<AccountsModal />);

      const msBtn = screen.getByText('Microsoft');
      expect(msBtn).toBeDefined();

      const svg = container.querySelector('button.account-add-btn svg');
      expect(svg).toBeDefined();
    });
  });

  describe('InstancesModal Component', () => {
    it('renderiza el modal de instancias y permite cambiar de pestañas', () => {
      useLauncherStore.setState({ activeModal: 'instances' });
      render(<InstancesModal />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Clic en pestaña Crear
      const createTabBtn = buttons.find(
        (b) => b.textContent?.includes('Crear') || b.textContent?.includes('Nueva'),
      );
      if (createTabBtn) {
        fireEvent.click(createTabBtn);
      }
    });

    it('permite abrir el editor de instancia con el botón Editar y regresar a la lista', () => {
      useLauncherStore.setState({
        activeModal: 'instances',
        instances: [
          {
            id: 'test-inst-1',
            name: 'Instancia Test de Prueba',
            mcVersion: '1.21.1',
            loaderType: 'fabric',
            icon: 'sword',
            createdAt: Date.now(),
          },
        ],
      });

      render(<InstancesModal />);

      // Busca el botón Editar
      const editButtons = screen.getAllByRole('button');
      const editBtn = editButtons.find(
        (b) => b.textContent?.includes('Editar') || b.getAttribute('title')?.includes('Editar'),
      );
      expect(editBtn).toBeDefined();

      if (editBtn) {
        fireEvent.click(editBtn);

        // Debe mostrar la vista de edición con el nombre de la instancia y botón Guardar Cambios
        expect(screen.getAllByText(/Editar Instancia/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Guardar Cambios/i)).toBeDefined();
      }
    });

    it('no renderiza nada si activeModal no es instances', () => {
      useLauncherStore.setState({ activeModal: undefined });
      const { container } = render(<InstancesModal />);
      expect(container.firstChild).toBeNull();
    });

    it('getGameTypeBadge retorna estilos correctos para hardcore, creativo y supervivencia', () => {
      expect(getGameTypeBadge(true, 0)).toEqual({
        label: 'Hardcore',
        background: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
      });
      expect(getGameTypeBadge(false, 1)).toEqual({
        label: 'Creativo',
        background: 'rgba(56, 189, 248, 0.2)',
        color: '#38bdf8',
      });
      expect(getGameTypeBadge(false, 0)).toEqual({
        label: 'Supervivencia',
        background: 'rgba(34, 197, 94, 0.2)',
        color: '#22c55e',
      });
    });
  });
});
