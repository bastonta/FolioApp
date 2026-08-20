import { Eye, EyeOff, Library, PanelLeft, Pin, PinOff, Search, Sliders } from "lucide-react";
import React from "react";

interface HeaderBarProps {
  onBackToLibrary: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onToggleSearch: () => void;
  isSearchActive: boolean;
  onToggleSettings: () => void;
  isSettingsOpen: boolean;
  onTogglePin?: () => void;
  isPinned?: boolean;
  chapterTitle?: string;
  settingsBtnRef: React.RefObject<HTMLButtonElement | null>;
  onToggleControls?: () => void;
  showControls?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onBackToLibrary,
  onToggleSidebar,
  isSidebarOpen,
  onToggleSearch,
  isSearchActive,
  onToggleSettings,
  isSettingsOpen,
  onTogglePin,
  isPinned = false,
  chapterTitle,
  settingsBtnRef,
  onToggleControls,
  showControls = true,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <header
      className="reader-header-bar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Left Header Controls */}
      <div className="header-left-actions">
        {/* Back to Library - Simple Icon Button without highlight */}
        <button
          type="button"
          className="header-icon-btn header-library-btn"
          onClick={onBackToLibrary}
          title="Back to Library"
          aria-label="Back to Library"
        >
          <Library size={16} />
        </button>

        <div className="header-separator" />

        {/* Sidebar Toggle & Pin Controls grouped together */}
        <button
          type="button"
          className={`header-icon-btn ${isSidebarOpen ? "active" : ""}`}
          onClick={onToggleSidebar}
          title={
            isSidebarOpen
              ? "Hide Sidebar (Contents & Annotations)"
              : "Show Sidebar (Contents & Annotations)"
          }
          aria-label="Toggle Sidebar"
        >
          <PanelLeft size={16} />
        </button>

        {onTogglePin && (
          <button
            type="button"
            className={`header-icon-btn ${isPinned ? "active" : ""}`}
            onClick={onTogglePin}
            title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
            aria-label={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
          >
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        )}

        <div className="header-separator" />

        {/* Search in Book */}
        <button
          type="button"
          className={`header-icon-btn ${isSearchActive ? "active" : ""}`}
          onClick={onToggleSearch}
          title="Search in Book"
          aria-label="Search"
        >
          <Search size={16} />
        </button>

        {/* Reader Settings */}
        <button
          type="button"
          ref={settingsBtnRef}
          className={`header-icon-btn ${isSettingsOpen ? "active" : ""}`}
          onClick={onToggleSettings}
          title="Reader Settings"
          aria-label="Settings"
        >
          <Sliders size={16} />
        </button>
      </div>

      {/* Center Running Head Title */}
      <div className="header-center-title">
        {chapterTitle && (
          <span className="header-chapter-name">{chapterTitle}</span>
        )}
      </div>

      {/* Right Header Actions */}
      <div className="header-right-actions">
        {onToggleControls && (
          <button
            type="button"
            className="header-icon-btn header-hide-controls-btn"
            onClick={onToggleControls}
            title={
              showControls
                ? "Hide Menus / Reading Mode (Click page or Esc)"
                : "Show Menus"
            }
            aria-label={showControls ? "Hide Menus" : "Show Menus"}
          >
            {showControls ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </header>
  );
};
