import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo.webp';
import { Cpu, Database, CheckCircle2, Sparkles, Compass, ShieldCheck } from 'lucide-react';

type MvpType = '1' | '2' | '3';

const PREVIEW_STEPS = [
  { p: 18, text: 'Inicializando subsistemas de red...' },
  { p: 48, text: 'Verificando entorno Java 21 y OpenJ9...' },
  { p: 82, text: 'Sincronizando perfiles y mods optimizados...' },
  { p: 100, text: 'Listo para sumergirse en CrystalTides.' },
];

function useMvpSelection(): [MvpType, (mvp: MvpType) => void] {
  const [activeMvp, setActiveMvp] = useState<MvpType>('1');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mvp');
    if (m === '1' || m === '2' || m === '3') {
      setActiveMvp(m);
    }
  }, []);

  const handleSelectMvp = (mvp: MvpType) => {
    setActiveMvp(mvp);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mvp', mvp);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return [activeMvp, handleSelectMvp];
}

function useSplashProgress(isPreview: boolean) {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Iniciando subsistemas...');

  useEffect(() => {
    if (!isPreview) {
      const timer1 = setTimeout(() => {
        setProgress(45);
        setStatusText('Verificando entorno de ejecución y Java...');
      }, 300);

      const timer2 = setTimeout(() => {
        setProgress(80);
        setStatusText('Cargando perfiles y configuración local...');
      }, 700);

      const timer3 = setTimeout(() => {
        setProgress(100);
        setStatusText('Listo para sumergirse en CrystalTides.');
      }, 1100);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }

    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % PREVIEW_STEPS.length;
      setProgress(PREVIEW_STEPS[step].p);
      setStatusText(PREVIEW_STEPS[step].text);
    }, 2200);

    return () => clearInterval(interval);
  }, [isPreview]);

  return { progress, statusText };
}

interface PreviewSwitcherProps {
  activeMvp: MvpType;
  onSelectMvp: (m: MvpType) => void;
}

const PreviewSwitcher: React.FC<PreviewSwitcherProps> = ({ activeMvp, onSelectMvp }) => {
  const options: { id: MvpType; label: string }[] = [
    { id: '1', label: 'MVP 1 • Abyssal Portal' },
    { id: '2', label: 'MVP 2 • Cinematic Horizon' },
    { id: '3', label: 'MVP 3 • Tactical Telemetry' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '9999px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#94a3b8',
          paddingLeft: '6px',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
        }}
      >
        Prototipos:
      </span>
      {options.map((opt) => {
        const isActive = activeMvp === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelectMvp(opt.id)}
            style={{
              background: isActive
                ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(45, 212, 191, 0.2) 100%)'
                : 'transparent',
              border: isActive
                ? '1px solid rgba(56, 189, 248, 0.6)'
                : '1px solid transparent',
              color: isActive ? '#38bdf8' : '#64748b',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};


interface MvpProps {
  progress: number;
  statusText: string;
}

const SplashMvp1: React.FC<MvpProps> = ({ progress, statusText }) => (
  <>
          {/* Ambient Multi-point Glow */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '580px',
              height: '580px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, rgba(45, 212, 191, 0.05) 45%, transparent 70%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
              animation: 'splashPulseGlow 4s ease-in-out infinite',
            }}
          />

          {/* Central Glassmorphic Portal Card */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              width: '420px',
              padding: '36px 32px 30px',
              background: 'rgba(10, 15, 24, 0.78)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: '1px solid rgba(56, 189, 248, 0.22)',
              borderRadius: '24px',
              boxShadow:
                '0 28px 64px rgba(0, 0, 0, 0.85), 0 0 32px rgba(56, 189, 248, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Logo with Bio-resonance Aura */}
            <div
              style={{
                position: 'relative',
                width: '104px',
                height: '104px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-10px',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, rgba(45, 212, 191, 0.1) 50%, transparent 70%)',
                  filter: 'blur(16px)',
                  animation: 'splashPulseGlow 3s ease-in-out infinite',
                }}
              />
              <img
                src={logoImg}
                alt="CrystalTides Logo"
                style={{
                  width: '94px',
                  height: '94px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 18px rgba(56, 189, 248, 0.5))',
                  position: 'relative',
                  zIndex: 2,
                }}
              />
            </div>

            {/* Title & Badge */}
            <h1
              style={{
                fontSize: '26px',
                fontWeight: 800,
                letterSpacing: '-0.4px',
                margin: '0 0 4px 0',
                background: 'linear-gradient(135deg, #ffffff 20%, #7dd3fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CrystalTides
            </h1>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                marginBottom: '28px',
              }}
            >
              <Sparkles size={11} strokeWidth={2.4} />
              <span>High Velocity Runtime</span>
            </div>

            {/* Progress Bar Container with Telemetry */}
            <div style={{ width: '100%', marginBottom: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  fontSize: '11px',
                }}
              >
                <span
                  style={{
                    color: '#94a3b8',
                    fontFamily: 'var(--font-inter, sans-serif)',
                    fontWeight: 500,
                    maxWidth: '280px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusText}
                </span>
                <span
                  style={{
                    color: '#38bdf8',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.2px',
                  }}
                >
                  {progress}%
                </span>
              </div>

              {/* Shimmering Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #2dd4bf 0%, #38bdf8 100%)',
                    borderRadius: '9999px',
                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 0 12px rgba(56, 189, 248, 0.7)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Travelling Light Shimmer */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '60px',
                      height: '100%',
                      background:
                        'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent)',
                      animation: 'splashShimmer 1.8s infinite',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Subsystem Pipeline Pills */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '10px',
                color: '#64748b',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: progress >= 20 ? '#4ade80' : '#64748b',
                }}
              >
                <CheckCircle2 size={11} strokeWidth={2.4} /> Motor Core
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: progress >= 50 ? '#4ade80' : '#64748b',
                }}
              >
                <CheckCircle2 size={11} strokeWidth={2.4} /> Java 21
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: progress >= 80 ? '#4ade80' : '#64748b',
                }}
              >
                <CheckCircle2 size={11} strokeWidth={2.4} /> Perfiles
              </span>
            </div>
          </div>
        </>
);

