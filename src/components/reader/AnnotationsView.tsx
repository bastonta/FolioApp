import React, { useState, useMemo } from 'react';
import { Annotation } from '../../types/reader';
import { Trash2, Search, Highlighter } from 'lucide-react';

interface AnnotationsViewProps {
  annotations: Annotation[];
  onSelectAnnotation: (annotation: Annotation) => void;
  onDeleteAnnotation: (value: string) => void;
}

export const AnnotationsView: React.FC<AnnotationsViewProps> = ({
  annotations,
  onSelectAnnotation,
  onDeleteAnnotation,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredAnnotations = useMemo(() => {
    if (!filterQuery.trim()) return annotations;
    const q = filterQuery.toLowerCase();
    return annotations.filter(
      (a) =>
        a.text.toLowerCase().includes(q) ||
        (a.note && a.note.toLowerCase().includes(q)) ||
        (a.chapterTitle && a.chapterTitle.toLowerCase().includes(q))
    );
  }, [annotations, filterQuery]);

  return (
    <div className="annotations-view-container">
      <div className="annotations-list-scroll">
        {filteredAnnotations.length === 0 ? (
          <div className="sidebar-empty-state">
            <Highlighter size={28} className="empty-state-icon" />
            <p>
              {filterQuery.trim()
                ? 'No matching annotations found.'
                : 'No annotations yet. Select text in the book to highlight or add notes.'}
            </p>
          </div>
        ) : (
          <div className="annotations-cards-list">
            {filteredAnnotations.map((ann) => (
              <div
                key={ann.id || ann.value}
                className="annotation-card"
                onClick={() => onSelectAnnotation(ann)}
              >
                <div className="annotation-card-top">
                  <span
                    className="annotation-dot"
                    style={{ backgroundColor: ann.color || '#eab308' }}
                  />
                  <p className="annotation-quote-text" title={ann.text}>
                    {ann.text}
                  </p>
                </div>

                {ann.note && <div className="annotation-note-text">{ann.note}</div>}

                <div className="annotation-card-footer">
                  <span className="annotation-time">
                    {ann.createdAt
                      ? new Date(ann.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                  <button
                    type="button"
                    className="annotation-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAnnotation(ann.value);
                    }}
                    title="Delete annotation"
                    aria-label="Delete annotation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter bar at bottom matching screenshot 3 */}
      <div className="annotations-filter-bar">
        <div className="filter-input-wrap">
          <Search size={14} className="filter-search-icon" />
          <input
            type="text"
            className="filter-input"
            placeholder="Filter annotations..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="filter-clear-btn"
              onClick={() => setFilterQuery('')}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
