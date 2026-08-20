import { useState } from 'react';
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
import { setStatusBarVisible } from './services/systemUi';
import './App.css';

interface ActiveBookState {
  id: string;
  source: File | Blob | string;
  title?: string;
  author?: string;
}

export function App() {
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings());
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>(() => loadRecentBooks());
  const [activeBook, setActiveBook] = useState<ActiveBookState | null>(null);

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
    setActiveBook(null);
    setRecentBooks(loadRecentBooks());
    document.title = 'Folio — E-Book Reader';
  };

  return (
    <div className={`app-container theme-${settings.theme}`}>
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
        />
      )}
    </div>
  );
}

export default App;
