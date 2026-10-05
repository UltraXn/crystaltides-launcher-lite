import React from 'react';
import { X, Sparkles, Heart, Globe } from 'lucide-react';
import { DiscordIcon } from '../icons/DiscordIcon';
import { useLauncherStore, launcherActions, LauncherState, useT } from '../../store/launcherStore';

export const AboutModal: React.FC = () => {
  const t = useT();
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);

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
      <div
        className="papyrus-about-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        {/* Close Button on Top Right */}
        <button
          type="button"
          onClick={launcherActions.closeModal}
          className="settings-card-close"
          title={t.settings.close}
          aria-label={t.settings.close}
        >
          <X style={{ width: '16px', height: '16px' }} />
        </button>

        {/* Title */}
        <div className="settings-header-block">
          <h2 id="about-modal-title" className="settings-main-title">
            {t.about.title}
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-inter)' }}>
            {t.about.tagline}
          </p>
        </div>

        {/* Highlight Card */}
        <div className="about-highlight-box">
          <div className="about-highlight-title">
            <Sparkles style={{ width: '16px', height: '16px', color: '#22c55e' }} />
            <span>{t.about.highlightTitle}</span>
          </div>
          <p className="about-highlight-desc">
            {t.about.highlightDesc}
          </p>
        </div>

        {/* System Specs Grid */}
        <div className="about-specs-grid">
          <div className="spec-tile">
            <span className="spec-title">{t.about.specEngine}</span>
            <span className="spec-value">Tauri v2 + React 19</span>
          </div>
          <div className="spec-tile">
            <span className="spec-title">{t.about.specSecurity}</span>
            <span className="spec-value green">AES-256-GCM</span>
          </div>
          <div className="spec-tile">
            <span className="spec-title">{t.about.specServer}</span>
            <span className="spec-value">mc.crystaltidessmp.net</span>
          </div>
          <div className="spec-tile">
            <span className="spec-title">{t.about.specVersion}</span>
            <span className="spec-value">1.0.0-lite</span>
          </div>
        </div>

        {/* Footer info & Links */}
        <div className="about-footer-row">
          <span className="about-credit-text">
            {t.about.developedWith}{' '}
            <Heart
              style={{
                width: '12px',
                height: '12px',
                color: '#f43f5e',
                fill: '#f43f5e',
                display: 'inline',
              }}
            />{' '}
            {t.about.forCommunity}
          </span>

          <div className="about-footer-links">
            <a
              href="https://discord.gg/crystaltides"
              target="_blank"
              rel="noreferrer"
              className="about-link-icon"
              title="Discord"
            >
              <DiscordIcon style={{ width: '14px', height: '14px' }} />
            </a>
            <a
              href="https://crystaltidessmp.net"
              target="_blank"
              rel="noreferrer"
              className="about-link-icon"
              title="Website"
            >
              <Globe style={{ width: '14px', height: '14px' }} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
