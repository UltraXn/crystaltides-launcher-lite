import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Check,
  Trash2,
  Shield,
  User,
  LogOut,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  UserAccount,
  useT,
} from '../../store/launcherStore';
import { validateMinecraftUsername, generateOfflineUuid } from '../../services/offlineAuth';
import logoImg from '../../assets/logo.png';
import { loginWithCrystalTides } from '../../services/crystalAuthService';

export const AccountsModal: React.FC = () => {
  const t = useT();
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);

  const [newUsername, setNewUsername] = useState('');
  const [newSkinUrl, setNewSkinUrl] = useState<string | undefined>(undefined);
  const [addMode, setAddMode] = useState<'none' | 'guest' | 'crystaltides'>('none');
  const [isAddingMs, setIsAddingMs] = useState(false);

  // CrystalTides Web Account state in AccountsModal
  const [crystalEmail, setCrystalEmail] = useState('');
  const [crystalPassword, setCrystalPassword] = useState('');
  const [isAddingCrystal, setIsAddingCrystal] = useState(false);
  const [crystalError, setCrystalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingAccountIdRef = useRef<string | null>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'accounts') return null;

  const handleCreateCrystal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAddingCrystal(true);
      setCrystalError(null);
      const profile = await loginWithCrystalTides(crystalEmail, crystalPassword);
      await launcherActions.addAccount({
        id: profile.id,
        username: profile.username,
        uuid: profile.uuid,
        role: profile.role,
        email: profile.email,
        skinUrl: profile.skinUrl,
        type: 'crystaltides',
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        lastUsed: Date.now(),
      });
      setAddMode('none');
      setCrystalEmail('');
      setCrystalPassword('');
    } catch (err) {
      setCrystalError(err instanceof Error ? err.message : 'Error al conectar con CrystalTides.');
    } finally {
      setIsAddingCrystal(false);
    }
  };

  const handleAddMicrosoft = async () => {
    try {
      setIsAddingMs(true);
      const { loginMicrosoftRedirect } = await import('../../services/microsoftAuthService');
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
      }
    } catch (err) {
      console.warn('Microsoft auth error:', err);
    } finally {
      setIsAddingMs(false);
    }
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUsername.trim();
    const val = validateMinecraftUsername(clean);
    if (!val.valid) return;

    const offlineUuid = generateOfflineUuid(clean);

    await launcherActions.addAccount({
      id: `guest_${clean.toLowerCase()}`,
      username: clean,
      uuid: offlineUuid,
      skinUrl: newSkinUrl,
      type: 'guest',
      lastUsed: Date.now(),
    });

    setNewUsername('');
    setNewSkinUrl(undefined);
    setAddMode('none');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNewAccount: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const handleLoad = (event: ProgressEvent<FileReader>) => {
      reader.removeEventListener('load', handleLoad);
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      if (isNewAccount) {
        setNewSkinUrl(dataUrl);
      } else if (editingAccountIdRef.current) {
        launcherActions.updateAccount(editingAccountIdRef.current, { skinUrl: dataUrl });
        editingAccountIdRef.current = null;
      }
    };
    reader.addEventListener('load', handleLoad, { once: true });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerRowSkinUpload = (accId: string) => {
    editingAccountIdRef.current = accId;
    rowFileInputRef.current?.click();
  };

  return (
    <div className="papyrus-modal-overlay">
      <button
        type="button"
        aria-label="Cerrar modal"
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
        className="papyrus-accounts-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounts-modal-title"
      >
        {/* Hidden File Inputs for Skin Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,.png"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, true)}
        />
        <input
          type="file"
          ref={rowFileInputRef}
          accept="image/png,.png"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e, false)}
        />

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
          <h2 id="accounts-modal-title" className="settings-main-title">
            {t.accounts.title}
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-inter)' }}>
            {t.accounts.subtitle}
          </p>
        </div>

        {/* Accounts List */}
        <div className="accounts-list-container">
          {accounts.map((acc: UserAccount) => {
            const isActive = acc.id === activeAccountId;
            return (
              <div
                key={acc.id}
                className={`account-row-item ${isActive ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="account-row-left"
                  onClick={() => launcherActions.setActiveAccount(acc.id)}
                  aria-label={`${t.accounts.select} ${acc.username}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                  }}
                >
                  <div className="account-skin-head" title={t.accounts.uploadSkinTitle}>
                    {acc.skinUrl ? (
                      <img src={acc.skinUrl} alt="Skin" className="skin-head-img" />
                    ) : acc.uuid && acc.uuid !== '00000000-0000-0000-0000-000000000000' ? (
                      <img
                        src={`https://mc-heads.net/avatar/${acc.uuid}/48`}
                        alt={acc.username}
                        className="skin-head-img"
                      />
                    ) : (
                      <User style={{ width: '18px', height: '18px', color: '#94a3b8' }} />
                    )}
                  </div>
                  <div className="account-details-col">
                    <div className="account-username-row">
                      <span className="account-username">{acc.username}</span>
                      {isActive && (
                        <span className="account-active-tag">{t.accounts.activeTag}</span>
                      )}
                    </div>
                    <span className="account-type-sub">
                      {acc.type === 'microsoft'
                        ? t.accounts.microsoftAuth
                        : acc.type === 'crystaltides'
                        ? 'CrystalTides SMP'
                        : t.accounts.offlineAccount}
                    </span>
                  </div>
                </button>

                <div className="account-row-actions">
                  {/* Skin upload / change button */}
                  <button
                    type="button"
                    onClick={() => triggerRowSkinUpload(acc.id)}
                    className="account-delete-btn"
                    style={{ color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.25)' }}
                    title={t.accounts.uploadSkinTitle}
                    aria-label={t.accounts.uploadSkinTitle}
                  >
                    <Upload style={{ width: '13px', height: '13px' }} />
                  </button>

                  {isActive && (
                    <Check style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                  )}

                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => launcherActions.removeAccount(acc.id)}
                      className="account-delete-btn"
                      title={t.accounts.deleteProfileTitle}
                      aria-label={t.accounts.deleteProfileTitle}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Account Trigger / Form */}
        {addMode === 'guest' ? (
          <form
            onSubmit={handleCreateGuest}
            className="account-add-form"
            style={{ flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={t.accounts.usernamePlaceholder}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="login-text-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="settings-action-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  borderColor: newSkinUrl ? '#22c55e' : 'rgba(255, 255, 255, 0.15)',
                  color: newSkinUrl ? '#22c55e' : '#cbd5e1',
                  background: newSkinUrl ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                }}
                title={t.accounts.uploadSkinTitle}
              >
                {newSkinUrl ? (
                  <Check style={{ width: '12px', height: '12px' }} />
                ) : (
                  <ImageIcon style={{ width: '12px', height: '12px' }} />
                )}
                {newSkinUrl ? t.accounts.skinLoaded : t.accounts.uploadSkinBtn}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAddMode('none');
                  setNewSkinUrl(undefined);
                }}
                className="settings-action-btn"
              >
                {t.accounts.cancelBtn}
              </button>
              <button
                type="submit"
                className="settings-action-btn"
                style={{ background: '#22c55e', color: '#ffffff', borderColor: '#22c55e' }}
              >
                {t.accounts.saveProfileBtn}
              </button>
            </div>
          </form>
        ) : addMode === 'crystaltides' ? (
          <form
            onSubmit={handleCreateCrystal}
            className="account-add-form"
            style={{ flexDirection: 'column', gap: '10px' }}
          >
            {crystalError && (
              <div className="login-error-alert" style={{ fontSize: '11px', padding: '6px' }}>
                {crystalError}
              </div>
            )}
            <input
              type="email"
              placeholder="Correo de crystaltidessmp.net"
              value={crystalEmail}
              onChange={(e) => setCrystalEmail(e.target.value)}
              className="login-text-input"
              required
            />
            <input
              type="password"
              placeholder="Contraseña web"
              value={crystalPassword}
              onChange={(e) => setCrystalPassword(e.target.value)}
              className="login-text-input"
              required
            />
            <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAddMode('none');
                  setCrystalError(null);
                }}
                className="settings-action-btn"
              >
                {t.accounts.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={isAddingCrystal}
                className="settings-action-btn"
                style={{
                  background: 'linear-gradient(135deg, #00e5ff 0%, #0284c7 100%)',
                  color: '#ffffff',
                  borderColor: '#00e5ff',
                }}
              >
                {isAddingCrystal ? 'Conectando...' : 'Conectar Cuenta'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              onClick={() => setAddMode('guest')}
              className="account-add-btn"
              style={{ flex: 1 }}
            >
              <Plus style={{ width: '15px', height: '15px', color: '#22c55e' }} />{' '}
              {t.accounts.btnOffline}
            </button>
            <button
              onClick={() => {
                setAddMode('crystaltides');
                setCrystalError(null);
              }}
              className="account-add-btn"
              style={{ flex: 1, borderColor: 'rgba(0, 229, 255, 0.35)' }}
            >
              <img
                src={logoImg}
                alt="Octopus"
                style={{ width: '14px', height: '14px', objectFit: 'contain' }}
              />{' '}
              <span style={{ color: '#00e5ff' }}>CrystalTides</span>
            </button>
            <button
              onClick={handleAddMicrosoft}
              disabled={isAddingMs}
              className="account-add-btn"
              style={{ flex: 1, borderColor: 'rgba(0, 164, 239, 0.3)' }}
            >
              <span style={{ color: '#00a4ef', fontWeight: 'bold' }}>+</span>{' '}
              {isAddingMs ? t.accounts.connecting : t.accounts.btnMicrosoft}
            </button>
          </div>
        )}

        {/* Security Info & Logout */}
        <div className="accounts-footer-row">
          <div className="accounts-vault-badge">
            <Shield style={{ width: '13px', height: '13px', color: '#22c55e' }} />
            <span>{t.accounts.vaultBadge}</span>
          </div>

          <button onClick={() => launcherActions.logout()} className="accounts-logout-btn">
            <LogOut style={{ width: '12px', height: '12px' }} />
            <span>{t.accounts.logoutBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
