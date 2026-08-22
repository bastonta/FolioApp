import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { BookMetadata } from '../../types/reader';
import {
  Globe,
  Calendar,
  Building,
  Tag,
  Hash,
  BookOpen,
  RefreshCw,
  Copy,
  Check,
  AlignLeft,
  BookmarkCheck,
} from 'lucide-react';

interface BookInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BookMetadata | null;
  progressPercent?: number;
  currentChapter?: string;
  onSyncProgress?: () => Promise<void> | void;
  isSyncing?: boolean;
  syncMessage?: string | null;
}

const formatLanguage = (lang?: string): string => {
  if (!lang) return '';
  const map: Record<string, string> = {
    ru: 'Russian (ru)',
    en: 'English (en)',
    es: 'Spanish (es)',
    fr: 'French (fr)',
    de: 'German (de)',
    it: 'Italian (it)',
    zh: 'Chinese (zh)',
    ja: 'Japanese (ja)',
    ko: 'Korean (ko)',
    uk: 'Ukrainian (uk)',
    pl: 'Polish (pl)',
    pt: 'Portuguese (pt)',
    tr: 'Turkish (tr)',
    kk: 'Kazakh (kk)',
  };
  const code = lang.toLowerCase().trim();
  return map[code] || lang;
};

const parseSubjects = (subject?: string[] | string): string[] => {
  if (!subject) return [];
  const rawList = Array.isArray(subject) ? subject : subject.split(/[,;|]/);
  return rawList
    .map((s) => s.trim().replace(/_/g, ' '))
    .filter(Boolean);
};

export const BookInfoModal: React.FC<BookInfoModalProps> = ({
  isOpen,
  onClose,
  metadata,
  progressPercent,
  currentChapter,
  onSyncProgress,
  isSyncing = false,
  syncMessage,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  if (!metadata) return null;

  const subjects = parseSubjects(metadata.subject);

  const handleCopyIdentifier = () => {
    if (!metadata.identifier) return;
    navigator.clipboard.writeText(metadata.identifier);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Details" maxWidth="580px">
      <div className="book-info-layout">
        {/* Book Cover */}
        <div className="book-info-cover-wrap">
          {metadata.coverUrl ? (
            <img
              src={metadata.coverUrl}
              alt={metadata.title}
              className="book-info-cover-img"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="book-info-cover-placeholder">
              <BookOpen size={36} />
            </div>
          )}
        </div>

        {/* Core Metadata */}
        <div className="book-info-details">
          <h3 className="book-info-title">{metadata.title || 'Untitled Book'}</h3>
          <p className="book-info-author">{metadata.author || 'Unknown Author'}</p>

          <div className="book-info-meta-list">
            {metadata.publisher && (
              <div className="book-info-meta-item">
                <Building size={15} className="book-info-icon" />
                <span className="book-info-meta-label">Publisher:</span>
                <span className="book-info-meta-val">{metadata.publisher}</span>
              </div>
            )}

            {metadata.published && (
              <div className="book-info-meta-item">
                <Calendar size={15} className="book-info-icon" />
                <span className="book-info-meta-label">Published:</span>
                <span className="book-info-meta-val">{metadata.published}</span>
              </div>
            )}

            {metadata.language && (
              <div className="book-info-meta-item">
                <Globe size={15} className="book-info-icon" />
                <span className="book-info-meta-label">Language:</span>
                <span className="book-info-meta-val">{formatLanguage(metadata.language)}</span>
              </div>
            )}

            {metadata.identifier && (
              <div className="book-info-meta-item" style={{ alignItems: 'flex-start' }}>
                <Hash size={15} className="book-info-icon" style={{ marginTop: 2 }} />
                <span className="book-info-meta-label">ID:</span>
                <div className="book-info-id-wrapper">
                  <span className="book-info-id-badge" title={metadata.identifier}>
                    {metadata.identifier}
                  </span>
                  <button
                    type="button"
                    className="book-info-copy-btn"
                    onClick={handleCopyIdentifier}
                    title="Copy Identifier"
                    aria-label="Copy Identifier"
                  >
                    {copiedId ? <Check size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Genres / Subject Tag Chips */}
      {subjects.length > 0 && (
        <div className="book-info-section book-info-tags-section">
          <div className="book-info-section-header">
            <Tag size={14} className="book-info-icon" />
            <span className="book-info-section-title">Subjects & Genres</span>
          </div>
          <div className="book-info-chips-list">
            {subjects.map((sub, idx) => (
              <span key={`${sub}-${idx}`} className="book-info-chip">
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reading Progress & Server Sync Card */}
      {(progressPercent !== undefined || onSyncProgress) && (
        <div className="book-info-progress-card">
          <div className="book-info-progress-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookmarkCheck size={16} className="book-info-icon" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Reading Progress
              </span>
            </div>
            {progressPercent !== undefined && (
              <span className="book-info-progress-pct">{Math.round(progressPercent)}%</span>
            )}
          </div>

          {progressPercent !== undefined && (
            <div className="book-info-progress-track">
              <div
                className="book-info-progress-fill"
                style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
              />
            </div>
          )}

          {currentChapter && (
            <p className="book-info-progress-chapter" title={currentChapter}>
              Current: {currentChapter}
            </p>
          )}

          {onSyncProgress && (
            <div className="book-info-sync-row">
              <button
                type="button"
                className="book-info-sync-btn"
                onClick={onSyncProgress}
                disabled={isSyncing}
                title="Fetch latest reading progress from server"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Progress with Server'}</span>
              </button>
              {syncMessage && (
                <span className="book-info-sync-msg">{syncMessage}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Book Description */}
      {metadata.description && (
        <div className="book-info-section book-info-description">
          <div className="book-info-section-header">
            <AlignLeft size={14} className="book-info-icon" />
            <h4 className="book-info-desc-heading">Description</h4>
          </div>
          <div
            className="book-info-desc-body"
            dangerouslySetInnerHTML={{ __html: metadata.description }}
          />
        </div>
      )}
    </Modal>
  );
};

