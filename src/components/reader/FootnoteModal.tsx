import React from 'react';
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
  if (!footnote) return null;

  return (
    <div className="footnote-modal-backdrop" onClick={onClose}>
      <div
        className="footnote-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="footnote-title"
      >
        <div className="footnote-modal-header">
          <h4 id="footnote-title" className="footnote-modal-title">
            {footnote.title || 'Endnote'}
          </h4>
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
          <button
            type="button"
            className="footnote-btn footnote-btn-primary"
            onClick={() => {
              onClose();
              onNavigate(footnote.href);
            }}
          >
            Go to Endnote
          </button>
        </div>
      </div>
    </div>
  );
};
