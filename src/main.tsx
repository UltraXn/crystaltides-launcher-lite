import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/jost/700.css';
import '@fontsource/jost/800.css';
import '@fontsource/jost/900.css';
import { App } from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { logFrontend } from './services/logger';
import './index.css';

if (typeof window !== 'undefined') {
  // Desactivar el menú contextual nativo del navegador en todo el launcher,
  // permitiendo únicamente interacciones intencionales (campos de texto o elementos con data-allow-context-menu)
  window.addEventListener('contextmenu', (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const isTextInput =
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const isExplicitlyAllowed = target?.closest("[data-allow-context-menu='true']");

    if (!isTextInput && !isExplicitlyAllowed) {
      event.preventDefault();
    }
  });

  // Prevenir atajos de navegador que rompen la experiencia nativa de escritorio
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    // F5 o Ctrl+R / Cmd+R (evita recargas accidentales que reinician el estado de la UI)
    const isReload =
      event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r');

    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U (Herramientas de Desarrollador / Ver Código)
    const isDevTools =
      event.key === 'F12' ||
      ((event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'j')) ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'u');

    if (isReload && !import.meta.env.DEV) {
      event.preventDefault();
    }

    if (isDevTools && !import.meta.env.DEV) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event: ErrorEvent) => {
    const errorDetails = `[window.onerror] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}${
      event.error?.stack ? `\nStack: ${event.error.stack}` : ''
    }`;
    logFrontend('ERROR', errorDetails);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? `${reason.message}\nStack: ${reason.stack ?? 'N/A'}`
        : typeof reason === 'string'
          ? reason
          : JSON.stringify(reason);
    logFrontend('ERROR', `[unhandledrejection] ${msg}`);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
