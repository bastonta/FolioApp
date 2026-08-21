import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import QRCode from 'qrcode';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Copy, Download,
  KeyRound, AlertCircle, CheckCircle2, X, Mail, Server,
  LogOut, Pencil, Palette, FolderOpen, RotateCcw,
  Check
} from 'lucide-react';
import { loadSettings, saveSettings } from '../services/storage';
import { fileManager } from '../services/fileManager';
import { ReaderSettings, ThemeName } from '../types/reader';

export const ProfilePage: React.FC = () => {
  const { user, serverUrl, clearServer, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // Email change
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [emailData, setEmailData] = useState({ newEmail: '', currentPassword: '', code: '' });
  const [emailChangeStep, setEmailChangeStep] = useState<1 | 2>(1);

  // App Settings (Theme & Download Path)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings());
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = saveSettings(newSettings);
    setSettings(updated);
  };

  const handlePickFolder = async () => {
    setIsPickingFolder(true);
    try {
      const selected = await fileManager.pickFolder(settings.downloadPath);
      if (selected) {
        handleUpdateSettings({ downloadPath: selected });
      }
    } finally {
      setIsPickingFolder(false);
    }
  };

  const handleResetFolder = async () => {
    const defaultDir = await fileManager.getDefaultDownloadDir();
    if (defaultDir) {
      handleUpdateSettings({ downloadPath: defaultDir });
    }
  };

  // 2FA Modals
  const [showEnable2FA, setShowEnable2FA] = useState(false);
  const [twoFaSetupData, setTwoFaSetupData] = useState<{ secret: string, qrCodeUrl: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');

  const [showViewRecoveryCodes, setShowViewRecoveryCodes] = useState(false);
  const [viewCodesTotp, setViewCodesTotp] = useState('');

  useEffect(() => {
    if (user) {
      setNewName(user.name);
    }
  }, [user]);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === user?.name) {
      setIsEditingName(false);
      return;
    }
    clearMessages();
    setIsLoading(true);
    try {
      await profileApi.updateProfile(newName);
      await refreshUser();
      setSuccessMsg('Profile updated successfully');
      setIsEditingName(false);
    } catch (err) {
      setError((err as any)?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await profileApi.changePassword(
        passwordData.oldPassword,
        passwordData.newPassword
      );
      setSuccessMsg('Password changed successfully');
      setShowPasswordChange(false);
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError((err as any)?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      await profileApi.emailChange(
        emailData.newEmail,
        emailData.currentPassword
      );
      setEmailChangeStep(2);
      setSuccessMsg('Verification code sent to new email');
    } catch (err) {
      setError((err as any)?.message || 'Failed to request email change');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      await profileApi.emailChangeConfirm(
        emailData.newEmail,
        emailData.code
      );
      await refreshUser();
      setSuccessMsg('Email changed successfully');
      setShowEmailChange(false);
      setEmailChangeStep(1);
      setEmailData({ newEmail: '', currentPassword: '', code: '' });
    } catch (err) {
      setError((err as any)?.message || 'Failed to verify email change');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEnable2FA = async () => {
    clearMessages();
    setIsLoading(true);
    try {
      const { secret, url } = await profileApi.enable2fa();
      const qrCodeUrl = await QRCode.toDataURL(url);
      setTwoFaSetupData({ secret, qrCodeUrl });
      setShowEnable2FA(true);
      setTwoFaCode('');
    } catch (err) {
      setError((err as any)?.message || 'Failed to initialize 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      const { recoveryCodes } = await profileApi.confirm2fa(twoFaCode);
      await refreshUser();
      setRecoveryCodes(recoveryCodes);
      setSuccessMsg('Two-factor authentication enabled successfully');
      setTwoFaSetupData(null);
    } catch (err) {
      setError((err as any)?.message || 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      await profileApi.disable2fa(disable2FAPassword);
      await refreshUser();
      setSuccessMsg('Two-factor authentication disabled');
      setShowDisable2FA(false);
      setDisable2FAPassword('');
    } catch (err) {
      setError((err as any)?.message || 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
      const { recoveryCodes } = await profileApi.getRecoveryCodes(viewCodesTotp);
      setRecoveryCodes(recoveryCodes);
    } catch (err) {
      setError((err as any)?.message || 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMsg('Copied to clipboard');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes) return;
    const text = `Folio Recovery Codes\nSave these in a secure place.\n\n${recoveryCodes.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'folio-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getInitial = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="profile-page" style={{ height: '100%', overflowY: 'auto' }}>
      <header className="library-header">
        <button className="header-pill-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div className="library-brand">
          <h1 className="library-title">Account & Profile</h1>
        </div>
        <div style={{ width: 80 }} /> {/* spacer */}
      </header>

      <div className="profile-content" style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
        
        {error && (
          <div className="auth-error" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="auth-info" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: '#22c55e' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* User Information */}
        <div className="profile-card" style={{ marginBottom: 24 }}>
          <div className="profile-card-title">User Information</div>
          <div className="profile-user-header" style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
            <div className="profile-avatar" style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>
              {getInitial(user?.name || '')}
            </div>
            <div className="profile-user-info" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {!isEditingName ? (
                  <>
                    <div className="profile-user-name" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-color)' }}>{user?.name}</div>
                    <button className="profile-btn profile-btn-secondary" style={{ padding: 6 }} onClick={() => setIsEditingName(true)} title="Edit Name">
                      <Pencil size={14} />
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleUpdateName} className="profile-inline-form" style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 400 }}>
                    <input 
                      type="text" 
                      className="auth-input" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)}
                      disabled={isLoading}
                      autoFocus
                    />
                    <button type="submit" className="auth-btn-primary" disabled={isLoading || !newName.trim()}>Save</button>
                    <button type="button" className="auth-btn-secondary" onClick={() => { setIsEditingName(false); setNewName(user?.name || ''); }}>Cancel</button>
                  </form>
                )}
              </div>
              <div className="profile-user-email" style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>
          </div>
          <div className="profile-field-row" style={{ display: 'flex', gap: 12 }}>
            <span className={`profile-badge ${user?.twoFactorEnabled ? 'success' : 'warning'}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, backgroundColor: user?.twoFactorEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)', color: user?.twoFactorEnabled ? '#22c55e' : '#eab308' }}>
              {user?.twoFactorEnabled ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              2FA {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <span className={`profile-badge ${user?.emailConfirmed ? 'success' : 'neutral'}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500, backgroundColor: user?.emailConfirmed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: user?.emailConfirmed ? '#22c55e' : 'var(--text-muted)' }}>
              <CheckCircle2 size={14} />
              Email {user?.emailConfirmed ? 'Confirmed' : 'Unconfirmed'}
            </span>
          </div>
        </div>

        {/* Change Password */}
        <div className="profile-card" style={{ marginBottom: 24 }}>
          <div className="profile-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound size={18} /> Change Password</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              Ensure your account is using a long, random password to stay secure.
            </p>
            <button className="auth-btn-primary" onClick={() => { clearMessages(); setShowPasswordChange(true); }} disabled={isLoading}>
              Change Password
            </button>
          </div>
        </div>

        {/* Change Email */}
        <div className="profile-card" style={{ marginBottom: 24 }}>
          <div className="profile-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={18} /> Change Email</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              Update the email address associated with your account. A verification code will be sent to confirm.
            </p>
            <button className="auth-btn-primary" onClick={() => { clearMessages(); setEmailChangeStep(1); setShowEmailChange(true); }} disabled={isLoading}>
              Change Email
            </button>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="profile-card" style={{ marginBottom: 24 }}>
          <div className="profile-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} /> Two-Factor Authentication (2FA)</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              Add an extra layer of security to your account by requiring a code from your authenticator app when you sign in.
            </p>
            
            {!user?.twoFactorEnabled ? (
              <button className="auth-btn-primary" onClick={handleStartEnable2FA} disabled={isLoading}>Enable 2FA</button>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="auth-btn-secondary" onClick={() => { clearMessages(); setShowViewRecoveryCodes(true); }}>View Recovery Codes</button>
                <button className="auth-btn-text" style={{ color: '#ef4444' }} onClick={() => { clearMessages(); setShowDisable2FA(true); }}>Disable 2FA</button>
              </div>
            )}
          </div>
        </div>

        {/* App Settings & Storage */}
        <div className="profile-card" style={{ marginBottom: 24 }}>
          <div className="profile-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={18} /> Настройки приложения и хранения
            </span>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Theme */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Тема оформления
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
                {[
                  { id: 'light' as ThemeName, label: 'Light', bg: '#ffffff', color: '#2e3436', border: '#deddda' },
                  { id: 'sepia' as ThemeName, label: 'Sepia', bg: '#fbf0d9', color: '#5f4b32', border: '#ebd5ab' },
                  { id: 'solarized' as ThemeName, label: 'Solarized', bg: '#fdf6e3', color: '#657b83', border: '#eee8d5' },
                  { id: 'gray' as ThemeName, label: 'Gray', bg: '#2e3440', color: '#eceff4', border: '#4c566a' },
                  { id: 'dark' as ThemeName, label: 'Dark', bg: '#1e1e1e', color: '#dedede', border: '#444444' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-pill ${settings.theme === t.id ? 'active' : ''}`}
                    style={{
                      backgroundColor: t.bg,
                      color: t.color,
                      borderColor: t.border,
                      padding: '8px',
                      borderRadius: 8,
                      border: '1px solid',
                      fontSize: 12,
                      fontWeight: settings.theme === t.id ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                    onClick={() => handleUpdateSettings({ theme: t.id })}
                  >
                    <span>{t.label}</span>
                    {settings.theme === t.id && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Download Folder */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Папка скачивания и локальных книг
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  marginBottom: 10,
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
              >
                <FolderOpen size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span>{settings.downloadPath || 'Папка не выбрана'}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="auth-btn-primary"
                  style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={handlePickFolder}
                  disabled={isPickingFolder}
                >
                  <FolderOpen size={14} />
                  <span>{isPickingFolder ? 'Выбор...' : 'Выбрать папку'}</span>
                </button>
                <button
                  type="button"
                  className="auth-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={handleResetFolder}
                >
                  <RotateCcw size={13} />
                  <span>По умолчанию</span>
                </button>
              </div>
            </div>

            {/* Series Subfolders Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 12,
              }}
              onClick={() => handleUpdateSettings({ createSeriesFolder: !settings.createSeriesFolder })}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Автоматически создавать папки серий
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Книги из серий сохраняются в подпапки с названием серии
                </div>
              </div>
              <button
                type="button"
                className={`toggle-switch ${settings.createSeriesFolder !== false ? 'checked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateSettings({ createSeriesFolder: !settings.createSeriesFolder });
                }}
                role="switch"
                aria-checked={settings.createSeriesFolder !== false}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>
        </div>

        {/* Server & Session */}
        <div className="profile-card" style={{ marginBottom: 24 }}>
          <div className="profile-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Server size={18} /> Server & Session</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '12px 16px', backgroundColor: 'var(--bg-lighter)', borderRadius: 8 }}>
              <Server size={16} color="var(--text-muted)" />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Connected to:</span>
              <strong style={{ fontSize: 14, color: 'var(--text-color)' }}>{serverUrl}</strong>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="auth-btn-secondary" onClick={() => { clearServer(); navigate('/server'); }}>Change Server</button>
              <button className="auth-btn-secondary" onClick={() => { logout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Change Password Modal */}
      {showPasswordChange && (
        <div className="modal-backdrop" onClick={() => { setShowPasswordChange(false); setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' }); }}>
          <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Password</span>
              <button className="modal-close-btn" onClick={() => { setShowPasswordChange(false); setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' }); }}><X size={16} /></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body">
                {error && (
                  <div className="auth-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Current Password</label>
                  <input
                    type="password"
                    required
                    className="auth-input"
                    style={{ paddingLeft: 12 }}
                    value={passwordData.oldPassword}
                    onChange={e => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>New Password</label>
                  <input
                    type="password"
                    required
                    className="auth-input"
                    style={{ paddingLeft: 12 }}
                    value={passwordData.newPassword}
                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Confirm New Password</label>
                  <input
                    type="password"
                    required
                    className="auth-input"
                    style={{ paddingLeft: 12 }}
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="auth-btn-text" onClick={() => { setShowPasswordChange(false); setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' }); }}>Cancel</button>
                <button type="submit" className="auth-btn-primary" disabled={isLoading || !passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword}>Change Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Email Modal */}
      {showEmailChange && (
        <div className="modal-backdrop" onClick={() => { setShowEmailChange(false); setEmailChangeStep(1); setEmailData({ newEmail: '', currentPassword: '', code: '' }); }}>
          <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Change Email</span>
              <button className="modal-close-btn" onClick={() => { setShowEmailChange(false); setEmailChangeStep(1); setEmailData({ newEmail: '', currentPassword: '', code: '' }); }}><X size={16} /></button>
            </div>
            {emailChangeStep === 1 ? (
              <form onSubmit={handleRequestEmailChange}>
                <div className="modal-body">
                  {error && (
                    <div className="auth-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>New Email Address</label>
                    <input
                      type="email"
                      required
                      className="auth-input"
                      style={{ paddingLeft: 12 }}
                      value={emailData.newEmail}
                      onChange={e => setEmailData({ ...emailData, newEmail: e.target.value })}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Current Password</label>
                    <input
                      type="password"
                      required
                      className="auth-input"
                      style={{ paddingLeft: 12 }}
                      value={emailData.currentPassword}
                      onChange={e => setEmailData({ ...emailData, currentPassword: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="auth-btn-text" onClick={() => { setShowEmailChange(false); setEmailChangeStep(1); setEmailData({ newEmail: '', currentPassword: '', code: '' }); }}>Cancel</button>
                  <button type="submit" className="auth-btn-primary" disabled={isLoading || !emailData.newEmail || !emailData.currentPassword}>Send Verification Code</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmEmailChange}>
                <div className="modal-body">
                  {error && (
                    <div className="auth-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="auth-info" style={{ marginBottom: 16, fontSize: 13 }}>
                    A verification code has been sent to <strong>{emailData.newEmail}</strong>.
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Verification Code</label>
                    <input
                      type="text"
                      required
                      className="auth-input auth-input-code"
                      style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
                      value={emailData.code}
                      onChange={e => setEmailData({ ...emailData, code: e.target.value })}
                      disabled={isLoading}
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="auth-btn-text" onClick={() => setEmailChangeStep(1)}>Back</button>
                  <button type="button" className="auth-btn-text" onClick={() => { setShowEmailChange(false); setEmailChangeStep(1); setEmailData({ newEmail: '', currentPassword: '', code: '' }); }}>Cancel</button>
                  <button type="submit" className="auth-btn-primary" disabled={isLoading || emailData.code.length < 6}>Confirm Email Change</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Enable 2FA Modal */}
      {showEnable2FA && twoFaSetupData && !recoveryCodes && (
        <div className="modal-backdrop" onClick={() => setShowEnable2FA(false)}>
          <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Set up Two-Factor Authentication</span>
              <button className="modal-close-btn" onClick={() => setShowEnable2FA(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleConfirmEnable2FA}>
              <div className="modal-body">
                {error && (
                  <div className="auth-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
                <ol style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: 'var(--text-color)' }}>
                  <li style={{ marginBottom: 12 }}>Scan this QR code with your authenticator app (like Authy or Google Authenticator).</li>
                </ol>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0', padding: 16, backgroundColor: 'white', borderRadius: 8 }}>
                  <img src={twoFaSetupData.qrCodeUrl} alt="2FA QR Code" width={200} height={200} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
                  Or enter this code manually:<br/>
                  <code style={{ fontSize: 16, fontWeight: 'bold', display: 'inline-block', marginTop: 8, padding: '4px 8px', backgroundColor: 'var(--bg-lighter)', borderRadius: 4 }}>
                    {twoFaSetupData.secret}
                  </code>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Enter the 6-digit code from your app</label>
                  <input type="text" required className="auth-input auth-input-code" style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18 }} value={twoFaCode} onChange={e => setTwoFaCode(e.target.value)} disabled={isLoading} maxLength={6} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="auth-btn-text" onClick={() => setShowEnable2FA(false)}>Cancel</button>
                <button type="submit" className="auth-btn-primary" disabled={isLoading || twoFaCode.length < 6}>Verify & Enable</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Codes Modal (after enable or view) */}
      {recoveryCodes && (
        <div className="modal-backdrop" onClick={() => { setRecoveryCodes(null); setShowViewRecoveryCodes(false); }}>
          <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Recovery Codes</span>
              <button className="modal-close-btn" onClick={() => { setRecoveryCodes(null); setShowViewRecoveryCodes(false); }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="auth-error" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04', borderColor: '#ca8a04', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13 }}>Save these recovery codes in a secure place. This is the <strong>only time</strong> they will be shown. You can use them to sign in if you lose access to your authenticator app.</span>
              </div>
              <div className="recovery-codes-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {recoveryCodes.map((code, i) => (
                  <div key={i} className="recovery-code-item" style={{ fontFamily: 'monospace', fontSize: 14, padding: '8px 12px', backgroundColor: 'var(--bg-lighter)', border: '1px solid var(--border-color)', borderRadius: 4, textAlign: 'center' }}>
                    {code}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="auth-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} onClick={() => copyToClipboard(recoveryCodes.join('\n'))}>
                  <Copy size={14} /> Copy
                </button>
                <button className="auth-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }} onClick={downloadRecoveryCodes}>
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="auth-btn-primary" onClick={() => { setRecoveryCodes(null); setShowViewRecoveryCodes(false); }}>I have saved them</button>
            </div>
          </div>
        </div>
      )}

      {/* View Recovery Codes Modal (auth requirement) */}
      {showViewRecoveryCodes && !recoveryCodes && (
        <div className="modal-backdrop" onClick={() => setShowViewRecoveryCodes(false)}>
          <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">View Recovery Codes</span>
              <button className="modal-close-btn" onClick={() => setShowViewRecoveryCodes(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleViewRecoveryCodes}>
              <div className="modal-body">
                {error && (
                  <div className="auth-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
                <p style={{ fontSize: 14, color: 'var(--text-color)', marginBottom: 16 }}>
                  To view or generate new recovery codes, please enter a code from your authenticator app. Note: Generating new codes will invalidate any old ones.
                </p>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Authenticator Code</label>
                  <input type="text" required className="auth-input auth-input-code" style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18 }} value={viewCodesTotp} onChange={e => setViewCodesTotp(e.target.value)} disabled={isLoading} maxLength={6} autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="auth-btn-text" onClick={() => setShowViewRecoveryCodes(false)}>Cancel</button>
                <button type="submit" className="auth-btn-primary" disabled={isLoading || viewCodesTotp.length < 6}>Verify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable 2FA Modal */}
      {showDisable2FA && (
        <div className="modal-backdrop" onClick={() => setShowDisable2FA(false)}>
          <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Disable Two-Factor Authentication</span>
              <button className="modal-close-btn" onClick={() => setShowDisable2FA(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleDisable2FA}>
              <div className="modal-body">
                {error && (
                  <div className="auth-error" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
                <p style={{ fontSize: 14, color: 'var(--text-color)', marginBottom: 16 }}>
                  Are you sure you want to disable two-factor authentication? This will make your account less secure.
                </p>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--text-muted)' }}>Enter Password to Confirm</label>
                  <input type="password" required className="auth-input" style={{ paddingLeft: 12 }} value={disable2FAPassword} onChange={e => setDisable2FAPassword(e.target.value)} disabled={isLoading} autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="auth-btn-text" onClick={() => setShowDisable2FA(false)}>Cancel</button>
                <button type="submit" className="auth-btn-primary" style={{ backgroundColor: '#ef4444' }} disabled={isLoading || !disable2FAPassword}>Disable 2FA</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
