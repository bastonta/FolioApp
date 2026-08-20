import React from 'react';
import { Modal } from '../common/Modal';
import { BookMetadata } from '../../types/reader';
import { Globe, Calendar, Building, Tag, Hash } from 'lucide-react';

interface BookInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BookMetadata | null;
}

export const BookInfoModal: React.FC<BookInfoModalProps> = ({
  isOpen,
  onClose,
  metadata,
}) => {
  if (!metadata) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Details" maxWidth="560px">
      <div className="book-info-layout">
        {metadata.coverUrl && (
          <div className="book-info-cover-wrap">
            <img
              src={metadata.coverUrl}
              alt={metadata.title}
              className="book-info-cover-img"
            />
          </div>
        )}
        <div className="book-info-details">
          <h3 className="book-info-title">{metadata.title || 'Untitled'}</h3>
          <p className="book-info-author">{metadata.author || 'Unknown Author'}</p>

          <div className="book-info-meta-list">
            {metadata.publisher && (
              <div className="book-info-meta-item">
                <Building size={16} className="book-info-icon" />
                <span className="book-info-meta-label">Publisher:</span>
                <span className="book-info-meta-val">{metadata.publisher}</span>
              </div>
            )}
            {metadata.published && (
              <div className="book-info-meta-item">
                <Calendar size={16} className="book-info-icon" />
                <span className="book-info-meta-label">Date:</span>
                <span className="book-info-meta-val">{metadata.published}</span>
              </div>
            )}
            {metadata.language && (
              <div className="book-info-meta-item">
                <Globe size={16} className="book-info-icon" />
                <span className="book-info-meta-label">Language:</span>
                <span className="book-info-meta-val">{metadata.language}</span>
              </div>
            )}
            {metadata.identifier && (
              <div className="book-info-meta-item">
                <Hash size={16} className="book-info-icon" />
                <span className="book-info-meta-label">Identifier:</span>
                <span className="book-info-meta-val book-info-id">{metadata.identifier}</span>
              </div>
            )}
            {metadata.subject && (
              <div className="book-info-meta-item">
                <Tag size={16} className="book-info-icon" />
                <span className="book-info-meta-label">Subject:</span>
                <span className="book-info-meta-val">
                  {Array.isArray(metadata.subject) ? metadata.subject.join(', ') : metadata.subject}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {metadata.description && (
        <div className="book-info-description">
          <h4 className="book-info-desc-heading">Description</h4>
          <div
            className="book-info-desc-body"
            dangerouslySetInnerHTML={{ __html: metadata.description }}
          />
        </div>
      )}
    </Modal>
  );
};
