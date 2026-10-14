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

interface AccountRowItemProps {
  acc: UserAccount;
  isActive: boolean;
  totalAccounts: number;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUploadSkin: (id: string) => void;
  t: ReturnType<typeof useT>;
}

const renderAccountAvatar = (acc: { skinUrl?: string; uuid?: string; username: string }) => {
  if (acc.skinUrl) {
    return <img src={acc.skinUrl} alt="Skin" className="skin-head-img" />;
  }
  if (acc.uuid && acc.uuid !== '00000000-0000-0000-0000-000000000000') {
    return (
      <img
        src={`https://mc-heads.net/avatar/${acc.uuid}/48`}
        alt={acc.username}
        className="skin-head-img"
      />
    );
  }
  return <User style={{ width: '18px', height: '18px', color: '#94a3b8' }} />;
};

export const AccountRowItem: React.FC<AccountRowItemProps> = ({
  acc,
  isActive,
  totalAccounts,
  onSelect,
  onRemove,
  onUploadSkin,
  t,
}) => {
  const getAccountTypeLabel = () => {
    if (acc.type === 'microsoft') return t.accounts.microsoftAuth;
    if (acc.type === 'crystaltides') return 'CrystalTides SMP';
    return t.accounts.offlineAccount;
  };

  return (
    <div className={`account-row-item ${isActive ? 'active' : ''}`}>
      <button
        type="button"
        className="account-row-left"
        onClick={() => onSelect(acc.id)}
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
          {renderAccountAvatar(acc)}
        </div>
        <div className="account-details-col">
          <div className="account-username-row">
            <span className="account-username">{acc.username}</span>
            {isActive && <span className="account-active-tag">{t.accounts.activeTag}</span>}
          </div>
          <span className="account-type-sub">{getAccountTypeLabel()}</span>
        </div>
      </button>

      <div className="account-row-actions">
        <button
          type="button"
          onClick={() => onUploadSkin(acc.id)}
          className="account-delete-btn"
          style={{ color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.25)' }}
          title={t.accounts.uploadSkinTitle}
          aria-label={t.accounts.uploadSkinTitle}
        >
          <Upload style={{ width: '13px', height: '13px' }} />
        </button>

        {isActive && <Check style={{ width: '18px', height: '18px', color: '#22c55e' }} />}

        {totalAccounts > 1 && (
          <button
            type="button"
            onClick={() => onRemove(acc.id)}
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
};

interface GuestFormProps {
  username: string;
  onChangeUsername: (u: string) => void;
  error?: string | null;
  skinUrl?: string;
  onOpenSkinUpload: () => void;
  onCancel: () => void;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  t: ReturnType<typeof useT>;
}

export const GuestForm: React.FC<GuestFormProps> = ({
  username,
  onChangeUsername,
  error,
  skinUrl,
  onOpenSkinUpload,
  onCancel,
  onSubmit,
  t,
}) => (
  <form
    onSubmit={onSubmit}
    className="account-add-form"
    style={{ flexDirection: 'column', gap: '10px' }}
  >
    {error && (
      <div
        className="login-error-alert"
        style={{ fontSize: '11px', padding: '6px', width: '100%' }}
      >
        {error}
      </div>
    )}
    <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
      <input
        type="text"
        aria-label={t.accounts.usernamePlaceholder}
        placeholder={t.accounts.usernamePlaceholder}
        value={username}
        onChange={(e) => onChangeUsername(e.target.value)}
        className="login-text-input"
        style={{ flex: 1 }}
      />
      <button
        type="button"
        onClick={onOpenSkinUpload}
        className="settings-action-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          borderColor: skinUrl ? '#22c55e' : 'rgba(255, 255, 255, 0.15)',
          color: skinUrl ? '#22c55e' : '#cbd5e1',
          background: skinUrl ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
        }}
        title={t.accounts.uploadSkinTitle}
      >
        {skinUrl ? (
          <Check style={{ width: '12px', height: '12px' }} />
        ) : (
          <ImageIcon style={{ width: '12px', height: '12px' }} />
        )}
        {skinUrl ? t.accounts.skinLoaded : t.accounts.uploadSkinBtn}
      </button>
    </div>

    <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onCancel} className="settings-action-btn">
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
);

interface CrystalFormProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  error: string | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  t: ReturnType<typeof useT>;
}

const CrystalForm: React.FC<CrystalFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  onCancel,
  onSubmit,
  t,
}) => (
  <form
    onSubmit={onSubmit}
    className="account-add-form"
    style={{ flexDirection: 'column', gap: '10px' }}
  >
    {error && (
      <div className="login-error-alert" style={{ fontSize: '11px', padding: '6px' }}>
        {error}
      </div>
    )}
    <input
      type="email"
      aria-label="Correo de crystaltidessmp.net"
      placeholder="Correo de crystaltidessmp.net"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="login-text-input"
      required
    />
    <input
      type="password"
      aria-label="Contraseña web"
      placeholder="Contraseña web"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="login-text-input"
      required
    />
    <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onCancel} className="settings-action-btn">
        {t.accounts.cancelBtn}
      </button>
      <button
        type="submit"
        disabled={loading}
        className="settings-action-btn"
        style={{
          background: 'linear-gradient(135deg, #00e5ff 0%, #0284c7 100%)',
          color: '#ffffff',
          borderColor: '#00e5ff',
        }}
      >
        {loading ? 'Conectando...' : 'Conectar Cuenta'}
      </button>
    </div>
  </form>
);

