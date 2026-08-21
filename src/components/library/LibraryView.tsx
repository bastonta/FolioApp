import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ArrowLeft,
  X,
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
import { FolderStackCover } from './FolderStackCover';

interface LibraryViewProps {
  settings: ReaderSettings;
  onOpenLocalBook: (file: LocalBookFile, meta?: { title?: string; author?: string; coverUrl?: string }) => void;
  onOpenBrowse: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onUpdateSettings?: (settings: Partial<ReaderSettings>) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  settings,
  onOpenLocalBook,
  onOpenBrowse,
  onOpenSettings,
  onOpenProfile,
  onUpdateSettings,
}) => {
  const [localBooks, setLocalBooks] = useState<LocalBookFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  const isMobile = isMobileDevice();

  // View mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return settings.libraryViewMode || (localStorage.getItem('folio_library_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('folio_library_view_mode', mode);
    onUpdateSettings?.({ libraryViewMode: mode });
  };

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

  // Delete entire folder
  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const booksInFolder = localBooks.filter((b) => b.folderName === folderName);
    if (confirm(`Delete folder "${folderName}" and all ${booksInFolder.length} books inside?`)) {
      for (const book of booksInFolder) {
        await fileManager.deleteBookFile(book.filePath);
      }
      if (selectedFolder === folderName) {
        setSelectedFolder(null);
      }
      await scanFolder();
    }
  };

  // Group books by folders
  const { folderMap, rootBooks, folderNames } = useMemo(() => {
    const map = new Map<string, LocalBookFile[]>();
    const roots: LocalBookFile[] = [];

    for (const book of localBooks) {
      if (book.folderName) {
        const existing = map.get(book.folderName) || [];
        existing.push(book);
        map.set(book.folderName, existing);
      } else {
        roots.push(book);
      }
    }

    const folders = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return { folderMap: map, rootBooks: roots, folderNames: folders };
  }, [localBooks]);

  // Handle Search Filtering
  const isSearching = searchQuery.trim().length > 0;
  const filteredSearchBooks = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase().trim();
    return localBooks.filter((book) => {
      const meta = metaCache[book.id];
      const title = (meta?.title || book.fileName).toLowerCase();
      const author = (meta?.author || '').toLowerCase();
      const folder = (book.folderName || '').toLowerCase();
      return title.includes(q) || author.includes(q) || folder.includes(q);
    });
  }, [isSearching, searchQuery, localBooks, metaCache]);

  // Current folder's books (when inside a folder)
  const currentFolderBooks = useMemo(() => {
    if (!selectedFolder) return [];
    return folderMap.get(selectedFolder) || [];
  }, [selectedFolder, folderMap]);

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
              marginBottom: 12,
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

        {/* Toolbar: Search, View Mode Toggle & Folder Path */}
        {localBooks.length > 0 && (
          <div className="library-toolbar-container">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search input */}
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
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
                  placeholder="Search downloaded books & folders..."
                  className="auth-input"
                  style={{ paddingLeft: 36, paddingRight: searchQuery ? 32 : 12, height: 38, fontSize: 13 }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      padding: 2,
                    }}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* View mode toggle (Grid / List) */}
              <div className="view-mode-toggle-group">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => handleToggleViewMode('grid')}
                  title="Grid View"
                  aria-label="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => handleToggleViewMode('list')}
                  title="List View"
                  aria-label="List View"
                >
                  <ListIcon size={16} />
                </button>
              </div>
            </div>

            {/* Folder Breadcrumb & Navigation */}
            {selectedFolder && !isSearching && (
              <div className="library-folder-breadcrumb">
                <button
                  type="button"
                  className="breadcrumb-back-btn"
                  onClick={() => setSelectedFolder(null)}
                >
                  <ArrowLeft size={15} />
                  <span>All Books</span>
                </button>
                <ChevronRight size={14} className="breadcrumb-separator" />
                <span className="breadcrumb-current-folder">
                  <Folder size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>{selectedFolder}</span>
                  <span className="breadcrumb-count">
                    ({currentFolderBooks.length} {currentFolderBooks.length === 1 ? 'book' : 'books'})
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Local Books Section */}
        <section className="library-recent-section">
          {/* Section title & count */}
          {!settings.downloadPath ? null : localBooks.length === 0 ? null : (
            <div className="recent-section-header">
              <h2 className="recent-section-title">
                {isSearching
                  ? `Search: "${searchQuery}"`
                  : selectedFolder
                  ? selectedFolder
                  : 'Books & Collections'}
              </h2>
              <span className="recent-section-count">
                {isSearching
                  ? `${filteredSearchBooks.length} found`
                  : selectedFolder
                  ? `${currentFolderBooks.length} ${currentFolderBooks.length === 1 ? 'book' : 'books'}`
                  : `${localBooks.length} ${localBooks.length === 1 ? 'book' : 'books'}${
                      folderNames.length > 0 ? ` in ${folderNames.length} folders` : ''
                    }`}
              </span>
            </div>
          )}

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
          ) : isSearching ? (
            /* Search results view */
            filteredSearchBooks.length === 0 ? (
              <div className="library-empty-box">
                <p>No books found matching &ldquo;{searchQuery}&rdquo;.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="books-grid">
                {filteredSearchBooks.map((book) => renderBookCardGrid(book))}
              </div>
            ) : (
              <div className="books-list">
                {filteredSearchBooks.map((book) => renderBookItemRow(book))}
              </div>
            )
          ) : selectedFolder ? (
            /* Inside a folder view */
            currentFolderBooks.length === 0 ? (
              <div className="library-empty-box">
                <p>No books in this folder.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="books-grid">
                {currentFolderBooks.map((book) => renderBookCardGrid(book))}
              </div>
            ) : (
              <div className="books-list">
                {currentFolderBooks.map((book) => renderBookItemRow(book))}
              </div>
            )
          ) : (
            /* Root view: folders & top-level books */
            viewMode === 'grid' ? (
              <div className="books-grid">
                {/* 1. Folders as grid cards */}
                {folderNames.map((folderName) => {
                  const booksInFolder = folderMap.get(folderName) || [];
                  return (
                    <div
                      key={`folder-${folderName}`}
                      className="folder-grid-card"
                      onClick={() => setSelectedFolder(folderName)}
                      title={`Open folder: ${folderName}`}
                    >
                      {/* Top folder title header (as in screenshot) */}
                      <div className="folder-grid-header">
                        <span className="folder-grid-title" title={folderName}>
                          {folderName}
                        </span>
                      </div>

                      {/* Stacked covers */}
                      <div className="folder-stack-container">
                        <FolderStackCover books={booksInFolder} metaCache={metaCache} />
                        <span className="folder-count-badge">
                          <Folder size={10} />
                          <span>{booksInFolder.length}</span>
                        </span>
                        <button
                          type="button"
                          className="folder-delete-btn"
                          onClick={(e) => handleDeleteFolder(folderName, e)}
                          title={`Delete folder "${folderName}"`}
                          aria-label="Delete folder"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Details at bottom */}
                      <div className="folder-grid-footer">
                        <div className="folder-footer-info">
                          <span className="folder-footer-count">
                            {booksInFolder.length} {booksInFolder.length === 1 ? 'book' : 'books'}
                          </span>
                        </div>
                        <span className="folder-open-action">
                          <span>Open</span>
                          <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* 2. Root books as grid cards */}
                {rootBooks.map((book) => renderBookCardGrid(book))}
              </div>
            ) : (
              /* List view: folders & top-level books */
              <div className="books-list">
                {/* 1. Folders as list items */}
                {folderNames.map((folderName) => {
                  const booksInFolder = folderMap.get(folderName) || [];
                  const sampleAuthors = Array.from(
                    new Set(
                      booksInFolder
                        .map((b) => metaCache[b.id]?.author)
                        .filter((a) => a && a !== 'Unknown Author')
                    )
                  ).slice(0, 2).join(', ');

                  return (
                    <div
                      key={`folder-${folderName}`}
                      className="folder-list-item"
                      onClick={() => setSelectedFolder(folderName)}
                    >
                      {/* Mini stacked cover thumbnail */}
                      <div className="folder-list-thumbnail-wrap">
                        <FolderStackCover books={booksInFolder} metaCache={metaCache} compact={true} />
                      </div>

                      {/* Folder info */}
                      <div className="book-list-details">
                        <div className="folder-list-title-row">
                          <h4 className="book-list-title folder-title">
                            {folderName}
                          </h4>
                          <span className="folder-list-badge">
                            {booksInFolder.length} {booksInFolder.length === 1 ? 'book' : 'books'}
                          </span>
                        </div>

                        {sampleAuthors && (
                          <p className="book-list-author" title={sampleAuthors}>
                            {sampleAuthors}
                          </p>
                        )}
                        <p className="folder-list-hint">
                          Collection folder • Click to open
                        </p>
                      </div>

                      {/* Right side actions */}
                      <div className="folder-list-right">
                        <button
                          type="button"
                          className="list-delete-btn"
                          onClick={(e) => handleDeleteFolder(folderName, e)}
                          title="Delete folder"
                          aria-label="Delete folder"
                        >
                          <Trash2 size={15} />
                        </button>
                        <ChevronRight size={18} className="folder-list-arrow" />
                      </div>
                    </div>
                  );
                })}

                {/* 2. Root books as list items */}
                {rootBooks.map((book) => renderBookItemRow(book))}
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );

  // Helper renderer: Book Card for Grid View
  function renderBookCardGrid(book: LocalBookFile) {
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

          {/* Folder/Series badge if in search view */}
          {folderName && isSearching && (
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

          {/* Percent badge overlay in grid (as in e-reader reference) */}
          {percent > 0 && (
            <span className="book-card-percent-badge">
              {percent}%
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
  }

  // Helper renderer: Book Item Row for List View (matching screenshot 1)
  function renderBookItemRow(book: LocalBookFile) {
    const meta = metaCache[book.id];
    const title = meta?.title || book.fileName.replace(/\.[^/.]+$/, '');
    const author = meta?.author || 'Unknown Author';
    const folderName = book.folderName;

    // Reading location & progress
    const location = loadLastLocation(book.id);
    const fraction = location?.fraction || 0;
    const percent = Math.round(fraction * 100);
    const readingStatus = percent >= 100 ? 'Completed' : percent > 0 ? 'Reading' : 'Not started';

    return (
      <div
        key={book.id}
        className="book-list-item"
        onClick={() => onOpenLocalBook(book, meta)}
      >
        {/* Cover thumbnail on the left */}
        <div className="book-list-thumbnail-wrap">
          {meta?.coverUrl ? (
            <img
              src={meta.coverUrl}
              alt={title}
              className="book-list-thumbnail"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="book-list-thumbnail-placeholder">
              <BookOpen size={20} />
            </div>
          )}
        </div>

        {/* Center book info: Title, Series/Folder subtitle, Author */}
        <div className="book-list-details">
          <h4 className="book-list-title" title={title}>
            {title}
          </h4>

          {folderName && (
            <p className="book-list-subtitle" title={folderName}>
              <Folder size={11} style={{ opacity: 0.7 }} />
              <span>{folderName}</span>
            </p>
          )}

          <p className="book-list-author" title={author}>
            {author}
          </p>
        </div>

        {/* Right side reading status & progress */}
        <div className="book-list-reading-info">
          <span className="book-list-status">{readingStatus}</span>
          <span className="book-list-percent">{percent}%</span>
        </div>

        {/* Delete button */}
        <div className="book-list-actions">
          <button
            type="button"
            className="list-delete-btn"
            onClick={(e) => handleDeleteBook(book, e)}
            title="Delete book"
            aria-label="Delete book"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  }
};
