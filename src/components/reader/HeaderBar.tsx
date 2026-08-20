import { Library, PanelLeft, Pin, PinOff, Sliders } from "lucide-react";
import React from "react";

interface HeaderBarProps {
  onBackToLibrary: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
  settingsBtnRef?: React.RefObject<HTMLButtonElement | null>;
  onTogglePin?: () => void;
  isPinned?: boolean;
  chapterTitle?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onBackToLibrary,
  onToggleSidebar,
  isSidebarOpen,
  onToggleSettings,
  isSettingsOpen = false,
  settingsBtnRef,
  onTogglePin,
  isPinned = false,
  chapterTitle,
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
            className={`header-icon-btn header-pin-btn ${isPinned ? "active" : ""}`}
            onClick={onTogglePin}
            title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
            aria-label={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
          >
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        )}
      </div>

      {/* Center Running Head Title */}
      <div className="header-center-title">
        {chapterTitle && (
          <span className="header-chapter-name">{chapterTitle}</span>
        )}
      </div>

      {/* Right Header Actions */}
      <div className="header-right-actions">
        {onToggleSettings && (
          <button
            type="button"
            ref={settingsBtnRef}
            className={`header-icon-btn ${isSettingsOpen ? "active" : ""}`}
            onClick={onToggleSettings}
            title="Appearance & Settings"
            aria-label="Appearance & Settings"
          >
            <Sliders size={16} />
          </button>
        )}
      </div>
    </header>
  );
};


