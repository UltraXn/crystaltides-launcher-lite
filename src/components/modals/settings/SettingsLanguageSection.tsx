import React from 'react';
import { Check } from 'lucide-react';
import { launcherActions, useT } from '../../../store/launcherStore';
import { SpainFlag, UsaFlag } from '../../common/FlagIcons';

export interface SettingsLanguageSectionProps {
  language: string;
  t: ReturnType<typeof useT>;
}

export const SettingsLanguageSection: React.FC<SettingsLanguageSectionProps> = ({
  language,
  t,
}) => {
  return (
    <div className="settings-section">
      <span className="settings-label-title">{t.settings.languageTitle}</span>
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(248, 250, 252, 0.5)',
          margin: '2px 0 8px 0',
        }}
      >
        {t.settings.languageDesc}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => launcherActions.setLanguage('es')}
          className={`settings-action-btn ${language === 'es' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '7px 12px',
            borderRadius: '8px',
            border:
              language === 'es'
                ? '1px solid #16A085'
                : '1px solid rgba(255, 255, 255, 0.1)',
            background:
              language === 'es' ? 'rgba(22, 160, 133, 0.18)' : 'rgba(255, 255, 255, 0.04)',
            color: language === 'es' ? '#16A085' : 'rgba(248, 250, 252, 0.7)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition:
              'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          }}
        >
          <SpainFlag />
          <span>{t.settings.spanish}</span>
          {language === 'es' && <Check size={13} color="#16A085" />}
        </button>
        <button
          type="button"
          onClick={() => launcherActions.setLanguage('en')}
          className={`settings-action-btn ${language === 'en' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '7px 12px',
            borderRadius: '8px',
            border:
              language === 'en'
                ? '1px solid #16A085'
                : '1px solid rgba(255, 255, 255, 0.1)',
            background:
              language === 'en' ? 'rgba(22, 160, 133, 0.18)' : 'rgba(255, 255, 255, 0.04)',
            color: language === 'en' ? '#16A085' : 'rgba(248, 250, 252, 0.7)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition:
              'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          }}
        >
          <UsaFlag />
          <span>{t.settings.english}</span>
          {language === 'en' && <Check size={13} color="#16A085" />}
        </button>
      </div>
    </div>
  );
};
