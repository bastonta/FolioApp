import React, { useState } from 'react';
import { ReaderSettings, ThemeName } from '../../types/reader';
import { fileManager } from '../../services/fileManager';
import {
  X,
  Folder,
  FolderOpen,
  Palette,
  RotateCcw,
  Layers,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [isPicking, setIsPicking] = useState(false);

  if (!isOpen) return null;

  const themes: { id: ThemeName; label: string; bg: string; color: string; border: string }[] = [
    { id: 'light', label: 'Light', bg: '#ffffff', color: '#2e3436', border: '#deddda' },
    { id: 'sepia', label: 'Sepia', bg: '#fbf0d9', color: '#5f4b32', border: '#ebd5ab' },
    { id: 'solarized', label: 'Solarized', bg: '#fdf6e3', color: '#657b83', border: '#eee8d5' },
    { id: 'gray', label: 'Gray', bg: '#2e3440', color: '#eceff4', border: '#4c566a' },
    { id: 'dark', label: 'Dark', bg: '#1e1e1e', color: '#dedede', border: '#444444' },
  ];

  const handlePickFolder = async () => {
    setIsPicking(true);
    try {
      const selected = await fileManager.pickFolder(settings.downloadPath);
      if (selected) {
        onUpdateSettings({ downloadPath: selected });
      }
    } finally {
      setIsPicking(false);
    }
  };

  const handleResetToDefault = async () => {
    const defaultDir = await fileManager.getDefaultDownloadDir();
    if (defaultDir) {
      onUpdateSettings({ downloadPath: defaultDir });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: 520, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-title">Настройки приложения</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 24px' }}>
          
          {/* Theme Settings */}
          <div className="settings-block">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 10,
              }}
            >
              <Palette size={18} style={{ color: 'var(--accent-color)' }} />
              <span>Тема оформления</span>
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))',
                gap: 8,
              }}
            >
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-pill ${settings.theme === t.id ? 'active' : ''}`}
                  style={{
                    backgroundColor: t.bg,
                    color: t.color,
                    borderColor: t.border,
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    fontSize: 12,
                    fontWeight: settings.theme === t.id ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onClick={() => onUpdateSettings({ theme: t.id })}
                >
                  <span>{t.label}</span>
                  {settings.theme === t.id && <Check size={14} style={{ color: 'var(--accent-color)' }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Download Folder Settings */}
          <div className="settings-block">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              <Folder size={18} style={{ color: 'var(--accent-color)' }} />
              <span>Папка для скачивания и чтения книг</span>
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Приложение автоматически отображает все книги из этой папки и сохраняет в неё новые загрузки.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 10,
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
            >
              <FolderOpen size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{settings.downloadPath || 'Папка не выбрана'}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="auth-btn-primary"
                style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={handlePickFolder}
                disabled={isPicking}
              >
                <FolderOpen size={15} />
                <span>{isPicking ? 'Выбор...' : 'Выбрать папку'}</span>
              </button>

              <button
                type="button"
                className="auth-btn-secondary"
                style={{ padding: '8px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={handleResetToDefault}
              >
                <RotateCcw size={14} />
                <span>По умолчанию</span>
              </button>
            </div>
          </div>

          {/* Series Folder Option */}
          <div className="settings-block" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => onUpdateSettings({ createSeriesFolder: !settings.createSeriesFolder })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers size={18} style={{ color: 'var(--accent-color)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Создавать папки серий автоматически
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Книги из серий будут скачиваться в подпапку с названием серии
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={`toggle-switch ${settings.createSeriesFolder !== false ? 'checked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSettings({ createSeriesFolder: !settings.createSeriesFolder });
                }}
                role="switch"
                aria-checked={settings.createSeriesFolder !== false}
                aria-label="Переключить авто-создание папок серий"
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ padding: '16px 24px' }}>
          <button type="button" className="auth-btn-primary" onClick={onClose} style={{ minWidth: 100 }}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
