import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../SettingsModal';
import { useLauncherStore, launcherActions } from '../../../store/launcherStore';
import { useModuleStore, initializeBuiltinModules } from '../../../modules';

describe('Plugin & Module SDK in SettingsModal', () => {
  beforeEach(() => {
    localStorage.clear();
    initializeBuiltinModules();
    launcherActions.openModal('settings');
    useModuleStore.setState({
      enabledModuleIds: ['ct.nether-portal-calc', 'ct.community-hub'],
    });
  });

  it('permite alternar (activar/desactivar) módulos reactivamente en la interfaz', async () => {
    render(<SettingsModal />);

    // Buscar botón de la Calculadora de Portales Nether
    const toggleButtons = screen.getAllByRole('button', { name: /Habilitado|Deshabilitado/i });
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);

    const firstToggle = toggleButtons[0];
    const initialText = firstToggle.textContent;

    // Hacer clic para conmutar
    fireEvent.click(firstToggle);

    await waitFor(() => {
      expect(firstToggle.textContent).not.toBe(initialText);
    });

    // Conmutar nuevamente
    fireEvent.click(firstToggle);

    await waitFor(() => {
      expect(firstToggle.textContent).toBe(initialText);
    });
  });

  it('permite desplegar el panel de agregar extensión e instalar una nueva extensión personalizada', async () => {
    render(<SettingsModal />);

    const addBtn = screen.getByRole('button', { name: /Agregar Extensión/i });
    expect(addBtn).toBeDefined();

    // Abrir panel
    fireEvent.click(addBtn);

    expect(screen.getByText('Instalar Extensión (Plugin SDK)')).toBeDefined();

    // Llenar formulario rápido
    const nameInput = screen.getByPlaceholderText(/ej: Discord Oficial, Tienda, Mapa/i);
    fireEvent.change(nameInput, { target: { value: 'Mi Discord Oficial' } });

    const createBtn = screen.getByRole('button', { name: /Crear e Instalar Extensión/i });
    fireEvent.click(createBtn);

    // Verificar que se haya instalado y aparezca en la lista
    await waitFor(() => {
      expect(screen.getByText('Mi Discord Oficial')).toBeDefined();
      expect(screen.getByText('Personalizada')).toBeDefined();
    });
  });
});
