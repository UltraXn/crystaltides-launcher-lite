import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CrashReportModal } from '../CrashReportModal';
import { useLauncherStore } from '../../../store/launcherStore';
import { translations } from '../../../i18n';
import * as crashDoctorService from '../../../services/crashDoctorService';

vi.mock('../../../services/crashDoctorService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/crashDoctorService')>(
    '../../../services/crashDoctorService'
  );
  return {
    ...actual,
    fixOffendingMod: vi.fn().mockResolvedValue('Mod desactivado correctamente'),
    resetOptionsTxt: vi.fn().mockResolvedValue('Opciones restablecidas'),
    submitCrashTelemetry: vi.fn().mockResolvedValue(true),
  };
});

describe('CrashReportModal i18n & Telemetry Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLauncherStore.setState({ language: 'es' });
  });

  it('renderiza todos los textos en español cuando el idioma es "es"', () => {
    useLauncherStore.setState({ language: 'es' });
    const t = translations.es.crashModal;

    render(
      <CrashReportModal
        isOpen={true}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        exitCode={1}
        crashReason="Fallo de prueba"
        crashDetails="Detalles de prueba"
      />
    );

    expect(screen.getByText(t.title)).toBeDefined();
    expect(screen.getByText(t.doctorBadge)).toBeDefined();
    expect(screen.getByText(t.exitCodeBadge.replace('{code}', '1'))).toBeDefined();
    expect(screen.getByText(t.retry)).toBeDefined();
    expect(screen.getByText(t.copyReport)).toBeDefined();
    expect(screen.getByText(t.viewLogs)).toBeDefined();
    expect(screen.getByText(t.sendReport)).toBeDefined();
  });

  it('renderiza todos los textos en inglés de forma 100% simétrica cuando el idioma es "en"', () => {
    useLauncherStore.setState({ language: 'en' });
    const t = translations.en.crashModal;

    render(
      <CrashReportModal
        isOpen={true}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        exitCode={1}
        crashReason="Test crash"
        crashDetails="Test details"
      />
    );

    expect(screen.getByText(t.title)).toBeDefined();
    expect(screen.getByText(t.doctorBadge)).toBeDefined();
    expect(screen.getByText(t.exitCodeBadge.replace('{code}', '1'))).toBeDefined();
    expect(screen.getByText(t.retry)).toBeDefined();
    expect(screen.getByText(t.copyReport)).toBeDefined();
    expect(screen.getByText(t.viewLogs)).toBeDefined();
    expect(screen.getByText(t.sendReport)).toBeDefined();
  });

  it('envía telemetría de crash y actualiza el estado del botón a reporte enviado preservando el crashType real', async () => {
    render(
      <CrashReportModal
        isOpen={true}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        exitCode={42}
        crashReason="Critical Driver Failure"
        crashDetails="Stack trace at driver.dll"
        crashType="GRAPHICS_DRIVER"
      />
    );

    const sendBtn = screen.getByText(translations.es.crashModal.sendReport);
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(crashDoctorService.submitCrashTelemetry).toHaveBeenCalledTimes(1);
      expect(crashDoctorService.submitCrashTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          crash_type: 'GRAPHICS_DRIVER',
          title: 'Critical Driver Failure',
        }),
        42
      );
    });

    await waitFor(() => {
      expect(screen.getByText(translations.es.crashModal.reportSent)).toBeDefined();
    });
  });

  it('copia el reporte al portapapeles con formato estructurado e i18n', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <CrashReportModal
        isOpen={true}
        onClose={vi.fn()}
        onRetry={vi.fn()}
        exitCode={1}
        crashReason="Fallo de memoria"
        crashDetails="OutOfMemoryError"
      />
    );

    const copyBtn = screen.getAllByRole('button', { name: new RegExp(translations.es.crashModal.copyReport, 'i') })[0];
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('[CrystalTides Crash Report]')
    );
  });
});
