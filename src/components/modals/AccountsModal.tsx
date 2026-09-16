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
} from '../../store/launcherStore';

export const AccountsModal: React.FC = () => {
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);

  const [newUsername, setNewUsername] = useState('');
  const [newSkinUrl, setNewSkinUrl] = useState<string | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAddingMs, setIsAddingMs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'accounts') return null;

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
    if (!newUsername.trim()) return;

    await launcherActions.addAccount({
      id: `guest_${Date.now()}`,
      username: newUsername.trim(),
      uuid: '00000000-0000-0000-0000-000000000000',
      skinUrl: newSkinUrl,
      type: 'guest',
      lastUsed: Date.now(),
    });

    setNewUsername('');
    setNewSkinUrl(undefined);
    setShowAddForm(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNewAccount: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      if (isNewAccount) {
        setNewSkinUrl(dataUrl);
      } else if (editingAccountId) {
        launcherActions.updateAccount(editingAccountId, { skinUrl: dataUrl });
        setEditingAccountId(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerRowSkinUpload = (accId: string) => {
    setEditingAccountId(accId);
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
          title="Cerrar"
          aria-label="Cerrar"
        >
          <X style={{ width: '16px', height: '16px' }} />
        </button>

        {/* Title */}
        <div className="settings-header-block">
          <h2 id="accounts-modal-title" className="settings-main-title">
            Accounts
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-inter)' }}>
            Gestiona tus perfiles, credenciales seguras y personaliza tu skin
          </p>
        </div>

        {/* Accounts List */}
        <div className="accounts-list-container">
          {accounts.map((acc: UserAccount) => {
            const isActive = acc.id === activeAccountId;
            return (
              <div
                role="button"
                tabIndex={0}
                aria-label={`Seleccionar cuenta ${acc.username}`}
                key={acc.id}
                onClick={() => launcherActions.setActiveAccount(acc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    launcherActions.setActiveAccount(acc.id);
                  }
                }}
                className={`account-row-item ${isActive ? 'active' : ''}`}
              >
                <div className="account-row-left">
                  <div className="account-skin-head" title="Click para editar o subir skin">
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
                      {isActive && <span className="account-active-tag">ACTIVO</span>}
                    </div>
                    <span className="account-type-sub">
                      {acc.type === 'microsoft' ? 'Microsoft Authenticated' : 'Cuenta Offline'}
                    </span>
                  </div>
                </div>

                <div className="account-row-actions">
                  {/* Skin upload / change button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerRowSkinUpload(acc.id);
                    }}
                    className="account-delete-btn"
                    style={{ color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.25)' }}
                    title="Subir o cambiar Skin (.png)"
                  >
                    <Upload style={{ width: '13px', height: '13px' }} />
                  </button>

                  {isActive && (
                    <Check style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                  )}

                  {accounts.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        launcherActions.removeAccount(acc.id);
                      }}
                      className="account-delete-btn"
                      title="Eliminar perfil"
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
        {showAddForm ? (
          <form
            onSubmit={handleCreateGuest}
            className="account-add-form"
            style={{ flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Nombre de usuario..."
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
                title="Subir archivo .png de Skin"
              >
                {newSkinUrl ? (
                  <Check style={{ width: '12px', height: '12px' }} />
                ) : (
                  <ImageIcon style={{ width: '12px', height: '12px' }} />
                )}
                {newSkinUrl ? 'Skin Cargada' : 'Subir Skin'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewSkinUrl(undefined);
                }}
                className="settings-action-btn"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="settings-action-btn"
                style={{ background: '#22c55e', color: '#ffffff', borderColor: '#22c55e' }}
              >
                Guardar Perfil
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              onClick={() => setShowAddForm(true)}
              className="account-add-btn"
              style={{ flex: 1 }}
            >
              <Plus style={{ width: '15px', height: '15px', color: '#22c55e' }} /> Cuenta Offline
            </button>
            <button
              onClick={handleAddMicrosoft}
              disabled={isAddingMs}
              className="account-add-btn"
              style={{ flex: 1, borderColor: 'rgba(0, 164, 239, 0.3)' }}
            >
              <span style={{ color: '#00a4ef', fontWeight: 'bold' }}>+</span>{' '}
              {isAddingMs ? 'Conectando...' : 'Microsoft'}
            </button>
          </div>
        )}

        {/* Security Info & Logout */}
        <div className="accounts-footer-row">
          <div className="accounts-vault-badge">
            <Shield style={{ width: '13px', height: '13px', color: '#22c55e' }} />
            <span>Bóveda AES-256-GCM</span>
          </div>

          <button onClick={() => launcherActions.logout()} className="accounts-logout-btn">
            <LogOut style={{ width: '12px', height: '12px' }} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};
