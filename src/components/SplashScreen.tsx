import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo.png';

export const SplashScreen: React.FC = () => {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Iniciando subsistemas...');

  useEffect(() => {
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
      setStatusText('Listo.');
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0A090E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Background Ambient Radial Glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(45, 212, 191, 0.05) 50%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Brand Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
          animation: 'fadeIn 0.6s ease-out forwards',
        }}
      >
        {/* CrystalTides Official Logo */}
        <div
          style={{
            position: 'relative',
            width: '110px',
            height: '110px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 70%)',
              filter: 'blur(16px)',
            }}
          />
          <img
            src={logoImg}
            alt="CrystalTides Logo"
            style={{
              width: '100px',
              height: '100px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.45))',
              position: 'relative',
              zIndex: 1,
              userSelect: 'none',
            }}
          />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            margin: '0 0 6px 0',
            background: 'linear-gradient(135deg, #F8FAFC 0%, #BAE6FD 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'var(--font-outfit, sans-serif)',
          }}
        >
          CrystalTides
        </h1>

        <span
          style={{
            fontSize: '12px',
            color: 'rgba(248, 250, 252, 0.5)',
            fontWeight: 500,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: '36px',
          }}
        >
          Lite Edition
        </span>

        {/* Progress Bar Container */}
        <div
          style={{
            width: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #2dd4bf 0%, #38bdf8 100%)',
                borderRadius: '4px',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.6)',
              }}
            />
          </div>

          {/* Dynamic Status Text */}
          <span
            style={{
              fontSize: '11px',
              color: 'rgba(248, 250, 252, 0.6)',
              fontFamily: 'var(--font-inter, sans-serif)',
              height: '16px',
              textAlign: 'center',
            }}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          fontSize: '11px',
          color: 'rgba(248, 250, 252, 0.3)',
          letterSpacing: '0.2px',
        }}
      >
        CrystalTides Studio • High Performance Client
      </div>
    </div>
  );
};
