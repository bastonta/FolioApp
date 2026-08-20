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
} from './services/storage';
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

  // Open book from File / Blob
  const handleOpenBookFile = async (file: File | Blob, meta?: Partial<RecentBook>) => {
    try {
      const fileName = (file as File).name || 'book.epub';
      const bookId = meta?.id || `book-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Store in IndexedDB for subsequent sessions
      await storeBookBlob(bookId, file);

      const recentItem: RecentBook = {
        id: bookId,
        title: meta?.title || fileName.replace(/\.[^/.]+$/, ''),
        author: meta?.author || 'Unknown Author',
        coverUrl: meta?.coverUrl,
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
        />
      )}
    </div>
  );
}

export default App;