const cropSkinToAvatarHead = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = false;

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Dimensiones de skin de Minecraft: 64x64, 64x32 o proporción 1:1 / 2:1 pequeña (<= 256)
        const isSkin =
          (w === 64 && (h === 64 || h === 32)) || ((w === h || w === h * 2) && w <= 256);

        if (isSkin) {
          const scale = w / 64;
          // Región de la cara (sx=8, sy=8, sw=8, sh=8) escalada al canvas 64x64
          ctx.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
          // Superponer capa del sombrero (sx=40, sy=8, sw=8, sh=8)
          ctx.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
        } else {
          // Avatar normal grande: redimensionar a 64x64 en el canvas
          ctx.drawImage(img, 0, 0, w, h, 0, 0, 64, 64);
        }

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const AccountsModal: React.FC = () => {
  const t = useT();
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);

  const [newUsername, setNewUsername] = useState('');
  const [newSkinUrl, setNewSkinUrl] = useState<string | undefined>(undefined);
  const [addMode, setAddMode] = useState<'none' | 'guest' | 'crystaltides'>('none');
  const [isAddingMs, setIsAddingMs] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [msError, setMsError] = useState<string | null>(null);

  // CrystalTides Web Account state in AccountsModal
  const [crystalEmail, setCrystalEmail] = useState('');
  const [crystalPassword, setCrystalPassword] = useState('');
  const [isAddingCrystal, setIsAddingCrystal] = useState(false);
  const [crystalError, setCrystalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingAccountIdRef = useRef<string | null>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'accounts') return null;

  const handleCreateCrystal = async (e: React.SyntheticEvent) => {
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
      setMsError(null);
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
      setMsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAddingMs(false);
    }
  };

  const handleCreateGuest = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setGuestError(null);
    const clean = newUsername.trim();
    const val = validateMinecraftUsername(clean);
    if (!val.valid) {
      setGuestError(val.error ?? t.login.invalidUsername);
      return;
    }

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
    setGuestError(null);
    setAddMode('none');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNewAccount: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const handleLoad = async (event: ProgressEvent<FileReader>) => {
      reader.removeEventListener('load', handleLoad);
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;

      const dataUrl = await cropSkinToAvatarHead(rawDataUrl);

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
      <dialog
        open
        className="papyrus-accounts-card"
        aria-labelledby="accounts-modal-title"
        style={{ color: 'inherit' }}
      >
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

        <button
          type="button"
          onClick={launcherActions.closeModal}
          className="settings-card-close"
          title={t.settings.close}
          aria-label={t.settings.close}
        >
          <X style={{ width: '16px', height: '16px' }} />
        </button>

        <div className="settings-header-block">
          <h2 id="accounts-modal-title" className="settings-main-title">
            {t.accounts.title}
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-inter)' }}>
            {t.accounts.subtitle}
          </p>
        </div>

        <div className="accounts-list-container">
          {accounts.map((acc: UserAccount) => (
            <AccountRowItem
              key={acc.id}
              acc={acc}
              isActive={acc.id === activeAccountId}
              totalAccounts={accounts.length}
              onSelect={launcherActions.setActiveAccount}
              onRemove={launcherActions.removeAccount}
              onUploadSkin={triggerRowSkinUpload}
              t={t}
            />
          ))}
        </div>

        {addMode === 'guest' && (
          <GuestForm
            username={newUsername}
            onChangeUsername={(u) => {
              setNewUsername(u);
              if (guestError) setGuestError(null);
            }}
            error={guestError}
            skinUrl={newSkinUrl}
            onOpenSkinUpload={() => fileInputRef.current?.click()}
            onCancel={() => {
              setAddMode('none');
              setNewSkinUrl(undefined);
              setGuestError(null);
            }}
            onSubmit={handleCreateGuest}
            t={t}
          />
        )}

        {addMode === 'crystaltides' && (
          <CrystalForm
            email={crystalEmail}
            setEmail={setCrystalEmail}
            password={crystalPassword}
            setPassword={setCrystalPassword}
            error={crystalError}
            loading={isAddingCrystal}
            onCancel={() => {
              setAddMode('none');
              setCrystalError(null);
            }}
            onSubmit={handleCreateCrystal}
            t={t}
          />
        )}

        {msError && (
          <div
            className="login-error-alert"
            style={{ fontSize: '11px', padding: '6px', margin: '4px 0 8px 0', width: '100%' }}
          >
            {msError}
          </div>
        )}

        {addMode === 'none' && (
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              onClick={() => {
                setAddMode('guest');
                setGuestError(null);
                setMsError(null);
              }}
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
                setMsError(null);
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
              type="button"
              onClick={handleAddMicrosoft}
              disabled={isAddingMs}
              className="account-add-btn"
              style={{ flex: 1, borderColor: 'rgba(0, 164, 239, 0.3)' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 21 21"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <rect x="1" y="1" width="9" height="9" fill="#f25022" rx="1" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" rx="1" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" rx="1" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" rx="1" />
              </svg>
              <span>{isAddingMs ? t.accounts.connecting : t.accounts.btnMicrosoft}</span>
            </button>
          </div>
        )}

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
      </dialog>
    </div>
  );
};
