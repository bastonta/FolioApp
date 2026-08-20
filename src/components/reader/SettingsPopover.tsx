import React, { useRef, useEffect } from 'react';
import { ReaderSettings, ThemeName } from '../../types/reader';
import {
  BookOpen,
  Scroll,
  Minus,
  Plus,
} from 'lucide-react';

interface SettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  triggerRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        (!triggerRef?.current || !triggerRef.current.contains(e.target as Node))
      ) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const themes: { id: ThemeName; label: string; bg: string; color: string; border: string }[] = [
    { id: 'light', label: 'Light', bg: '#ffffff', color: '#2e3436', border: '#deddda' },
    { id: 'sepia', label: 'Sepia', bg: '#fbf0d9', color: '#5f4b32', border: '#ebd5ab' },
    { id: 'gray', label: 'Gray', bg: '#2e3440', color: '#eceff4', border: '#4c566a' },
    { id: 'dark', label: 'Dark', bg: '#1e1e1e', color: '#dedede', border: '#444444' },
    { id: 'solarized', label: 'Solarized', bg: '#fdf6e3', color: '#657b83', border: '#eee8d5' },
  ];

  const fontOptions = [
    { label: 'Georgia (Serif)', value: 'Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
    { label: 'Sans-Serif (System)', value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
    { label: 'OpenDyslexic', value: 'OpenDyslexic, sans-serif' },
    { label: 'Monospace', value: 'ui-monospace, monospace' },
  ];

  return (
    <div className="settings-popover" ref={popoverRef} role="menu">
      <div className="settings-section">
        <label className="settings-label">Theme</label>
        <div className="theme-selector-grid">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-pill ${settings.theme === t.id ? 'active' : ''}`}
              style={{ backgroundColor: t.bg, color: t.color, borderColor: t.border }}
              onClick={() => onUpdateSettings({ theme: t.id })}
              title={t.label}
            >
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-divider" />

      <div className="settings-section">
        <label className="settings-label">Layout</label>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${settings.flow === 'paginated' ? 'active' : ''}`}
            onClick={() => onUpdateSettings({ flow: 'paginated' })}
          >
            <BookOpen size={16} />
            <span>Paginated</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${settings.flow === 'scrolled' ? 'active' : ''}`}
            onClick={() => onUpdateSettings({ flow: 'scrolled' })}
          >
            <Scroll size={16} />
            <span>Scrolled</span>
          </button>
        </div>
      </div>

      {settings.flow === 'paginated' && (
        <div className="settings-section">
          <label className="settings-label">Columns</label>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${settings.columns === 'auto' ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ columns: 'auto' })}
            >
              Auto
            </button>
            <button
              type="button"
              className={`segmented-btn ${settings.columns === 1 ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ columns: 1 })}
            >
              1
            </button>
            <button
              type="button"
              className={`segmented-btn ${settings.columns === 2 ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ columns: 2 })}
            >
              2
            </button>
          </div>
        </div>
      )}

      <div className="settings-divider" />

      <div className="settings-section">
        <label className="settings-label">Font Family</label>
        <select
          className="settings-select"
          value={settings.fontFamily}
          onChange={(e) => onUpdateSettings({ fontFamily: e.target.value })}
        >
          {fontOptions.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="settings-section">
        <div className="settings-row-between">
          <label className="settings-label">Font Size</label>
          <span className="settings-val-text">{settings.fontSize}px</span>
        </div>
        <div className="stepper-control">
          <button
            type="button"
            className="stepper-btn"
            onClick={() => onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={12}
            max={36}
            step={1}
            value={settings.fontSize}
            onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
            className="settings-slider"
          />
          <button
            type="button"
            className="stepper-btn"
            onClick={() => onUpdateSettings({ fontSize: Math.min(36, settings.fontSize + 1) })}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-row-between">
          <label className="settings-label">Line Spacing</label>
          <span className="settings-val-text">{settings.spacing.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={1.0}
          max={2.4}
          step={0.1}
          value={settings.spacing}
          onChange={(e) => onUpdateSettings({ spacing: parseFloat(e.target.value) })}
          className="settings-slider"
        />
      </div>

      <div className="settings-section">
        <div className="settings-row-between">
          <label className="settings-label">Margins</label>
          <span className="settings-val-text">{settings.margin}px</span>
        </div>
        <input
          type="range"
          min={16}
          max={120}
          step={8}
          value={settings.margin}
          onChange={(e) => onUpdateSettings({ margin: Number(e.target.value) })}
          className="settings-slider"
        />
      </div>

      <div className="settings-divider" />

      <div className="settings-section">
        <div className="settings-toggle-row">
          <span>Justify Text</span>
          <button
            type="button"
            className={`toggle-switch ${settings.justify ? 'checked' : ''}`}
            onClick={() => onUpdateSettings({ justify: !settings.justify })}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
        <div className="settings-toggle-row">
          <span>Hyphenation</span>
          <button
            type="button"
            className={`toggle-switch ${settings.hyphenate ? 'checked' : ''}`}
            onClick={() => onUpdateSettings({ hyphenate: !settings.hyphenate })}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
};
