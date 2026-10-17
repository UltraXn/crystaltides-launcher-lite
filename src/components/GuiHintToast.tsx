import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Check, Move } from 'lucide-react';
import { useLauncherStore, launcherActions, LauncherState } from '../store/launcherStore';

export type ToastMode = 'hint' | 'editing_active' | 'editing_saved';

/**
 * Duraciones de auto-desaparición investigadas según estándares de UX/HCI:
 * - WCAG 2.2 (SC 2.2.1: Timing Adjustable & SC 2.2.4: Postponements)
 * - Tasa media de lectura cognitiva para adultos (~260-280ms por palabra/token)
 * - Latencia de fijación y percepción periférica (~1000-1200ms)
 * - Ley de Fitts / Hick: Buffer de decisión y acción motora para atajos (F8, Esc)
 */
export function getToastDuration(mode: ToastMode): number {
  switch (mode) {
    case 'editing_saved':
      // 4 palabras, confirmación pasiva: 1000ms base + 1200ms lectura + 800ms buffer = 3000ms
      return 3000;
    case 'editing_active':
      // 8 palabras/tokens interactivos (F8, Esc): 1200ms base + 2300ms lectura + 1500ms decisión motora = 5000ms
      return 5000;
    case 'hint':
    default:
      // Hint inicial en Home: 1200ms base + 2100ms lectura + 1700ms descubrimiento = 5000ms
      return 5000;
  }
}

function getToastAccentColor(mode: ToastMode): string {
  if (mode === 'editing_saved') return '#4ade80';
  if (mode === 'editing_active') return '#38bdf8';
  return '#00e5ff';
}

function getToastInfo(mode: ToastMode) {
  if (mode === 'editing_saved') {
    return { title: 'Disposición Guardada', subtitle: 'Cambios aplicados' };
  }
  if (mode === 'editing_active') {
    return { title: 'Modo Edición', subtitle: 'Arrastra botones libremente' };
  }
  return { title: 'Personalizar GUI', subtitle: 'Mueve y escala botones' };
}

function useGuiHintToast() {
  const currentView = useLauncherStore((s: LauncherState) => s.currentView);
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const hudManualSide = useLauncherStore((s: LauncherState) => s.hudManualSide);

  const [toastMode, setToastMode] = useState<ToastMode | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const prevEditingRef = useRef<boolean>(isEditingHud);
  const initialMountedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingMsRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  const triggerDismiss = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setIsDismissing(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setToastMode(null);
      setIsDismissing(false);
    }, 240);
  }, []);

  useEffect(() => {
    if (currentView !== 'home' || initialMountedRef.current) return;
    initialMountedRef.current = true;
    const timer = setTimeout(() => {
      setToastMode((prev) => prev ?? 'hint');
    }, 1000);
    return () => clearTimeout(timer);
  }, [currentView]);

  useEffect(() => {
    if (prevEditingRef.current !== isEditingHud) {
      setIsDismissing(false);
      if (!isEditingHud && prevEditingRef.current) {
        setToastMode('editing_saved');
      } else {
        setToastMode(null);
      }
      prevEditingRef.current = isEditingHud;
    }
  }, [isEditingHud]);

  useEffect(() => {
    if (!toastMode || isDismissing) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }

    const duration = getToastDuration(toastMode);
    remainingMsRef.current = duration;
    startTimeRef.current = Date.now();

    if (!isHoveredRef.current) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(triggerDismiss, duration);
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [toastMode, isDismissing, triggerDismiss]);

  const handleMouseEnter = useCallback(() => {
    if (isDismissing) return;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const elapsed = Date.now() - startTimeRef.current;
    remainingMsRef.current = Math.max(1200, remainingMsRef.current - elapsed);
    setIsHovered(true);
  }, [isDismissing]);

  const handleMouseLeave = useCallback(() => {
    if (isDismissing) return;
    setIsHovered(false);
    startTimeRef.current = Date.now();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(triggerDismiss, remainingMsRef.current);
  }, [isDismissing, triggerDismiss]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  return {
    toastMode,
    isDismissing,
    isHovered,
    isEditingHud,
    currentView,
    dockConfig,
    hudManualSide,
    triggerDismiss,
    handleMouseEnter,
    handleMouseLeave,
  };
}

const ToastIconBadge: React.FC<{ mode: ToastMode; accentColor: string }> = ({
  mode,
  accentColor,
}) => {
  return (
    <div
      className="capsule-icon-badge"
      style={{
        background: `${accentColor}18`,
        border: `1px solid ${accentColor}40`,
        color: accentColor,
      }}
    >
      {mode === 'editing_saved' && <Check size={12} strokeWidth={2.8} />}
      {mode === 'editing_active' && (
        <Move size={12} strokeWidth={2.2} className="capsule-icon-pulse" />
      )}
      {mode === 'hint' && <Sparkles size={12} strokeWidth={2.2} />}
    </div>
  );
};

const ToastActionButton: React.FC<{
  mode: ToastMode;
  onDismiss: () => void;
}> = ({ mode, onDismiss }) => {
  if (mode === 'editing_saved') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="capsule-keycap-btn"
        title="Aceptar y cerrar notificación"
      >
        <kbd className="hud-keycap accent-green">OK</kbd>
      </button>
    );
  }

  if (mode === 'editing_active') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          launcherActions.setEditingHud(false);
        }}
        className="capsule-keycap-btn"
        title="Guardar cambios y salir (F8 o Esc)"
      >
        <kbd className="hud-keycap accent-cyan">F8</kbd>
        <span className="capsule-or">o</span>
        <kbd className="hud-keycap">Esc</kbd>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        launcherActions.setEditingHud(true);
        onDismiss();
      }}
      className="capsule-keycap-btn"
      title="Abrir editor de botones (F8)"
    >
      <kbd className="hud-keycap accent-cyan">F8</kbd>
    </button>
  );
};

export const GuiHintToast: React.FC = () => {
  const {
    toastMode,
    isDismissing,
    isHovered,
    currentView,
    triggerDismiss,
    handleMouseEnter,
    handleMouseLeave,
  } = useGuiHintToast();

  if (!toastMode || currentView !== 'home') return null;

  const accentColor = getToastAccentColor(toastMode);
  const topPos = '64px';
  const info = getToastInfo(toastMode);
  const duration = getToastDuration(toastMode);

  return (
    <output
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`dynamic-capsule-toast ${isDismissing ? 'dismissing' : ''}`}
      style={{
        top: topPos,
        borderColor: `${accentColor}40`,
        boxShadow: `0 12px 32px rgba(0, 0, 0, 0.7), 0 0 20px ${accentColor}25, inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
      }}
    >
      <ToastIconBadge mode={toastMode} accentColor={accentColor} />

      <div className="capsule-content">
        <span className="capsule-title">{info.title}</span>
        <span className="capsule-dot">•</span>
        <span className="capsule-subtitle">{info.subtitle}</span>
      </div>

      <ToastActionButton mode={toastMode} onDismiss={triggerDismiss} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          triggerDismiss();
        }}
        className="capsule-close-btn"
        title="Cerrar notificación"
      >
        <X size={12} strokeWidth={2.5} />
      </button>

      {/* Barra de progreso de auto-desaparición (feedback visual UX / WCAG 2.2) */}
      <div
        key={toastMode}
        className="capsule-timer-bar"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}70)`,
          animationDuration: `${duration}ms`,
          animationPlayState: isHovered ? 'paused' : 'running',
        }}
      />
    </output>
  );
};
