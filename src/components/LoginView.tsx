import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Loader2, Globe, Clock } from 'lucide-react';
import { DiscordIcon } from './icons/DiscordIcon';
import { SpainFlag, UsaFlag } from './icons/FlagIcons';
import logoImg from '../assets/logo.webp';
import { launcherActions, useLauncherStore, useT } from '../store/launcherStore';
import { validateMinecraftUsername, generateOfflineUuid } from '../services/offlineAuth';
import { loginWithCrystalTides } from '../services/crystalAuthService';

const YoutubeIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const LoginView: React.FC = () => {
  const language = useLauncherStore((s) => s.language);
  const t = useT();
  const [authMode, setAuthMode] = useState<'offline' | 'crystaltides'>('offline');
  const [username, setUsername] = useState('');
  const [rememberAccount, setRememberAccount] = useState(true);

  // CrystalTides Web Account state
  const [crystalEmail, setCrystalEmail] = useState('');
  const [crystalPassword, setCrystalPassword] = useState('');

  type ActiveLogin = 'offline' | 'microsoft' | 'crystaltides' | null;
  const [activeLogin, setActiveLogin] = useState<ActiveLogin>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Microsoft OAuth Login flow
  const handleMicrosoftLogin = async () => {
    try {
      setActiveLogin('microsoft');
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
      setErrorMsg(e instanceof Error ? e.message : t.login.msLoginError);
    } finally {
      setActiveLogin(null);
    }
  };

  // Direct login / Offline username login (No-Premium)
  const handleDirectLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const val = validateMinecraftUsername(username);
    if (!val.valid) {
      setErrorMsg(val.error ?? t.login.invalidUsername);
      return;
    }

    try {
      setActiveLogin('offline');
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

      await launcherActions.addAccount(userAccount, rememberAccount);
    } catch {
      setErrorMsg(t.login.saveAccountError);
    } finally {
      setActiveLogin(null);
    }
  };

  // CrystalTides SMP Official Web Account Login
  const handleCrystalLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    try {
      setActiveLogin('crystaltides');
      setErrorMsg(null);

      const profile = await loginWithCrystalTides(crystalEmail, crystalPassword);

      await launcherActions.addAccount(
        {
          id: profile.id,
          username: profile.username,
          uuid: profile.uuid,
          role: profile.role,
          email: profile.email,
          skinUrl: profile.skinUrl,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          type: 'crystaltides',
          lastUsed: Date.now(),
        },
        rememberAccount,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.login.crystalLoginError);
    } finally {
      setActiveLogin(null);
    }
  };

  return (
    <div className="login-screen-wrapper">
      {/* Centered Login Card */}
      <div className="login-card-container">
        {/* Close button on top-right of card */}
        {authMode === 'crystaltides' && (
          <button
            className="login-card-close"
            title="Volver"
            onClick={() => {
              setAuthMode('offline');
              setErrorMsg(null);
            }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        )}

        {/* Error banner if any */}
        {errorMsg && <div className="login-error-alert">{errorMsg}</div>}

        {authMode === 'offline' ? (
          <>
            {/* Card Header with Title and Language Toggle */}
            <div className="login-header-text">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <h1 className="login-main-title">CrystalTides</h1>
                <div
                  className="login-lang-segmented"
                  role="group"
                  aria-label="Selector de idioma / Language selector"
                >
                  <button
                    type="button"
                    onClick={() => launcherActions.setLanguage('es')}
                    className={`login-lang-btn ${language === 'es' ? 'active' : ''}`}
                    title={t.login.langSpanish}
                    aria-label={t.login.langSpanish}
                  >
                    <SpainFlag size={14} />
                    <span>ES</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setLanguage('en')}
                    className={`login-lang-btn ${language === 'en' ? 'active' : ''}`}
                    title={t.login.langEnglish}
                    aria-label={t.login.langEnglish}
                  >
                    <UsaFlag size={14} />
                    <span>EN</span>
                  </button>
                </div>
              </div>
              <p className="login-sub-title">
                {t.login.subTitlePrefix}{' '}
                <span className="login-link-highlight">{t.login.subTitleHighlight}</span>{' '}
                {t.login.subTitleSuffix}
              </p>
            </div>

            {/* Offline Form (Zero password field) */}
            <form onSubmit={handleDirectLogin} className="login-inputs-form">
              <div className="login-fields-col">
                <input
                  type="text"
                  placeholder={t.login.nicknamePlaceholder}
                  aria-label={t.login.nicknameAria}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-text-input"
                  maxLength={16}
                />
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
                <span className="login-checkbox-text">{t.login.rememberNickname}</span>
              </label>

              {/* Solid Green Continue Button */}
              <button type="submit" disabled={Boolean(activeLogin)} className="login-continue-btn">
                {activeLogin === 'offline' ? (
                  <Loader2 className="login-btn-spinner" />
                ) : (
                  <>
                    {t.login.playBtn}{' '}
                    <ArrowRight style={{ width: '16px', height: '16px', strokeWidth: 2.5 }} />
                  </>
                )}
              </button>
            </form>

            {/* OR Divider */}
            <div className="login-or-divider">
              <div className="login-divider-bar" />
              <span className="login-divider-label">{t.login.orDivider}</span>
              <div className="login-divider-bar" />
            </div>

            {/* Social / Connected Accounts Options */}
            <div className="login-oauth-options">
              {/* CrystalTides Login with Octopus Mascot (Deshabilitado: Próximamente) */}
              <button
                type="button"
                aria-label={`${t.login.crystalLoginTitle} - ${t.login.crystalComingSoon}`}
                title={t.login.crystalComingSoonTooltip}
                disabled
                className="login-crystaltides-box disabled"
              >
                <img src={logoImg} alt="Octopus Mascot" className="ct-box-logo" />
                <div className="ct-box-labels">
                  <span className="ct-box-sub">{t.login.officialAccount}</span>
                  <span className="ct-box-title">{t.login.crystalLoginTitle}</span>
                </div>
                <span className="ct-coming-soon-badge">
                  <Clock style={{ width: '10px', height: '10px', strokeWidth: 2.5 }} />
                  <span>{t.login.crystalComingSoon}</span>
                </span>
              </button>

              {/* Microsoft Login Box */}
              <button
                type="button"
                aria-label="Iniciar sesión con Microsoft"
                onClick={handleMicrosoftLogin}
                disabled={Boolean(activeLogin)}
                className={`login-microsoft-box ${activeLogin === 'microsoft' ? 'loading' : ''}`}
              >
                {activeLogin === 'microsoft' ? (
                  <div className="ms-loading-indicator">
                    <Loader2 className="login-btn-spinner" style={{ color: '#00a4ef' }} />
                  </div>
                ) : (
                  <div className="ms-icon-grid">
                    <span style={{ backgroundColor: '#f25022' }} />
                    <span style={{ backgroundColor: '#7fba00' }} />
                    <span style={{ backgroundColor: '#00a4ef' }} />
                    <span style={{ backgroundColor: '#ffb900' }} />
                  </div>
                )}
                <div className="ms-box-labels">
                  <span className="ms-box-sub">
                    {activeLogin === 'microsoft' ? t.login.msConnecting : t.login.loginWith}
                  </span>
                  <span className="ms-box-title">
                    {activeLogin === 'microsoft' ? t.login.msLoggingIn : t.login.microsoftTitle}
                  </span>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* CrystalTides SMP Official Web Login View */}
            <div
              className="login-header-text"
              style={{ alignItems: 'center', textAlign: 'center', position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0 }}>
                <div
                  className="login-lang-segmented"
                  role="group"
                  aria-label="Selector de idioma / Language selector"
                >
                  <button
                    type="button"
                    onClick={() => launcherActions.setLanguage('es')}
                    className={`login-lang-btn ${language === 'es' ? 'active' : ''}`}
                    title={t.login.langSpanish}
                    aria-label={t.login.langSpanish}
                  >
                    <SpainFlag size={14} />
                    <span>ES</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setLanguage('en')}
                    className={`login-lang-btn ${language === 'en' ? 'active' : ''}`}
                    title={t.login.langEnglish}
                    aria-label={t.login.langEnglish}
                  >
                    <UsaFlag size={14} />
                    <span>EN</span>
                  </button>
                </div>
              </div>
              <img
                src={logoImg}
                alt="Octopus Mascot"
                style={{
                  width: '38px',
                  height: '38px',
                  objectFit: 'contain',
                  marginBottom: '4px',
                  filter: 'drop-shadow(0 2px 10px rgba(0, 229, 255, 0.6))',
                }}
              />
              <h1 className="login-main-title" style={{ fontSize: '22px' }}>
                CrystalTides SMP
              </h1>
              <p className="login-sub-title">
                {t.login.crystalSubTitlePrefix}{' '}
                <span className="login-link-highlight" style={{ color: '#00e5ff' }}>
                  crystaltidessmp.net
                </span>
              </p>
            </div>

            <form onSubmit={handleCrystalLogin} className="login-inputs-form">
              <div className="login-fields-col">
                <input
                  type="email"
                  placeholder={t.login.crystalEmailPlaceholder}
                  aria-label={t.login.crystalEmailPlaceholder}
                  value={crystalEmail}
                  onChange={(e) => setCrystalEmail(e.target.value)}
                  className="login-text-input"
                  required
                />

                <input
                  type="password"
                  placeholder={t.login.crystalPasswordPlaceholder}
                  aria-label={t.login.crystalPasswordPlaceholder}
                  value={crystalPassword}
                  onChange={(e) => setCrystalPassword(e.target.value)}
                  className="login-text-input"
                  required
                />
              </div>

              {/* Remember Account Checkbox */}
              <label htmlFor="login-remember-crystal" className="login-checkbox-label">
                <input
                  id="login-remember-crystal"
                  type="checkbox"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                  className="login-custom-checkbox"
                />
                <span className="login-checkbox-text">{t.login.rememberCrystal}</span>
              </label>

              {/* Cyan Glowing CrystalTides Submit Button */}
              <button type="submit" disabled={Boolean(activeLogin)} className="login-crystal-btn">
                {activeLogin === 'crystaltides' ? (
                  <Loader2 className="login-btn-spinner" />
                ) : (
                  <>
                    {t.login.crystalConnectBtn}{' '}
                    <ArrowRight style={{ width: '16px', height: '16px', strokeWidth: 2.5 }} />
                  </>
                )}
              </button>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  marginTop: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('offline');
                    setErrorMsg(null);
                  }}
                  className="login-back-btn"
                >
                  <ArrowLeft style={{ width: '14px', height: '14px' }} /> {t.login.backToOffline}
                </button>
              </div>
            </form>
          </>
        )}
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
          href="https://discord.gg/TDmwYNnvyT"
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
