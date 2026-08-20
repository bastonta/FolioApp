import { Annotation, Bookmark, ReaderSettings, RecentBook } from '../types/reader';

const SETTINGS_KEY = 'foliate_reader_settings';
const RECENT_BOOKS_KEY = 'foliate_recent_books';
const LOCATIONS_KEY = 'foliate_book_locations';
const ANNOTATIONS_KEY = 'foliate_book_annotations';
const BOOKMARKS_KEY = 'foliate_book_bookmarks';

export const DEFAULT_SETTINGS: ReaderSettings = {
  flow: 'paginated',
  columns: 'auto',
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  spacing: 1.5,
  margin: 48,
  justify: true,
  hyphenate: true,
  theme: 'light',
  sidebarPinned: true,
  sidebarOpen: true,
  activeTab: 'contents',
};

// IndexedDB for storing book files
const DB_NAME = 'FolioBookDB';
const DB_VERSION = 1;
const STORE_NAME = 'books_files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeBookBlob(id: string, file: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, data: file });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to store book blob in IndexedDB:', err);
  }
}

export async function loadBookBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load book blob from IndexedDB:', err);
    return null;
  }
}

export async function deleteBookBlob(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete book blob from IndexedDB:', err);
  }
}

// Settings
export function loadSettings(): ReaderSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<ReaderSettings>): ReaderSettings {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// Recent Books
export function loadRecentBooks(): RecentBook[] {
  try {
    const data = localStorage.getItem(RECENT_BOOKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveRecentBook(book: RecentBook): void {
  const books = loadRecentBooks().filter((b) => b.id !== book.id);
  books.unshift(book);
  localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(books));
}

export async function removeRecentBook(id: string): Promise<void> {
  const books = loadRecentBooks().filter((b) => b.id !== id);
  localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(books));
  await deleteBookBlob(id);
}

// Book Progress / Location
export function loadLastLocation(bookId: string): { cfi?: string; fraction?: number } | null {
  try {
    const data = localStorage.getItem(LOCATIONS_KEY);
    if (!data) return null;
    const map = JSON.parse(data);
    return map[bookId] || null;
  } catch {
    return null;
  }
}

export function saveLastLocation(bookId: string, cfi: string, fraction: number): void {
  try {
    const data = localStorage.getItem(LOCATIONS_KEY);
    const map = data ? JSON.parse(data) : {};
    map[bookId] = { cfi, fraction, updatedAt: new Date().toISOString() };
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(map));

    // Update in recent books as well
    const recent = loadRecentBooks();
    const target = recent.find((b) => b.id === bookId);
    if (target) {
      target.lastLocation = cfi;
      target.progressFraction = fraction;
      target.lastOpenedAt = new Date().toISOString();
      localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(recent));
    }
  } catch (err) {
    console.error('Failed to save location:', err);
  }
}

// Annotations
export function loadAnnotations(bookId: string): Annotation[] {
  try {
    const data = localStorage.getItem(ANNOTATIONS_KEY);
    if (!data) return [];
    const map = JSON.parse(data);
    return map[bookId] || [];
  } catch {
    return [];
  }
}

export function saveAnnotation(annotation: Annotation): void {
  try {
    const data = localStorage.getItem(ANNOTATIONS_KEY);
    const map = data ? JSON.parse(data) : {};
    const list: Annotation[] = map[annotation.bookId] || [];
    const idx = list.findIndex((a) => a.id === annotation.id || a.value === annotation.value);
    if (idx >= 0) {
      list[idx] = annotation;
    } else {
      list.unshift(annotation);
    }
    map[annotation.bookId] = list;
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save annotation:', err);
  }
}

export function deleteAnnotation(bookId: string, annotationIdOrValue: string): void {
  try {
    const data = localStorage.getItem(ANNOTATIONS_KEY);
    if (!data) return;
    const map = JSON.parse(data);
    const list: Annotation[] = map[bookId] || [];
    map[bookId] = list.filter((a) => a.id !== annotationIdOrValue && a.value !== annotationIdOrValue);
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to delete annotation:', err);
  }
}

// Bookmarks
export function loadBookmarks(bookId: string): Bookmark[] {
  try {
    const data = localStorage.getItem(BOOKMARKS_KEY);
    if (!data) return [];
    const map = JSON.parse(data);
    return map[bookId] || [];
  } catch {
    return [];
  }
}

export function saveBookmark(bookmark: Bookmark): void {
  try {
    const data = localStorage.getItem(BOOKMARKS_KEY);
    const map = data ? JSON.parse(data) : {};
    const list: Bookmark[] = map[bookmark.bookId] || [];
    const exists = list.some((b) => b.cfi === bookmark.cfi);
    if (!exists) {
      list.unshift(bookmark);
      map[bookmark.bookId] = list;
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(map));
    }
  } catch (err) {
    console.error('Failed to save bookmark:', err);
  }
}

export function deleteBookmark(bookId: string, bookmarkId: string): void {
  try {
    const data = localStorage.getItem(BOOKMARKS_KEY);
    if (!data) return;
    const map = JSON.parse(data);
    const list: Bookmark[] = map[bookId] || [];
    map[bookId] = list.filter((b) => b.id !== bookmarkId);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to delete bookmark:', err);
  }
}
