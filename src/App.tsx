import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { FoliateReader } from './components/reader/FoliateReader';
import { LibraryView } from './components/library/LibraryView';
import { ReaderSettings, RecentBook } from './types/reader';
import {
  loadSettings,
  saveSettings,
  loadRecentBooks,
  saveRecentBook,
  removeRecentBook,
  storeBookBlob,
  loadBookBlob,
  storeBookCover,
  blobToThumbnailDataUrl,
  formatLanguageMap,
  formatContributor,
} from './services/storage';
import { setStatusBarVisible, setStatusBarTheme } from './services/systemUi';
import { AuthProvider, useAuth } from './context/AuthContext';

// Auth pages
import { ServerSetup } from './pages/ServerSetup';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ProfilePage } from './pages/ProfilePage';

import './styles/auth.css';
import './App.css';

// ─── Active book state ───────────────────────────────────────────────────

interface ActiveBookState {
  id: string;
  source: File | Blob | string;
  title?: string;
  author?: string;
}

// ─── Route guard: requires authentication ────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, serverUrl } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-icon-badge" style={{ margin: '0 auto' }}>
            <span className="auth-loading-spinner" />
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!serverUrl) {
    return <Navigate to="/server" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ─── Route guard: redirect if already authenticated ──────────────────────

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, serverUrl } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!serverUrl) {
    return <Navigate to="/server" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ─── Main app with routes ────────────────────────────────────────────────

function AppRoutes() {
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings());
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>(() => loadRecentBooks());
  const [activeBook, setActiveBook] = useState<ActiveBookState | null>(null);
  const navigate = useNavigate();

  // Synchronize native status bar icon appearance with the current app theme
  useEffect(() => {
    setStatusBarTheme(settings.theme);
  }, [settings.theme]);

  // Sync settings updates
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = saveSettings(newSettings);
    setSettings(updated);
  };

  const handleRefreshRecentBooks = () => {
    setRecentBooks(loadRecentBooks());
  };

  // Open book from File / Blob
  const handleOpenBookFile = async (file: File | Blob, meta?: Partial<RecentBook>) => {
    try {
      const fileName = (file as File).name || 'book.epub';
      const bookId = meta?.id || `book-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Store in IndexedDB for subsequent sessions
      await storeBookBlob(bookId, file);

      let title = meta?.title || fileName.replace(/\.[^/.]+$/, '');
      let author = meta?.author || 'Unknown Author';
      let coverUrl = meta?.coverUrl;

      // Extract metadata & cover eagerly
      try {
        const { makeBook } = await import('./foliate-js/view.js');
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
              await storeBookCover(bookId, coverBlob);
              coverUrl = await blobToThumbnailDataUrl(coverBlob);
            }
          }
          parsedBook.destroy?.();
        }
      } catch (e) {
        console.warn('Initial metadata extraction skipped or failed:', e);
      }

      const recentItem: RecentBook = {
        id: bookId,
        title,
        author,
        coverUrl,
        progressFraction: 0,
        lastOpenedAt: new Date().toISOString(),
        fileName,
        fileSize: file.size,
      };

      saveRecentBook(recentItem);
      setRecentBooks(loadRecentBooks());

      setActiveBook({
        id: bookId,
        source: file,
        title: recentItem.title,
        author: recentItem.author,
      });
    } catch (err) {
      console.error('Failed to open book file:', err);
      alert('Could not open book file. Please ensure it is a valid EPUB file.');
    }
  };

  // Open book from Recent list
  const handleOpenRecentBook = async (book: RecentBook) => {
    try {
      const blob = await loadBookBlob(book.id);
      if (blob) {
        setActiveBook({
          id: book.id,
          source: blob,
          title: book.title,
          author: book.author,
        });
      } else {
        alert(
          `Book data for "${book.title}" is no longer cached in storage. Please re-open the file.`
        );
      }
    } catch (err) {
      console.error('Failed to load recent book blob:', err);
    }
  };

  // Delete recent book
  const handleDeleteRecentBook = async (id: string) => {
    await removeRecentBook(id);
    setRecentBooks(loadRecentBooks());
  };

  // Back to Library
  const handleBackToLibrary = () => {
    setStatusBarVisible(true);
    setStatusBarTheme(settings.theme);
    setActiveBook(null);
    setRecentBooks(loadRecentBooks());
    document.title = 'Folio — E-Book Reader';
  };

  // Navigate to profile
  const handleOpenProfile = () => {
    navigate('/profile');
  };

  return (
    <div className={`app-container theme-${settings.theme}`}>
      <Routes>
        {/* ── Public auth routes ─────────────────────────────── */}
        <Route path="/server" element={<ServerSetup />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route
          path="/confirm-email"
          element={<ConfirmEmailPage />}
        />
        <Route
          path="/forgot-password"
          element={
            <GuestOnly>
              <ForgotPasswordPage />
            </GuestOnly>
          }
        />

        {/* ── Protected routes ───────────────────────────────── */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              {activeBook ? (
                <FoliateReader
                  bookId={activeBook.id}
                  bookSource={activeBook.source}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onBackToLibrary={handleBackToLibrary}
                />
              ) : (
                <LibraryView
                  recentBooks={recentBooks}
                  onOpenBookFile={handleOpenBookFile}
                  onOpenRecentBook={handleOpenRecentBook}
                  onDeleteRecentBook={handleDeleteRecentBook}
                  onRefreshRecentBooks={handleRefreshRecentBooks}
                  onOpenProfile={handleOpenProfile}
                />
              )}
            </RequireAuth>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// ─── Root component ──────────────────────────────────────────────────────

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
