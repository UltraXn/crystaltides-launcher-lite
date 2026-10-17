import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import * as logger from '../../../services/logger';

vi.mock('../../../services/logger', () => ({
  logFrontend: vi.fn(),
}));

const ThrowingComponent = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test crash in interface');
  }
  return <div>Contenido seguro</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renderiza a los hijos normalmente cuando no hay errores', () => {
    render(
      <ErrorBoundary>
        <div>Todo correcto</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Todo correcto')).toBeInTheDocument();
  });

  it('muestra la pantalla neutra de error y llama a logFrontend cuando ocurre un fallo', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(
      screen.getByText('Se ha producido un error inesperado en la interfaz del launcher.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Test crash in interface')).toBeInTheDocument();

    expect(logger.logFrontend).toHaveBeenCalledWith(
      'ERROR',
      expect.stringContaining(
        '[ErrorBoundary] Uncaught application crash: Test crash in interface',
      ),
    );
  });

  it('renderiza fallback personalizado si es proporcionado', () => {
    render(
      <ErrorBoundary fallback={<div>Fallback alternativo</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Fallback alternativo')).toBeInTheDocument();
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
  });

  it('recarga la ventana al hacer clic en Reintentar', () => {
    const reloadMock = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      reload: reloadMock,
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText('Reintentar'));
    expect(reloadMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('copia los detalles del error al portapapeles al pulsar Copiar detalles', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    const copyBtn = screen.getByText('Copiar detalles');
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('Test crash in interface'));

    await waitFor(() => {
      expect(screen.getByText('Copiado')).toBeInTheDocument();
    });
  });
});
