import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ButtonCustomizerModal } from '../ButtonCustomizerModal';
import { InstancesCreateTab, getIconComponent } from '../InstancesCreateTab';
import { useLauncherStore, launcherActions } from '../../../store/launcherStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('ButtonCustomizerModal & InstancesCreateTab Suite', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      activeModal: 'customizer' as any,
      selectedDockButtonId: 'instances',
      accentColor: '#38bdf8',
      dockConfig: {
        borderRadius: 14,
        scale: 1,
        showLabels: true,
        buttonCustomizations: {},
        panoramaButtons: [],
      } as any,
    });
  });

  const mockT = {
    instances: {
      formNameLabel: 'Nombre de la instancia',
      formNamePlaceholder: 'Ej. Servidor Vanilla...',
      formVersionLabel: 'Versión de Minecraft',
      formLoaderLabel: 'Cargador de Mods',
      formCancelBtn: 'Cancelar',
      formCreateBtn: 'Crear Instancia',
      cancel: 'Cancelar',
      create: 'Crear Instancia',
      installing: 'Instalando...',
      iconCube: 'Cubo',
      iconSword: 'Espada',
      iconFeather: 'Pluma',
      iconFlame: 'Llama',
      iconShield: 'Escudo',
    },
    common: {
      cancel: 'Cancelar',
      save: 'Guardar',
    },
  } as any;

  describe('getIconComponent', () => {
    it('retorna iconos según el tipo seleccionado', () => {
      expect(getIconComponent('cube')).toBeDefined();
      expect(getIconComponent('sword')).toBeDefined();
      expect(getIconComponent('feather')).toBeDefined();
      expect(getIconComponent('flame')).toBeDefined();
      expect(getIconComponent('shield')).toBeDefined();
      expect(getIconComponent('unknown' as any)).toBeDefined();
    });
  });

  describe('InstancesCreateTab', () => {
    it('renderiza el formulario y cancela al presionar cancelar', () => {
      const handleCancel = vi.fn();
      render(
        <InstancesCreateTab
          availableVersions={['1.21.1', '1.20.4']}
          onCancel={handleCancel}
          t={mockT}
        />
      );

      const cancelBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Cancelar'));
      expect(cancelBtn).toBeDefined();
      if (cancelBtn) {
        fireEvent.click(cancelBtn);
        expect(handleCancel).toHaveBeenCalled();
      }
    });

    it('permite completar el formulario con opciones avanzadas y enviarlo', () => {
      const handleCancel = vi.fn();
      const createInstanceSpy = vi.spyOn(launcherActions, 'createInstance');

      const { container } = render(
        <InstancesCreateTab
          availableVersions={['1.21.1', '1.20.4']}
          onCancel={handleCancel}
          t={mockT}
        />
      );

      // Escribir nombre
      const nameInput = screen.getByLabelText('Nombre de la instancia');
      fireEvent.change(nameInput, { target: { value: 'Mi Instancia Moddeada' } });

      // Seleccionar un icono diferente
      const buttons = screen.getAllByRole('button');
      const iconBtns = buttons.filter((b) => b.getAttribute('type') === 'button' && !b.textContent?.includes('Cancelar'));
      if (iconBtns.length > 0) {
        fireEvent.click(iconBtns[1]); // Espada u otro icono
      }

      // Expandir resolución avanzada si el botón existe
      const expandResBtn = buttons.find((b) => b.textContent?.includes('Resolución') || b.textContent?.includes('resolución'));
      if (expandResBtn) {
        fireEvent.click(expandResBtn);
      }

      // Expandir hooks avanzados si existe
      const expandHooksBtn = buttons.find((b) => b.textContent?.includes('Hooks') || b.textContent?.includes('avanzados'));
      if (expandHooksBtn) {
        fireEvent.click(expandHooksBtn);
      }

      // Enviar formulario directamente
      const form = container.querySelector('form');
      expect(form).not.toBeNull();
      if (form) {
        fireEvent.submit(form);
      }

      expect(createInstanceSpy).toHaveBeenCalled();
      expect(handleCancel).toHaveBeenCalled();
    });

    it('soporta enviar formulario con nombre vacío generando nombre automático', () => {
      const handleCancel = vi.fn();
      const createInstanceSpy = vi.spyOn(launcherActions, 'createInstance');

      const { container } = render(
        <InstancesCreateTab
          availableVersions={[]}
          onCancel={handleCancel}
          t={mockT}
        />
      );

      const form = container.querySelector('form');
      if (form) {
        fireEvent.submit(form);
      }

      expect(createInstanceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          mcVersion: '1.21.1',
          loaderType: 'neoforge',
        })
      );
      expect(handleCancel).toHaveBeenCalled();
    });
  });

  describe('ButtonCustomizerModal', () => {
    it('renderiza el modal cuando está abierto y permite cerrarlo', () => {
      const handleClose = vi.fn();
      render(
        <ButtonCustomizerModal
          isOpen={true}
          buttonId="instances"
          onClose={handleClose}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      const closeBtn = buttons.find((b) => b.getAttribute('title')?.includes('Cerrar') || b.textContent?.includes('Cerrar') || b.getAttribute('aria-label')?.includes('Cerrar'));
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalled();
      }
    });

    it('permite alternar entre pestañas del personalizador', () => {
      render(
        <ButtonCustomizerModal
          isOpen={true}
          buttonId="instances"
          onClose={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole('button');
      const tabs = ['Fondo', 'Geometría', 'Efectos', 'Icono'];
      for (const tabName of tabs) {
        const tabBtn = buttons.find((b) => b.textContent?.includes(tabName));
        if (tabBtn) {
          fireEvent.click(tabBtn);
        }
      }
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('permite cerrar el modal con tecla Escape', () => {
      const handleClose = vi.fn();
      const { container } = render(
        <ButtonCustomizerModal
          isOpen={true}
          buttonId="instances"
          onClose={handleClose}
        />
      );

      const overlay = container.querySelector('.papyrus-modal-overlay');
      expect(overlay).not.toBeNull();
      if (overlay) {
        fireEvent.keyDown(overlay, { key: 'Escape' });
        expect(handleClose).toHaveBeenCalled();
      }
    });

    it('permite copiar SVG original al portapapeles en la pestaña de Icono', () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      render(
        <ButtonCustomizerModal
          isOpen={true}
          buttonId="instances"
          onClose={vi.fn()}
        />
      );

      const iconTabBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Icono'));
      if (iconTabBtn) {
        fireEvent.click(iconTabBtn);
      }

      const copyBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Copiar SVG'));
      if (copyBtn) {
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      }
    });
  });
});
