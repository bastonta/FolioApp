import React, { useRef, useState } from 'react';
import { RecentBook } from '../../types/reader';
import {
  BookOpen,
  FolderOpen,
  UploadCloud,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface LibraryViewProps {
  recentBooks: RecentBook[];
  onOpenBookFile: (file: File | Blob, bookMeta?: Partial<RecentBook>) => void;
  onOpenRecentBook: (book: RecentBook) => void;
  onDeleteRecentBook: (id: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  recentBooks,
  onOpenBookFile,
  onOpenRecentBook,
  onDeleteRecentBook,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenBookFile(file, {
        id: `book-${Date.now()}-${file.name}`,
        fileName: file.name,
        fileSize: file.size,
        title: file.name.replace(/\.[^/.]+$/, ''),
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const item = Array.from(e.dataTransfer.items).find((i) => i.kind === 'file');
    if (item) {
      const file = item.getAsFile();
      if (file) {
        onOpenBookFile(file, {
          id: `book-${Date.now()}-${file.name}`,
          fileName: file.name,
          fileSize: file.size,
          title: file.name.replace(/\.[^/.]+$/, ''),
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="library-view-container">
      {/* Top Header */}
      <header className="library-header">
        <div className="library-brand">
          <div className="library-logo-icon">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="library-title">Folio</h1>
            <p className="library-subtitle">EPUB3 & E-Book Reader</p>
          </div>
        </div>

        <button
          type="button"
          className="library-open-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderOpen size={18} />
          <span>Open Book</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,.mobi,.azw3,.fb2,.cbz"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </header>

      {/* Main Content */}
      <main className="library-main-content">
        {/* Drag & Drop Zone */}
        <div
          className={`library-dropzone ${isDragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={40} className="dropzone-icon" />
          <h3 className="dropzone-title">Drop your EPUB book here</h3>
          <p className="dropzone-hint">
            or click to browse from your computer (EPUB3, MOBI, AZW3, FB2, CBZ)
          </p>
        </div>

        {/* Recent Books List */}
        <section className="library-recent-section">
          <div className="recent-section-header">
            <h2 className="recent-section-title">Recent Books</h2>
            {recentBooks.length > 0 && (
              <span className="recent-section-count">
                {recentBooks.length} {recentBooks.length === 1 ? 'book' : 'books'}
              </span>
            )}
          </div>

          {recentBooks.length === 0 ? (
            <div className="library-empty-box">
              <Sparkles size={32} className="empty-box-icon" />
              <p>No recent books yet. Open an EPUB file to start reading!</p>
            </div>
          ) : (
            <div className="books-grid">
              {recentBooks.map((book) => {
                const percent = Math.round((book.progressFraction || 0) * 100);
                return (
                  <div
                    key={book.id}
                    className="book-card"
                    onClick={() => onOpenRecentBook(book)}
                  >
                    <div className="book-card-cover-wrap">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="book-card-cover"
                        />
                      ) : (
                        <div className="book-card-cover-placeholder">
                          <BookOpen size={36} />
                        </div>
                      )}
                      <button
                        type="button"
                        className="book-card-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecentBook(book.id);
                        }}
                        title="Remove from recent books"
                        aria-label="Remove book"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="book-card-details">
                      <h4 className="book-card-title" title={book.title}>
                        {book.title || 'Untitled'}
                      </h4>
                      <p className="book-card-author" title={book.author}>
                        {book.author || 'Unknown Author'}
                      </p>

                      <div className="book-card-progress-wrap">
                        <div className="book-card-progress-bar">
                          <div
                            className="book-card-progress-fill"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="book-card-percent">{percent}%</span>
                      </div>

                      {book.lastOpenedAt && (
                        <div className="book-card-date">
                          <Clock size={12} />
                          <span>
                            {new Date(book.lastOpenedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
