import React from 'react';
import {
  Library,
  Search,
  Sliders,
  Pin,
  PinOff,
  EyeOff,
  Eye,
} from 'lucide-react';

interface HeaderBarProps {
  onBackToLibrary: () => void;
  onToggleSearch: () => void;
  isSearchActive: boolean;
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
  onTogglePin: () => void;
  isPinned: boolean;
  chapterTitle?: string;
  settingsBtnRef: React.RefObject<HTMLButtonElement | null>;
  onToggleControls?: () => void;
  showControls?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onBackToLibrary,
  onToggleSearch,
  isSearchActive,
  onToggleSettings,
  isSettingsOpen,
  onTogglePin,
  isPinned,
  chapterTitle,
  settingsBtnRef,
  onToggleControls,
  showControls = true,
}) => {
  return (
    <header className="reader-header-bar">
      {/* Left Header Controls matching Screenshots 1 & 3 */}
      <div className="header-left-actions">
        <button
          type="button"
          className="header-pill-btn header-library-btn"
          onClick={onBackToLibrary}
          title="Back to Library"
        >
          <Library size={15} />
          <span>Library</span>
        </button>

        <button
          type="button"
          className={`header-icon-btn ${isSearchActive ? 'active' : ''}`}
          onClick={onToggleSearch}
          title="Search in Book"
          aria-label="Search"
        >
          <Search size={16} />
        </button>

        <button
          type="button"
          ref={settingsBtnRef}
          className={`header-icon-btn ${isSettingsOpen ? 'active' : ''}`}
          onClick={onToggleSettings}
          title="Reader Settings"
          aria-label="Settings"
        >
          <Sliders size={16} />
        </button>

        <button
          type="button"
          className={`header-icon-btn ${isPinned ? 'active' : ''}`}
          onClick={onTogglePin}
          title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
          aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
        >
          {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
        </button>
      </div>

      {/* Center Running Head Title */}
      <div className="header-center-title">
        {chapterTitle && <span className="header-chapter-name">{chapterTitle}</span>}
      </div>

      {/* Right Header space */}
      <div className="header-right-actions">
        {onToggleControls && (
          <button
            type="button"
            className="header-icon-btn header-hide-controls-btn"
            onClick={onToggleControls}
            title={showControls ? 'Hide Menus / Reading Mode (Click page or Esc)' : 'Show Menus'}
            aria-label={showControls ? 'Hide Menus' : 'Show Menus'}
          >
            {showControls ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </header>
  );
};
