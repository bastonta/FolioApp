import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { FootnoteData } from '../../types/reader';

interface FootnoteModalProps {
  footnote: FootnoteData | null;
  onClose: () => void;
  onNavigate: (href: string) => void;
}

export const FootnoteModal: React.FC<FootnoteModalProps> = ({
  footnote,
  onClose,
  onNavigate,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (footnote) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [footnote, onClose]);

  if (!footnote) return null;

  return (
    <div className="footnote-modal-backdrop" onClick={onClose}>
      <div
        className="footnote-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="footnote-title"
        aria-modal="true"
      >
        <div className="footnote-modal-header">
          <h4 id="footnote-title" className="footnote-modal-title">
            {footnote.title || 'Note'}
          </h4>
          <button
            type="button"
            className="footnote-close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="footnote-modal-body"
          dangerouslySetInnerHTML={{ __html: footnote.contentHtml }}
        />

        <div className="footnote-modal-footer">
          <button
            type="button"
            className="footnote-btn footnote-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
          {footnote.href && (
            <button
              type="button"
              className="footnote-btn footnote-btn-primary"
              onClick={() => {
                onClose();
                onNavigate(footnote.href);
              }}
              title="Jump to note section in book"
            >
              <ExternalLink size={14} style={{ marginRight: 6 }} />
              Go to Note
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
