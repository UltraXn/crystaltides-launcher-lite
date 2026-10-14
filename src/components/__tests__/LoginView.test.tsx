import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LoginView } from '../LoginView';
import { useLauncherStore } from '../../store/launcherStore';

describe('LoginView Component', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      language: 'es',
    });
  });

  it('renderiza la vista inicial con el botón de idioma y textos en español', () => {
    render(<LoginView />);

    expect(screen.getByText('CrystalTides')).toBeDefined();
    expect(screen.getByText('Entrar a Jugar')).toBeDefined();
    expect(screen.getByText('Iniciar sesión con:')).toBeDefined();
    expect(screen.getByText('Microsoft')).toBeDefined();

    // Comprobar presencia de botones de idioma con banderas
    expect(screen.getByRole('button', { name: /español/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /english/i })).toBeDefined();
  });

  it('cambia dinámicamente los textos a inglés al hacer clic en EN, traduciendo "Login with:"', () => {
    render(<LoginView />);

    const enBtn = screen.getByRole('button', { name: /english/i });
    fireEvent.click(enBtn);

    expect(screen.getByText('Play Now')).toBeDefined();
    expect(screen.getByText('Login with:')).toBeDefined();
    expect(screen.getByText('Official Account:')).toBeDefined();
    expect(screen.getByPlaceholderText('Your Nickname (No-Premium)')).toBeDefined();
  });

  it('permite alternar de vuelta a español correctamente', () => {
    render(<LoginView />);

    const enBtn = screen.getByRole('button', { name: /english/i });
    fireEvent.click(enBtn);
    expect(screen.getByText('Login with:')).toBeDefined();

    const esBtn = screen.getByRole('button', { name: /español/i });
    fireEvent.click(esBtn);
    expect(screen.getByText('Iniciar sesión con:')).toBeDefined();
    expect(screen.getByText('Entrar a Jugar')).toBeDefined();
  });

  it('muestra el estado de carga y spinner exclusivamente en el botón de Microsoft al pulsar iniciar sesión con Microsoft', async () => {
    render(<LoginView />);

    const msBtn = screen.getByRole('button', { name: /iniciar sesión con microsoft/i });
    const playBtn = screen.getByRole('button', { name: /entrar a jugar/i });

    // Antes de pulsar, ambos están habilitados y con sus textos normales
    expect(msBtn.getAttribute('disabled')).toBeNull();
    expect(playBtn.getAttribute('disabled')).toBeNull();
    expect(screen.getByText('Entrar a Jugar')).toBeDefined();

    // Pulsar botón de Microsoft
    fireEvent.click(msBtn);

    // El botón de Microsoft ahora muestra su propio estado de carga
    expect(msBtn.className).toContain('loading');
    expect(screen.getByText('Conectando con Microsoft...')).toBeDefined();
    expect(screen.getByText('Iniciando sesión...')).toBeDefined();

    // El botón verde No-Premium mantiene su texto "Entrar a Jugar" pero queda deshabilitado
    expect(screen.getByText('Entrar a Jugar')).toBeDefined();
    expect(playBtn.getAttribute('disabled')).not.toBeNull();
  });
});
