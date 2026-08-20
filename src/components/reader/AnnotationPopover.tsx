import React, { useState, useEffect, useRef } from 'react';
import { Annotation } from '../../types/reader';
import { Copy, Trash2, Check, MessageSquare } from 'lucide-react';

export interface SelectionInfo {
  text: string;
  cfi: string;
  sectionIndex: number;
  rect: { x: number; y: number; width: number; height: number };
  existingAnnotation?: Annotation;
}

interface AnnotationPopoverProps {
  selection: SelectionInfo | null;
  onClose: () => void;
  onSave: (annotation: {
    value: string;
    text: string;
    color: string;
    style: 'highlight' | 'underline' | 'squiggly' | 'strikethrough';
    note?: string;
    sectionIndex: number;
  }) => void;
  onDelete?: (value: string) => void;
}

const COLORS = [
  { name: 'Red', color: '#ff7675' },
  { name: 'Yellow', color: '#ffeaa7' },
  { name: 'Green', color: '#55efc4' },
  { name: 'Blue', color: '#74b9ff' },
  { name: 'Purple', color: '#a29bfe' },
];

export const AnnotationPopover: React.FC<AnnotationPopoverProps> = ({
  selection,
  onClose,
  onSave,
  onDelete,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>('#ff7675');
  const [style, setStyle] = useState<'highlight' | 'underline' | 'squiggly' | 'strikethrough'>('highlight');
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selection?.existingAnnotation) {
      setSelectedColor(selection.existingAnnotation.color);
      setStyle(selection.existingAnnotation.style || 'highlight');
      setNoteText(selection.existingAnnotation.note || '');
      setShowNoteInput(!!selection.existingAnnotation.note);
    } else {
      setSelectedColor('#ff7675');
      setStyle('highlight');
      setNoteText('');
      setShowNoteInput(false);
    }
    setCopied(false);
  }, [selection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!selection) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selection.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleSave = (color = selectedColor) => {
    onSave({
      value: selection.cfi,
      text: selection.text,
      color,
      style,
      note: noteText.trim() || undefined,
      sectionIndex: selection.sectionIndex,
    });
    onClose();
  };

  // Position calculation (clamped to screen boundaries)
  const top = Math.max(10, selection.rect.y - 60);
  const left = Math.max(10, Math.min(window.innerWidth - 300, selection.rect.x + selection.rect.width / 2 - 140));

  return (
    <div
      className="annotation-popover"
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 900,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="annotation-popover-main">
        {/* Colors */}
        <div className="annotation-color-picker">
          {COLORS.map((c) => (
            <button
              key={c.color}
              type="button"
              className={`color-dot-btn ${selectedColor === c.color ? 'active' : ''}`}
              style={{ backgroundColor: c.color }}
              onClick={() => {
                setSelectedColor(c.color);
                handleSave(c.color);
              }}
              title={c.name}
            />
          ))}
        </div>

        <div className="annotation-popover-divider" />

        {/* Note button */}
        <button
          type="button"
          className={`popover-action-btn ${showNoteInput ? 'active' : ''}`}
          onClick={() => setShowNoteInput(!showNoteInput)}
          title="Add Note"
        >
          <MessageSquare size={16} />
        </button>

        {/* Copy button */}
        <button
          type="button"
          className="popover-action-btn"
          onClick={handleCopy}
          title="Copy Text"
        >
          {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
        </button>

        {/* Delete button (if existing) */}
        {selection.existingAnnotation && onDelete && (
          <button
            type="button"
            className="popover-action-btn popover-action-delete"
            onClick={() => {
              onDelete(selection.existingAnnotation!.value);
              onClose();
            }}
            title="Delete Annotation"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Note input expander */}
      {showNoteInput && (
        <div className="annotation-note-box">
          <textarea
            className="annotation-note-input"
            rows={2}
            placeholder="Add a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <div className="annotation-note-actions">
            <button
              type="button"
              className="note-action-btn note-save-btn"
              onClick={() => handleSave()}
            >
              Save Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
