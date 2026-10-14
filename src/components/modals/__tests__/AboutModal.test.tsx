import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AboutModal } from '../AboutModal';
import { useLauncherStore, launcherActions } from '../../../store/launcherStore';

describe('AboutModal Component', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      activeModal: 'about',
      language: 'es',
    });
  });

  it('no renderiza nada cuando activeModal no es about', () => {
    useLauncherStore.setState({ activeModal: 'none' });
    const { container } = render(<AboutModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la estructura Info con el botón de reporte, copyright y especificaciones', () => {
    render(<AboutModal />);

    // Título Info
    expect(screen.getByRole('heading', { level: 2, name: /Info/i })).toBeDefined();

    // Botón de reporte de error
    const bugBtn = screen.getByRole('link', { name: /Reportar un error/i });
    expect(bugBtn).toBeDefined();
    expect(bugBtn.getAttribute('href')).toBe('https://crystaltidessmp.net/support');

    // Copyright y disclaimer legal
    expect(screen.getByText(/©2026 CrystalTides Team/i)).toBeDefined();
    expect(screen.getByText(/No afiliado con Mojang Studios/i)).toBeDefined();

    // Secciones técnicas
    expect(screen.getByRole('heading', { level: 3, name: 'APP' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'UI' })).toBeDefined();
    expect(screen.getByText(/Launcher: v1.0.0-lite/i)).toBeDefined();
    expect(screen.getByText(/Tauri: v2.0/i)).toBeDefined();
    expect(screen.getByText(/Papyrus UI: v1.2.0/i)).toBeDefined();

    // Tagline
    expect(screen.getByText(/forjado en las profundidades/i)).toBeDefined();

    // Enlaces de pie
    expect(screen.getByRole('link', { name: /Discord Oficial/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /Sitio Web/i })).toBeDefined();
  });

  it('renderiza en inglés cuando el idioma activo es inglés', () => {
    useLauncherStore.setState({ language: 'en' });
    render(<AboutModal />);

    expect(screen.getByRole('link', { name: /Report a bug!/i })).toBeDefined();
    expect(screen.getByText(/Not affiliated with Mojang Studios/i)).toBeDefined();
    expect(screen.getByText(/forged in the deep tides/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Official Discord/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /Website/i })).toBeDefined();
  });

  it('cierra el modal al hacer clic en el botón de cerrar', () => {
    render(<AboutModal />);

    const closeButtons = screen.getAllByRole('button', { name: /Cerrar/i });
    // El segundo botón es el de la cabecera del card (.settings-card-close)
    fireEvent.click(closeButtons[1]);

    expect(useLauncherStore.getState().activeModal).toBe('none');
  });

  it('cierra el modal al pulsar en el overlay de fondo', () => {
    render(<AboutModal />);

    const closeButtons = screen.getAllByRole('button', { name: /Cerrar/i });
    // El primer botón es el backdrop del overlay
    fireEvent.click(closeButtons[0]);

    expect(useLauncherStore.getState().activeModal).toBe('none');
  });
});