const SplashMvp2: React.FC<MvpProps> = ({ progress, statusText }) => (
  <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Bioluminescent Ocean Floor Gradient Wave */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '120vw',
              height: '420px',
              borderRadius: '50% 50% 0 0',
              background:
                'radial-gradient(ellipse at center, rgba(14, 165, 233, 0.22) 0%, rgba(20, 184, 166, 0.08) 50%, transparent 75%)',
              filter: 'blur(50px)',
              pointerEvents: 'none',
              animation: 'splashWaveDrift 5s ease-in-out infinite',
            }}
          />

          {/* Central Hero Composition */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 2,
            }}
          >
            {/* Hero Logo with Orbital Ring */}
            <div
              style={{
                position: 'relative',
                width: '130px',
                height: '130px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Spinning Orbital Ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-14px',
                  borderRadius: '50%',
                  border: '1px dashed rgba(56, 189, 248, 0.35)',
                  animation: 'splashOrbitSpin 20s linear infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, transparent 65%)',
                  filter: 'blur(18px)',
                }}
              />
              <img
                src={logoImg}
                alt="CrystalTides Logo"
                style={{
                  width: '110px',
                  height: '110px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 24px rgba(56, 189, 248, 0.6))',
                  position: 'relative',
                  zIndex: 2,
                }}
              />
            </div>

            {/* Cinematic Spaced Typography */}
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '5px',
                textTransform: 'uppercase',
                margin: '0 0 6px 0',
                background: 'linear-gradient(180deg, #ffffff 40%, #bae6fd 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CrystalTides
            </h1>

            <span
              style={{
                fontSize: '11px',
                letterSpacing: '3px',
                color: '#64748b',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: '40px',
              }}
            >
              The Abyssal Awakening
            </span>

            {/* Extended Slim Progress Line */}
            <div
              style={{
                width: '380px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '3px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #38bdf8 0%, #a7f3d0 100%)',
                    borderRadius: '9999px',
                    boxShadow: '0 0 16px rgba(56, 189, 248, 0.8)',
                    transition: 'width 0.4s ease-out',
                  }}
                />
              </div>

              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#94a3b8',
                }}
              >
                <span style={{ fontFamily: 'var(--font-inter, sans-serif)' }}>{statusText}</span>
                <span style={{ fontWeight: 700, color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
                  {progress}%
                </span>
              </div>
            </div>

            {/* Rotative Lore / Discovery Tip */}
            <div
              style={{
                marginTop: '36px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#cbd5e1',
                maxWidth: '460px',
              }}
            >
              <Compass size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
              <span>
                <strong>Tip de Exploración:</strong> Los arrecifes de cristal emiten pulsos que
                orientan a los navegantes en la oscuridad profunda.
              </span>
            </div>
          </div>
        </div>
);

const SplashMvp3: React.FC<MvpProps> = ({ progress, statusText }) => (
  <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '460px',
            background: 'rgba(13, 18, 26, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: '14px',
            padding: '24px 26px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '14px',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={logoImg} alt="Logo" style={{ width: '22px', height: '22px' }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.5px' }}>
                CRYSTALTIDES // BOOTLOADER
              </span>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#22c55e',
                background: 'rgba(34, 197, 94, 0.12)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              SYS_READY
            </span>
          </div>

          {/* Sequential Step Nodes */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '20px',
              fontSize: '11px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: progress >= 20 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${progress >= 20 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderRadius: '8px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <Cpu size={13} color="#38bdf8" /> 01 // RUNTIME ENGINE
              </span>
              <span style={{ color: progress >= 20 ? '#22c55e' : '#64748b', fontWeight: 700 }}>
                {progress >= 20 ? '[ONLINE]' : '[INIT...]'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: progress >= 50 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${progress >= 50 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderRadius: '8px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <ShieldCheck size={13} color="#38bdf8" /> 02 // JAVA VIRTUAL MACHINE
              </span>
              <span style={{ color: progress >= 50 ? '#22c55e' : '#64748b', fontWeight: 700 }}>
                {progress >= 50 ? '[HOTSPOT 21]' : '[PENDING]'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: progress >= 80 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${progress >= 80 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                borderRadius: '8px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <Database size={13} color="#38bdf8" /> 03 // CACHE & PROFILES
              </span>
              <span style={{ color: progress >= 80 ? '#22c55e' : '#64748b', fontWeight: 700 }}>
                {progress >= 80 ? '[SYNCED]' : '[WAITING]'}
              </span>
            </div>
          </div>

          {/* Segmented Tactical Progress Bar */}
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#94a3b8',
                marginBottom: '6px',
              }}
            >
              <span>{statusText}</span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>{progress}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                padding: '1px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'repeating-linear-gradient(45deg, #38bdf8, #38bdf8 6px, #0284c7 6px, #0284c7 12px)',
                  borderRadius: '2px',
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)',
                }}
              />
            </div>
          </div>

          {/* Hardware & Network Metrics Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#64748b',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span>MEM: 4096 MB</span>
            <span>SERVER: mc.crystaltidessmp.net</span>
            <span style={{ color: '#22c55e' }}>PING: 12ms</span>
          </div>
        </div>
);

const renderMvpView = (mvp: string, progress: number, statusText: string) => {
  if (mvp === '2') return <SplashMvp2 progress={progress} statusText={statusText} />;
  if (mvp === '3') return <SplashMvp3 progress={progress} statusText={statusText} />;
  return <SplashMvp1 progress={progress} statusText={statusText} />;
};

export const SplashScreen: React.FC = () => {
  const isPreview =
    typeof window !== 'undefined' && window.location.search.includes('preview=splash');
  const [activeMvp, handleSelectMvp] = useMvpSelection();
  const { progress, statusText } = useSplashProgress(isPreview);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#070a0e',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-jost, sans-serif)',
      }}
    >
      {isPreview && <PreviewSwitcher activeMvp={activeMvp} onSelectMvp={handleSelectMvp} />}
      {renderMvpView(activeMvp, progress, statusText)}
    </div>
  );
};
