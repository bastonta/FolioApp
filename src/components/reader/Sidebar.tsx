import React from 'react';
import { BookMetadata, TOCItem, Annotation, Bookmark } from '../../types/reader';
import { TOCView } from './TOCView';
import { AnnotationsView } from './AnnotationsView';
import { BookmarksView } from './BookmarksView';
import {
  List,
  Edit3,
  Bookmark as BookmarkIcon,
  Info,
  BookOpen,
  Pin,
  PinOff,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  isPinned: boolean;
  onTogglePin?: () => void;
  activeTab: 'contents' | 'annotations' | 'bookmarks';
  onTabChange: (tab: 'contents' | 'annotations' | 'bookmarks') => void;
  metadata: BookMetadata | null;
  toc: TOCItem[];
  currentHref: string | null;
  onSelectTOC: (href: string) => void;
  annotations: Annotation[];
  onSelectAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (value: string) => void;
  bookmarks: Bookmark[];
  onSelectBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (id: string) => void;
  onAddCurrentBookmark: () => void;
  onOpenBookInfo: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isPinned,
  onTogglePin,
  activeTab,
  onTabChange,
  metadata,
  toc,
  currentHref,
  onSelectTOC,
  annotations,
  onSelectAnnotation,
  onDeleteAnnotation,
  bookmarks,
  onSelectBookmark,
  onDeleteBookmark,
  onAddCurrentBookmark,
  onOpenBookInfo,
}) => {
  if (!isOpen) return null;

  return (
    <aside className={`sidebar-container ${isPinned ? 'pinned' : 'floating'}`}>
      {/* Book Metadata Header matching Screenshot 1 */}
      <div className="sidebar-book-header">
        <div className="sidebar-book-cover-wrap">
          {metadata?.coverUrl ? (
            <img
              src={metadata.coverUrl}
              alt={metadata.title || 'Book Cover'}
              className="sidebar-book-cover"
            />
          ) : (
            <div className="sidebar-book-cover-placeholder">
              <BookOpen size={24} />
            </div>
          )}
        </div>

        <div className="sidebar-book-info">
          <h4 className="sidebar-book-title" title={metadata?.title}>
            {metadata?.title || 'Untitled'}
          </h4>
          <p className="sidebar-book-author" title={metadata?.author}>
            {metadata?.author || 'Unknown Author'}
          </p>
        </div>

        <div className="sidebar-header-actions">
          <button
            type="button"
            className="sidebar-info-btn"
            onClick={onOpenBookInfo}
            title="Book Details"
            aria-label="Book Details"
          >
            <Info size={16} />
          </button>

          {onTogglePin && (
            <button
              type="button"
              className={`sidebar-info-btn sidebar-pin-btn ${isPinned ? 'active' : ''}`}
              onClick={onTogglePin}
              title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
              aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
            >
              {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="sidebar-content-body">
        {activeTab === 'contents' && (
          <TOCView
            toc={toc}
            currentHref={currentHref}
            onSelect={onSelectTOC}
          />
        )}

        {activeTab === 'annotations' && (
          <AnnotationsView
            annotations={annotations}
            onSelectAnnotation={onSelectAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
          />
        )}

        {activeTab === 'bookmarks' && (
          <BookmarksView
            bookmarks={bookmarks}
            onSelectBookmark={onSelectBookmark}
            onDeleteBookmark={onDeleteBookmark}
            onAddCurrentBookmark={onAddCurrentBookmark}
          />
        )}
      </div>

      {/* Bottom Tabs Switcher matching Screenshots 1 & 3 */}
      <nav className="sidebar-bottom-nav" aria-label="Sidebar navigation">
        <button
          type="button"
          className={`sidebar-nav-tab ${activeTab === 'contents' ? 'active' : ''}`}
          onClick={() => onTabChange('contents')}
        >
          <List size={16} />
          <span>Contents</span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-tab ${activeTab === 'annotations' ? 'active' : ''}`}
          onClick={() => onTabChange('annotations')}
        >
          <Edit3 size={16} />
          <span>Annotations</span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => onTabChange('bookmarks')}
        >
          <BookmarkIcon size={16} />
          <span>Bookmarks</span>
        </button>
      </nav>
    </aside>
  );
};
