import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Folder,
  Globe,
  Settings as SettingsIcon,
  Trash2,
  Clock,
  Sparkles,
  UserCircle,
  RefreshCw,
  Search,
  FolderOpen,
  ShieldAlert,
} from 'lucide-react';
import { fileManager } from '../../services/fileManager';
import { isMobileDevice } from '../../services/systemUi';
import {
  loadLocalBooksCache,
  saveLocalBookCache,
  storeBookCover,
  blobToThumbnailDataUrl,
  formatLanguageMap,
  formatContributor,
  loadLastLocation,
} from '../../services/storage';
import { LocalBookFile } from '../../types/browse';
import { ReaderSettings } from '../../types/reader';

interface LibraryViewProps {
  settings: ReaderSettings;
  onOpenLocalBook: (file: LocalBookFile, meta?: { title?: string; author?: string; coverUrl?: string }) => void;
  onOpenBrowse: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  settings,
  onOpenLocalBook,
  onOpenBrowse,
  onOpenSettings,
  onOpenProfile,
}) => {
  const [localBooks, setLocalBooks] = useState<LocalBookFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  const isMobile = isMobileDevice();

  useEffect(() => {
    fileManager.hasStoragePermission().then(setHasPermission);
  }, []);

  const handleRequestPermission = async () => {
    await fileManager.requestStoragePermission();
    setTimeout(async () => {
      const granted = await fileManager.hasStoragePermission();
      setHasPermission(granted);
      if (granted) {
        scanFolder();
      }
    }, 1000);
  };

  // Metadata & cover cache state: bookId -> { title, author, coverUrl }
  const [metaCache, setMetaCache] = useState<Record<string, { title: string; author: string; coverUrl?: string }>>(() =>
    loadLocalBooksCache()
  );

  // Scan local books directory
  const scanFolder = useCallback(async () => {
    if (!settings.downloadPath) {
      setLocalBooks([]);
      return;
    }
    setIsLoading(true);
    try {
      const files = await fileManager.scanLocalBooks(settings.downloadPath);
      setLocalBooks(files);
      setMetaCache(loadLocalBooksCache());
    } catch (err) {
      console.error('Failed to scan local books:', err);
    } finally {
      setIsLoading(false);
    }
  }, [settings.downloadPath]);

  useEffect(() => {
    scanFolder();
  }, [scanFolder]);

  // Enrich local books metadata asynchronously
  useEffect(() => {
    let isCancelled = false;

    async function enrichLocalBooks() {
      const currentCache = loadLocalBooksCache();
      const needsEnrich = localBooks.filter((b) => {
        const cached = currentCache[b.id];
        return !cached || !cached.extracted || (cached.author === 'Unknown Author' && !cached.coverUrl);
      });

      if (needsEnrich.length === 0) return;

      for (const book of needsEnrich) {
        if (isCancelled) break;
        try {
          // Read book file bytes
          const file = await fileManager.readBookFile(book.filePath);
          if (!file) continue;

          let title = book.fileName.replace(/\.[^/.]+$/, '');
          let author = 'Unknown Author';
          let coverUrl: string | undefined = currentCache[book.id]?.coverUrl;
          let extracted = false;

          try {
            const { makeBook } = await import('../../foliate-js/view.js');
            const parsedBook: any = await makeBook(file);
            if (parsedBook) {
              if (parsedBook.metadata?.title) {
                title = formatLanguageMap(parsedBook.metadata.title) || title;
              }
              if (parsedBook.metadata?.author || parsedBook.metadata?.creator) {
                author = formatContributor(parsedBook.metadata.author || parsedBook.metadata.creator) || author;
              }
              if (parsedBook.getCover) {
                const coverBlob = await Promise.resolve(parsedBook.getCover());
                if (coverBlob) {
                  await storeBookCover(book.id, coverBlob);
                  coverUrl = await blobToThumbnailDataUrl(coverBlob);
                }
              }
              parsedBook.destroy?.();
              extracted = true;
            }
          } catch (e) {
            console.warn('Metadata extraction failed for:', book.fileName, e);
          }

          const metaItem = { title, author, coverUrl, extracted };
          saveLocalBookCache(book.id, metaItem);

          if (!isCancelled) {
            setMetaCache((prev) => ({ ...prev, [book.id]: metaItem }));
          }
        } catch (err) {
          console.warn('Error enriching book:', book.fileName, err);
        }
      }
    }

    enrichLocalBooks();

    return () => {
      isCancelled = true;
    };
  }, [localBooks]);

  // Delete local book
  const handleDeleteBook = async (book: LocalBookFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = metaCache[book.id]?.title || book.fileName;
    if (confirm(`Delete book "${name}" from device?`)) {
      await fileManager.deleteBookFile(book.filePath);
      await scanFolder();
    }
  };

  // Group / folders
  const allFolders = Array.from(
    new Set(localBooks.map((b) => b.folderName).filter(Boolean) as string[])
  );

  // Filter books by search and selected folder
  const filteredBooks = localBooks.filter((book) => {
    const meta = metaCache[book.id];
    const title = meta?.title || book.fileName;
    const author = meta?.author || '';
    const folder = book.folderName || '';

    const matchesSearch =
      !searchQuery.trim() ||
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      folder.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFolder = !selectedFolder || folder === selectedFolder;

    return matchesSearch && matchesFolder;
  });

  return (
    <div className="library-view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header */}
      <header className="library-header">
        <div className="library-brand">
          <div className="library-logo-icon">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="library-title">Folio</h1>
            <p className="library-subtitle">My Library</p>
          </div>
        </div>

        <div className="library-header-actions">
          {/* Browse Folio Online Library */}
          <button
            type="button"
            className="library-open-btn"
            onClick={onOpenBrowse}
            title="Folio Catalog (Online Library)"
          >
            <Globe size={17} />
            <span className="library-open-btn-text">Folio Catalog</span>
          </button>

          {/* Refresh Folder */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={scanFolder}
            title="Refresh books list"
          >
            <RefreshCw size={17} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Settings */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={onOpenSettings}
            title="Folder & Theme Settings"
          >
            <SettingsIcon size={17} />
          </button>

          {/* Profile */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={onOpenProfile}
            title="Profile & Account"
          >
            <UserCircle size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="library-main-content" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Permission prompt banner for Android */}
        {isMobile && !hasPermission && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              backgroundColor: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
              <ShieldAlert size={20} style={{ color: '#eab308', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                Storage permission is required to download and read books on Android.
              </span>
            </div>
            <button
              type="button"
              className="auth-btn-primary"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={handleRequestPermission}
            >
              Grant Permission
            </button>
          </div>
        )}
        {/* Search & Folder filters */}
        {localBooks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search my books..."
                  className="auth-input"
                  style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                />
              </div>
            </div>

            {/* Folder filter pills */}
            {allFolders.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                <button
                  type="button"
                  className={`theme-pill ${!selectedFolder ? 'active' : ''}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-full)',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setSelectedFolder(null)}
                >
                  All Books ({localBooks.length})
                </button>
                {allFolders.map((folder) => {
                  const count = localBooks.filter(
                    (b) => b.folderName === folder
                  ).length;
                  return (
                    <button
                      key={folder}
                      type="button"
                      className={`theme-pill ${selectedFolder === folder ? 'active' : ''}`}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 'var(--radius-full)',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      onClick={() => setSelectedFolder(folder)}
                    >
                      <Folder size={12} />
                      <span>{folder}</span>
                      <span style={{ opacity: 0.7 }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Local Books Section */}
        <section className="library-recent-section">
          <div className="recent-section-header">
            <h2 className="recent-section-title">
              {selectedFolder ? `Series: ${selectedFolder}` : 'Books on Device'}
            </h2>
            {filteredBooks.length > 0 && (
              <span className="recent-section-count">
                {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
              </span>
            )}
          </div>

          {!settings.downloadPath ? (
            <div className="library-empty-box">
              <FolderOpen size={40} className="empty-box-icon" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                Books folder not configured
              </h3>
              <p style={{ maxWidth: 400 }}>
                Select a folder on your device to automatically scan and save books.
              </p>
              <button
                type="button"
                className="auth-btn-primary"
                onClick={onOpenSettings}
                style={{ marginTop: 8 }}
              >
                Configure Folder
              </button>
            </div>
          ) : localBooks.length === 0 ? (
            <div className="library-empty-box">
              <Sparkles size={40} className="empty-box-icon" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                No books in folder yet
              </h3>
              <p style={{ maxWidth: 420, width: '100%', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                Folder: <code style={{ fontSize: 12, wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{settings.downloadPath}</code>
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="auth-btn-primary"
                  onClick={onOpenBrowse}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Globe size={16} />
                  <span>Folio Catalog</span>
                </button>
                <button
                  type="button"
                  className="auth-btn-secondary"
                  onClick={scanFolder}
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="library-empty-box">
              <p>No books found matching your query.</p>
            </div>
          ) : (
            <div className="books-grid">
              {filteredBooks.map((book) => {
                const meta = metaCache[book.id];
                const title = meta?.title || book.fileName.replace(/\.[^/.]+$/, '');
                const author = meta?.author || 'Unknown Author';
                const folderName = book.folderName;

                // Reading location & progress
                const location = loadLastLocation(book.id);
                const percent = Math.round((location?.fraction || 0) * 100);

                return (
                  <div
                    key={book.id}
                    className="book-card"
                    onClick={() => onOpenLocalBook(book, meta)}
                  >
                    <div className="book-card-cover-wrap">
                      {/* Background placeholder */}
                      <div className="book-card-cover-placeholder">
                        <BookOpen size={36} />
                      </div>

                      {/* Cover image */}
                      {meta?.coverUrl && (
                        <img
                          src={meta.coverUrl}
                          alt={title}
                          className="book-card-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}

                      {/* Folder/Series badge */}
                      {folderName && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            color: '#c084fc',
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 6,
                            zIndex: 5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            maxWidth: '85%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={folderName}
                        >
                          <Folder size={10} />
                          <span>{folderName}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        className="book-card-delete-btn"
                        onClick={(e) => handleDeleteBook(book, e)}
                        title="Delete book file"
                        aria-label="Delete book"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="book-card-details">
                      <h4 className="book-card-title" title={title}>
                        {title}
                      </h4>
                      <p className="book-card-author" title={author}>
                        {author}
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

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 4,
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span>
                          {book.fileSize
                            ? `${(book.fileSize / (1024 * 1024)).toFixed(1)} MB`
                            : ''}
                        </span>

                        {book.modifiedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={11} />
                            <span>
                              {new Date(book.modifiedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
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
