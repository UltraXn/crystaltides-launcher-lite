import { Component, ErrorInfo, ReactNode } from 'react';
import { logFrontend } from '../../services/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    const message = error?.message || 'Unknown error';
    const stack = error?.stack || 'N/A';
    const componentStack = errorInfo?.componentStack || 'N/A';
    logFrontend(
      'ERROR',
      `[ErrorBoundary] Uncaught application crash: ${message}\nStack: ${stack}\nComponent: ${componentStack}`,
    );
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleCopy = async () => {
    const text = [
      `Error: ${this.state.error?.message ?? 'Unknown error'}`,
      `Stack:\n${this.state.error?.stack ?? 'N/A'}`,
      `Component Stack:\n${this.state.errorInfo?.componentStack ?? 'N/A'}`,
    ].join('\n\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }
    } catch {
      // Ignorar fallo de portapapeles
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, #111827 0%, #090d16 100%)',
            color: '#f3f4f6',
            fontFamily: 'var(--font-jost, sans-serif)',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'rgba(17, 24, 39, 0.94)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
              >
                !
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#ffffff' }}>
                  Algo salió mal
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>
                  Se ha producido un error inesperado en la interfaz del launcher.
                </p>
              </div>
            </div>

            {this.state.error?.message && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#fca5a5',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={this.handleCopy}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e5e7eb',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {this.state.copied ? 'Copiado' : 'Copiar detalles'}
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
