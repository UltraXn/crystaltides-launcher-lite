import { Component, ErrorInfo, ReactNode } from 'react';
import { OutOfMemoryScreen } from '../OutOfMemoryScreen';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application crash:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message ?? 'Error inesperado en la interfaz';
      const isOomOrMemory = /out of memory|heap|allocation|quota|memory|call stack/i.test(
        errorMessage,
      );

      return (
        <OutOfMemoryScreen
          crashReason={
            isOomOrMemory
              ? `Memoria de interfaz agotada: ${errorMessage}`
              : `Fallo inesperado del sistema: ${errorMessage}`
          }
          crashDetails={this.state.error?.stack}
          exitCode={isOomOrMemory ? 137 : 1}
          isFatalCrash={true}
          onRetry={() => {
            this.setState({ hasError: false, error: null });
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
          onClose={() => {
            this.setState({ hasError: false, error: null });
          }}
        />
      );
    }

    return this.props.children;
  }
}
