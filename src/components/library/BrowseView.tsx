import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  ArrowUpDown,
  Folder,
  BookOpen,
  Download,
  Check,
  Loader2,
  ChevronRight,
  Home,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { libraryApi, BrowseParams } from '../../api/libraryApi';
import { fileManager } from '../../services/fileManager';
import { getAccessToken, getServerUrl } from '../../api/tokenManager';
import { BrowseItem } from '../../types/browse';
import { ReaderSettings } from '../../types/reader';

interface BrowseViewProps {
  settings: ReaderSettings;
  onBackToLocalLibrary: () => void;
  onOpenBookFromPath?: (filePath: string, title?: string, author?: string) => void;
  onBookDownloaded?: () => void;
}

export const BrowseView: React.FC<BrowseViewProps> = ({
  settings,
  onBackToLocalLibrary,
  onOpenBookFromPath,
  onBookDownloaded,
}) => {
  // Navigation & Folder path
  const [currentSeriesPath, setCurrentSeriesPath] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Search, Filter & Sort
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState<'all' | 'title' | 'author' | 'series'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'sortOrder'>('name');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data & loading states
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Download states: bookId -> 'downloading' | 'downloaded' | 'error'
  const [downloadStates, setDownloadStates] = useState<Record<string, 'downloading' | 'downloaded' | 'error'>>({});
  const [downloadedPaths, setDownloadedPaths] = useState<Record<string, string>>({});

  const currentSeries = currentSeriesPath.length > 0
    ? currentSeriesPath[currentSeriesPath.length - 1]
    : null;

  // Fetch browse items
  const fetchBrowseItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: BrowseParams = {
        seriesId: currentSeries?.id,
        search: search.trim() || undefined,
        searchBy,
        sortBy,
        offset: (page - 1) * limit,
        limit,
      };

      const res = await libraryApi.browse(params);
      setItems(res.items || []);
      setTotalItems(res.total || 0);

      // Check which books are already downloaded locally
      if (settings.downloadPath && res.items) {
        const bookItems = res.items.filter((i) => i.type === 'book');
        for (const book of bookItems) {
          const seriesName = currentSeries?.name;
          const fileName = `${book.name}.epub`;
          const existingPath = await fileManager.checkBookDownloaded({
            baseDir: settings.downloadPath,
            fileName,
            seriesName: settings.createSeriesFolder !== false ? seriesName : undefined,
          });
          if (existingPath) {
            setDownloadedPaths((prev) => ({ ...prev, [book.id]: existingPath }));
            setDownloadStates((prev) => ({ ...prev, [book.id]: 'downloaded' }));
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to browse library:', err);
      setError(err?.message || 'Не удалось загрузить каталог с сервера');
    } finally {
      setIsLoading(false);
    }
  }, [currentSeries, search, searchBy, sortBy, page, settings.downloadPath, settings.createSeriesFolder]);

  useEffect(() => {
    fetchBrowseItems();
  }, [fetchBrowseItems]);

  // Handle folder navigation
  const handleOpenFolder = (item: BrowseItem) => {
    setCurrentSeriesPath((prev) => [...prev, { id: item.id, name: item.name }]);
    setPage(1);
  };

  const handleNavigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentSeriesPath([]);
    } else {
      setCurrentSeriesPath((prev) => prev.slice(0, index + 1));
    }
    setPage(1);
  };

  // Search & Filter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (val.trim() === '' && search !== '') {
      setSearch('');
      setPage(1);
    }
  };

  // Download book handler
  const handleDownloadBook = async (book: BrowseItem) => {
    if (!settings.downloadPath) {
      alert('Пожалуйста, сначала укажите папку скачивания в настройках');
      return;
    }

    setDownloadStates((prev) => ({ ...prev, [book.id]: 'downloading' }));
    try {
      const serverUrl = getServerUrl();
      if (!serverUrl) {
        throw new Error('Адрес сервера не настроен');
      }
      const token = getAccessToken() || undefined;
      const seriesName = settings.createSeriesFolder !== false ? currentSeries?.name : undefined;
      const fileName = `${book.name}.epub`;

      const savedPath = await fileManager.downloadBookFile({
        serverUrl,
        token,
        bookId: book.id,
        fileName,
        seriesName,
        baseDir: settings.downloadPath,
      });

      setDownloadedPaths((prev) => ({ ...prev, [book.id]: savedPath }));
      setDownloadStates((prev) => ({ ...prev, [book.id]: 'downloaded' }));
      onBookDownloaded?.();
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadStates((prev) => ({ ...prev, [book.id]: 'error' }));
      alert(`Ошибка при скачивании книги: ${err?.message || err}`);
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return (
    <div className="library-view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <header className="library-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="header-pill-btn"
            onClick={onBackToLocalLibrary}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            <span>Мои книги</span>
          </button>

          <div className="library-brand">
            <div>
              <h1 className="library-title" style={{ fontSize: 18 }}>Каталог Folio</h1>
              <p className="library-subtitle">Онлайн библиотека сервера</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="header-icon-btn"
          onClick={fetchBrowseItems}
          title="Обновить"
          style={{ width: 36, height: 36 }}
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="library-main-content" style={{ flex: 1, overflowY: 'auto' }}>
        
        {/* Navigation Breadcrumb & Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Breadcrumb Navigation */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text-secondary)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              paddingBottom: 2,
            }}
          >
            <button
              type="button"
              onClick={() => handleNavigateToBreadcrumb(-1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: currentSeriesPath.length === 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
                fontWeight: currentSeriesPath.length === 0 ? 700 : 500,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Home size={15} />
              <span>Главный каталог</span>
            </button>

            {currentSeriesPath.map((folder, idx) => {
              const isLast = idx === currentSeriesPath.length - 1;
              return (
                <React.Fragment key={folder.id}>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <button
                    type="button"
                    onClick={() => handleNavigateToBreadcrumb(idx)}
                    style={{
                      color: isLast ? 'var(--accent-color)' : 'var(--text-secondary)',
                      fontWeight: isLast ? 700 : 500,
                      cursor: 'pointer',
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                    title={folder.name}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Search & Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {/* Search input */}
            <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 200px', minWidth: 160, position: 'relative' }}>
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
                value={searchInput}
                onChange={handleSearchInputChange}
                placeholder="Поиск книг или серий..."
                className="auth-input"
                style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
              />
            </form>

            <div style={{ display: 'flex', gap: 8, flex: '1 1 auto' }}>
              {/* Filter Scope */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 10px',
                  height: 38,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  minWidth: 100,
                }}
              >
                <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <select
                  value={searchBy}
                  onChange={(e) => {
                    setSearchBy(e.target.value as any);
                    setPage(1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <option value="all">Все поля</option>
                  <option value="title">По названию</option>
                  <option value="author">По автору</option>
                  <option value="series">По серии</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 10px',
                  height: 38,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  minWidth: 100,
                }}
              >
                <ArrowUpDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setPage(1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <option value="name">По имени</option>
                  <option value="recent">Сначала новые</option>
                  <option value="sortOrder">По серии</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content list / grid */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Загрузка каталога с сервера...</p>
          </div>
        ) : error ? (
          <div className="library-empty-box" style={{ borderColor: 'var(--danger-color)' }}>
            <p style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{error}</p>
            <button type="button" className="auth-btn-primary" onClick={fetchBrowseItems} style={{ marginTop: 8 }}>
              Попробовать снова
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="library-empty-box">
            <Sparkles size={32} className="empty-box-icon" />
            <p>
              {search
                ? 'По вашему запросу ничего не найдено.'
                : currentSeriesPath.length > 0
                ? 'В этой серии пока нет книг.'
                : 'Каталог на сервере пуст.'}
            </p>
          </div>
        ) : (
          <div className="books-grid" style={{ marginTop: 8 }}>
            {items.map((item) => {
              if (item.type === 'series') {
                return (
                  <div
                    key={item.id}
                    className="book-card"
                    onClick={() => handleOpenFolder(item)}
                    style={{
                      borderColor: 'rgba(168, 85, 247, 0.3)',
                      background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.05), transparent)',
                    }}
                  >
                    <div
                      className="book-card-cover-wrap"
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: 'rgba(168, 85, 247, 0.2)',
                          color: '#a855f7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Folder size={28} />
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#a855f7',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Серия книг
                      </span>
                    </div>

                    <div className="book-card-details">
                      <h4 className="book-card-title" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="book-card-author" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#a855f7' }}>
                        <span>Открыть папку</span>
                        <ChevronRight size={12} />
                      </p>
                    </div>
                  </div>
                );
              }

              // Book Item Card
              const downloadStatus = downloadStates[item.id];
              const isDownloaded = downloadStatus === 'downloaded' || Boolean(downloadedPaths[item.id]);
              const isDownloading = downloadStatus === 'downloading';
              const coverUrl = libraryApi.getBookCoverUrl(item.id);
              const progressPct = item.progress?.progressPercent ?? 0;

              return (
                <div key={item.id} className="book-card">
                  <div className="book-card-cover-wrap">
                    {/* Placeholder in background */}
                    <div className="book-card-cover-placeholder">
                      <BookOpen size={36} />
                    </div>

                    {/* Book Cover Image */}
                    <img
                      src={coverUrl}
                      alt={item.name}
                      className="book-card-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />

                    {/* Badges and Progress */}
                    {item.sortOrder !== undefined && item.sortOrder !== null && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          color: '#c084fc',
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: 6,
                          zIndex: 5,
                        }}
                      >
                        #{item.sortOrder}
                      </span>
                    )}

                    {isDownloaded && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          backgroundColor: '#22c55e',
                          color: '#ffffff',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          zIndex: 5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Check size={11} />
                        <span>Скачано</span>
                      </span>
                    )}

                    {progressPct > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                          backgroundColor: 'rgba(0, 0, 0, 0.4)',
                          zIndex: 5,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(3, progressPct))}%`,
                            backgroundColor: 'var(--accent-color)',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="book-card-details">
                    <h4 className="book-card-title" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="book-card-author" title={item.author}>
                      {item.author || 'Неизвестный автор'}
                    </p>

                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      {isDownloaded && downloadedPaths[item.id] && onOpenBookFromPath ? (
                        <button
                          type="button"
                          className="auth-btn-primary"
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                          onClick={() =>
                            onOpenBookFromPath(
                              downloadedPaths[item.id],
                              item.name,
                              item.author
                            )
                          }
                        >
                          <BookOpen size={13} />
                          <span>Читать</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={isDownloaded ? 'auth-btn-secondary' : 'auth-btn-primary'}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                          onClick={() => handleDownloadBook(item)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Скачивание...</span>
                            </>
                          ) : isDownloaded ? (
                            <>
                              <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                              <span>Скачать заново</span>
                            </>
                          ) : (
                            <>
                              <Download size={13} />
                              <span>Скачать</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 0',
              borderTop: '1px solid var(--border-color)',
              marginTop: 20,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Страница {page} из {totalPages} ({totalItems} всего)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="auth-btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Назад
              </button>
              <button
                type="button"
                className="auth-btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Вперед
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
