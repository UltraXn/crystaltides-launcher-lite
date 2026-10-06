import React, { useState } from 'react';
import { X, ArrowRight, Loader2, Globe } from 'lucide-react';
import { DiscordIcon } from './icons/DiscordIcon';
import { launcherActions } from '../store/launcherStore';
import { validateMinecraftUsername, generateOfflineUuid } from '../services/offlineAuth';

const YoutubeIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const LoginView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberAccount, setRememberAccount] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Microsoft OAuth Login flow
  const handleMicrosoftLogin = async () => {
    try {
      setIsLoggingIn(true);
      setErrorMsg(null);

      // Try real Microsoft OAuth authentication via Tauri backend
      try {
        const { loginMicrosoftRedirect } = await import('../services/microsoftAuthService');
        const authResult = await loginMicrosoftRedirect();
        if (authResult?.username && authResult?.uuid) {
          await launcherActions.addAccount({
            id: `ms_${authResult.uuid}`,
            username: authResult.username,
            uuid: authResult.uuid,
            accessToken: authResult.accessToken,
            refreshToken: authResult.refreshToken,
            type: 'microsoft',
            lastUsed: Date.now(),
          });
          return;
        }
      } catch (tauriErr: unknown) {
        console.warn('[Login] Tauri Microsoft Auth:', tauriErr);
        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
          throw tauriErr;
        }
      }

      // Simulated OAuth login for browser preview mode only
      await new Promise((r) => setTimeout(r, 700));
      await launcherActions.addAccount({
        id: `ms_${Date.now()}`,
        username: 'UltraXn',
        uuid: '853c80ef-3c37-49fd-aa49-938b674adae6',
        type: 'microsoft',
        lastUsed: Date.now(),
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al iniciar sesión con Microsoft.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Direct login / Offline username login (No-Premium)
  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateMinecraftUsername(username);
    if (!val.valid) {
      setErrorMsg(val.error || 'Por favor, introduce un nombre de usuario válido (3 a 16 caracteres).');
      return;
    }

    try {
      setIsLoggingIn(true);
      setErrorMsg(null);

      const cleanName = username.trim();
      const offlineUuid = generateOfflineUuid(cleanName);

      const userAccount = {
        id: `guest_${cleanName.toLowerCase()}`,
        username: cleanName,
        uuid: offlineUuid,
        type: 'guest' as const,
        lastUsed: Date.now(),
      };

      await launcherActions.addAccount(userAccount);
    } catch {
      setErrorMsg('Error al guardar la cuenta.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      {/* Centered Login Card */}
      <div className="login-card-container">
        {/* Close button on top-right of card */}
        <button className="login-card-close" title="Close">
          <X style={{ width: '16px', height: '16px' }} />
        </button>

        {/* Card Header */}
        <div className="login-header-text">
          <h1 className="login-main-title">CrystalTides</h1>
          <p className="login-sub-title">
            Inicia sesión con tu apodo <span className="login-link-highlight">No-Premium</span> o Microsoft
          </p>
        </div>

        {/* Error banner if any */}
        {errorMsg && <div className="login-error-alert">{errorMsg}</div>}

        {/* Credentials Form */}
        <form onSubmit={handleDirectLogin} className="login-inputs-form">
          <div className="login-fields-col">
            <input
              type="text"
              placeholder="Tu Apodo / Nickname (No-Premium)"
              aria-label="Tu Apodo o Nickname (No-Premium)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-text-input"
              maxLength={16}
            />

            <input
              type="password"
              placeholder="Contraseña (Opcional)"
              aria-label="Contraseña (Opcional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-text-input"
            />
          </div>

          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '-4px', textAlign: 'left' }}>
            Modo Offline / No-Premium activo (No requiere contraseña para ingresar).
          </div>

          {/* Remember Account Checkbox */}
          <label htmlFor="login-remember-account" className="login-checkbox-label">
            <input
              id="login-remember-account"
              type="checkbox"
              checked={rememberAccount}
              onChange={(e) => setRememberAccount(e.target.checked)}
              className="login-custom-checkbox"
            />
            <span className="login-checkbox-text">Recordar este apodo.</span>
          </label>

          {/* Solid Green Continue Button */}
          <button type="submit" disabled={isLoggingIn} className="login-continue-btn">
            {isLoggingIn ? (
              <Loader2 className="login-btn-spinner" />
            ) : (
              <>
                Entrar a Jugar <ArrowRight style={{ width: '16px', height: '16px', strokeWidth: 2.5 }} />
              </>
            )}
          </button>
        </form>

        {/* OR Divider */}
        <div className="login-or-divider">
          <div className="login-divider-bar" />
          <span className="login-divider-label">OR</span>
          <div className="login-divider-bar" />
        </div>

        {/* Large Microsoft Login Box */}
        <button
          type="button"
          aria-label="Iniciar sesión con Microsoft"
          onClick={handleMicrosoftLogin}
          disabled={isLoggingIn}
          className="login-microsoft-box"
        >
          <div className="ms-icon-grid">
            <span style={{ backgroundColor: '#f25022' }} />
            <span style={{ backgroundColor: '#7fba00' }} />
            <span style={{ backgroundColor: '#00a4ef' }} />
            <span style={{ backgroundColor: '#ffb900' }} />
          </div>
          <div className="ms-box-labels">
            <span className="ms-box-sub">Login with:</span>
            <span className="ms-box-title">Microsoft</span>
          </div>
        </button>
      </div>

      {/* Bottom Socials: YouTube, Discord, Web */}
      <footer className="login-bottom-socials">
        <a
          href="https://youtube.com"
          target="_blank"
          rel="noreferrer"
          className="login-social-icon"
          title="YouTube"
        >
          <YoutubeIcon style={{ width: '18px', height: '18px' }} />
        </a>
        <a
          href="https://discord.gg/crystaltides"
          target="_blank"
          rel="noreferrer"
          className="login-social-icon"
          title="Discord"
        >
          <DiscordIcon style={{ width: '16px', height: '16px' }} />
        </a>
        <a
          href="https://crystaltidessmp.net"
          target="_blank"
          rel="noreferrer"
          className="login-social-icon"
          title="Website"
        >
          <Globe style={{ width: '18px', height: '18px' }} />
        </a>
      </footer>
    </div>
  );
};
