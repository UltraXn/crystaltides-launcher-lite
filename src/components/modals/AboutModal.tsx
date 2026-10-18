import React, { useState, useEffect, useMemo } from 'react';
import { X, Globe } from 'lucide-react';
import { DiscordIcon } from '../icons/DiscordIcon';
import { useLauncherStore, launcherActions, LauncherState, useT } from '../../store/launcherStore';
import { checkForAppUpdates } from '../../services/updateService';

function getOperatingSystem(): string {
  if (typeof navigator === 'undefined') return 'Windows 11';
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows 11';
  if (ua.includes('Mac')) return 'macOS Sonoma';
  if (ua.includes('Linux')) return 'Linux x86_64';
  return 'Desktop Client';
}

function getFormattedClientDate(lang: string): string {
  try {
    const now = new Date();
    const locale = lang === 'en' ? 'en-US' : 'es-ES';
    const dateStr = now.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    const tzOffset = -now.getTimezoneOffset() / 60;
    const gmt = `(GMT${tzOffset >= 0 ? `+${tzOffset}` : tzOffset})`;
    return `${capitalized} ${gmt}`;
  } catch {
    return '2026';
  }
}

export const AboutModal: React.FC = () => {
  const t = useT();
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const language = useLauncherStore((s: LauncherState) => s.language);
  const [appVersion, setAppVersion] = useState<string>('0.1.2');

  useEffect(() => {
    let isMounted = true;
    checkForAppUpdates()
      .then((info) => {
        if (!isMounted) return;
        setAppVersion(info.currentVersion || '0.1.2');
      })
      .catch(() => {
        if (!isMounted) return;
        setAppVersion('0.1.2');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const formattedDate = useMemo(() => getFormattedClientDate(language), [language]);
  const systemOs = useMemo(() => getOperatingSystem(), []);

  if (activeModal !== 'about') return null;

  return (
    <div className="papyrus-modal-overlay">
      <button
        type="button"
        aria-label={t.settings.close}
        tabIndex={-1}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
        onClick={launcherActions.closeModal}
      />
      <dialog
        open
        className="papyrus-about-card"
        aria-labelledby="about-modal-title"
        style={{ color: 'inherit' }}
      >
        {/* Header: Title and Close */}
        <div className="about-header-row">
          <h2 id="about-modal-title" className="about-modal-title">
            {t.about.title}
          </h2>
          <button
            type="button"
            onClick={launcherActions.closeModal}
            className="settings-card-close"
            title={t.settings.close}
            aria-label={t.settings.close}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Report a Bug Button */}
        <div>
          <a
            href="https://crystaltidessmp.net/support"
            target="_blank"
            rel="noreferrer"
            className="about-bug-btn"
          >
            {t.about.reportBug}
          </a>
        </div>

        {/* Copyright & Disclaimer */}
        <div className="about-legal-block">
          <div className="about-legal-copyright">{t.about.copyright}</div>
          <div className="about-legal-disclaimer">{t.about.disclaimer}</div>
        </div>

        {/* APP Section */}
        <div className="about-section">
          <h3 className="about-section-heading">{t.about.sectionApp}</h3>
          <div className="about-section-list">
            <div>{systemOs}</div>
            <div>{formattedDate}</div>
            <div>{t.about.launcherVersion.replace('{version}', appVersion)}</div>
            <div>{t.about.engine}</div>
            <div>{t.about.runtime}</div>
            <div>{t.about.arch}</div>
          </div>
        </div>

        {/* UI Section */}
        <div className="about-section">
          <h3 className="about-section-heading">{t.about.sectionUi}</h3>
          <div className="about-section-list">
            <div>{t.about.uiSystem}</div>
          </div>
        </div>

        {/* Tagline */}
        <div className="about-tagline">{t.about.tagline}</div>

        {/* Footer Links */}
        <div className="about-footer-row">
          <a
            href="https://discord.gg/TDmwYNnvyT"
            target="_blank"
            rel="noreferrer"
            className="about-link-icon"
            title={t.about.openDiscord}
            aria-label={t.about.openDiscord}
          >
            <DiscordIcon style={{ width: '14px', height: '14px' }} />
          </a>
          <a
            href="https://crystaltidessmp.net"
            target="_blank"
            rel="noreferrer"
            className="about-link-icon"
            title={t.about.openWebsite}
            aria-label={t.about.openWebsite}
          >
            <Globe style={{ width: '14px', height: '14px' }} />
          </a>
        </div>
      </dialog>
    </div>
  );
};
