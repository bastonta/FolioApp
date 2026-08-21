import { invoke } from '@tauri-apps/api/core';
import { Annotation, Bookmark } from '../types/reader';
import { getServerUrl, getAccessToken } from '../api/tokenManager';

export interface SyncResult {
  success: boolean;
  message: string;
  progressSynced: boolean;
  bookmarksSynced: number;
  annotationsSynced: number;
}

interface DbBookProgress {
  bookId: string;
  location: string;
  progressPercent: number;
  isRead: boolean;
  updatedAt: string;
  syncStatus: string;
}

interface DbBookmark {
  id: string;
  serverId?: string;
  bookId: string;
  location: string;
  fraction: number;
  locationLabel?: string;
  chapterTitle?: string;
  createdAt: string;
  isDeleted: boolean;
  syncStatus: string;
}

interface DbAnnotation {
  id: string;
  serverId?: string;
  bookId: string;
  locationStart: string;
  locationEnd: string;
  value: string;
  selectedText: string;
  note?: string;
  color: string;
  style?: string;
  chapterTitle?: string;
  sectionIndex?: number;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  syncStatus: string;
}

const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// ================= BOOK MAPPINGS =================

export async function saveDbBookMapping(
  localId: string,
  serverBookId: string,
  filePath?: string
): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('db_save_book_mapping', {
      localId,
      serverBookId,
      filePath: filePath || null,
    });
  } catch (err) {
    console.error('Failed to save book mapping:', err);
  }
}

export async function getDbServerBookId(bookId: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<string | null>('db_get_server_book_id', { bookId });
  } catch (err) {
    console.warn('Failed to get server book id:', err);
    return null;
  }
}

// ================= PROGRESS =================

export async function loadDbLastLocation(
  bookId: string
): Promise<{ cfi?: string; fraction?: number; isRead?: boolean } | null> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_locations');
      if (!data) return null;
      const map = JSON.parse(data);
      return map[bookId] || null;
    } catch {
      return null;
    }
  }

  try {
    const res = await invoke<DbBookProgress | null>('db_get_progress', { bookId });
    if (!res) return null;
    return {
      cfi: res.location,
      fraction: res.progressPercent / 100.0,
      isRead: res.isRead,
    };
  } catch (err) {
    console.error('Failed to load progress from SQLite:', err);
    return null;
  }
}

export async function saveDbLastLocation(
  bookId: string,
  cfi: string,
  fraction: number,
  isRead: boolean = false
): Promise<void> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_locations');
      const map = data ? JSON.parse(data) : {};
      map[bookId] = { cfi, fraction, isRead, updatedAt: new Date().toISOString() };
      localStorage.setItem('foliate_book_locations', JSON.stringify(map));
    } catch (err) {
      console.error('Failed to save location to localStorage:', err);
    }
    return;
  }

  try {
    const progressPercent = Math.min(100.0, Math.max(0.0, fraction * 100.0));
    await invoke('db_save_progress', {
      bookId,
      location: cfi,
      progressPercent,
      isRead,
    });
  } catch (err) {
    console.error('Failed to save progress to SQLite:', err);
  }
}

// ================= BOOKMARKS =================

export async function loadDbBookmarks(bookId: string): Promise<Bookmark[]> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_bookmarks');
      if (!data) return [];
      const map = JSON.parse(data);
      return map[bookId] || [];
    } catch {
      return [];
    }
  }

  try {
    const res = await invoke<DbBookmark[]>('db_get_bookmarks', { bookId });
    return res.map((bm) => ({
      id: bm.id,
      bookId: bm.bookId,
      cfi: bm.location,
      fraction: bm.fraction,
      locationLabel: bm.locationLabel,
      chapterTitle: bm.chapterTitle,
      createdAt: bm.createdAt,
    }));
  } catch (err) {
    console.error('Failed to load bookmarks from SQLite:', err);
    return [];
  }
}

export async function saveDbBookmark(bookmark: Bookmark): Promise<void> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_bookmarks');
      const map = data ? JSON.parse(data) : {};
      const list: Bookmark[] = map[bookmark.bookId] || [];
      const exists = list.some((b) => b.cfi === bookmark.cfi);
      if (!exists) {
        list.unshift(bookmark);
        map[bookmark.bookId] = list;
        localStorage.setItem('foliate_book_bookmarks', JSON.stringify(map));
      }
    } catch (err) {
      console.error('Failed to save bookmark to localStorage:', err);
    }
    return;
  }

  try {
    await invoke('db_save_bookmark', {
      id: bookmark.id,
      bookId: bookmark.bookId,
      location: bookmark.cfi,
      fraction: bookmark.fraction,
      locationLabel: bookmark.locationLabel || null,
      chapterTitle: bookmark.chapterTitle || null,
    });
  } catch (err) {
    console.error('Failed to save bookmark to SQLite:', err);
  }
}

export async function deleteDbBookmark(bookId: string, bookmarkId: string): Promise<void> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_bookmarks');
      if (!data) return;
      const map = JSON.parse(data);
      const list: Bookmark[] = map[bookId] || [];
      map[bookId] = list.filter((b) => b.id !== bookmarkId);
      localStorage.setItem('foliate_book_bookmarks', JSON.stringify(map));
    } catch (err) {
      console.error('Failed to delete bookmark from localStorage:', err);
    }
    return;
  }

  try {
    await invoke('db_delete_bookmark', { id: bookmarkId });
  } catch (err) {
    console.error('Failed to delete bookmark from SQLite:', err);
  }
}

// ================= ANNOTATIONS =================

export async function loadDbAnnotations(bookId: string): Promise<Annotation[]> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_annotations');
      if (!data) return [];
      const map = JSON.parse(data);
      return map[bookId] || [];
    } catch {
      return [];
    }
  }

  try {
    const res = await invoke<DbAnnotation[]>('db_get_annotations', { bookId });
    return res.map((ann) => ({
      id: ann.id,
      bookId: ann.bookId,
      value: ann.value,
      color: ann.color,
      style: (ann.style as any) || 'highlight',
      text: ann.selectedText,
      note: ann.note,
      createdAt: ann.createdAt,
      chapterTitle: ann.chapterTitle,
      sectionIndex: ann.sectionIndex,
    }));
  } catch (err) {
    console.error('Failed to load annotations from SQLite:', err);
    return [];
  }
}

export async function saveDbAnnotation(annotation: Annotation): Promise<void> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_annotations');
      const map = data ? JSON.parse(data) : {};
      const list: Annotation[] = map[annotation.bookId] || [];
      const idx = list.findIndex((a) => a.id === annotation.id || a.value === annotation.value);
      if (idx >= 0) {
        list[idx] = annotation;
      } else {
        list.unshift(annotation);
      }
      map[annotation.bookId] = list;
      localStorage.setItem('foliate_book_annotations', JSON.stringify(map));
    } catch (err) {
      console.error('Failed to save annotation to localStorage:', err);
    }
    return;
  }

  try {
    await invoke('db_save_annotation', {
      id: annotation.id,
      bookId: annotation.bookId,
      locationStart: annotation.value,
      locationEnd: annotation.value,
      value: annotation.value,
      selectedText: annotation.text,
      note: annotation.note || null,
      color: annotation.color,
      style: annotation.style || 'highlight',
      chapterTitle: annotation.chapterTitle || null,
      sectionIndex: annotation.sectionIndex ?? null,
    });
  } catch (err) {
    console.error('Failed to save annotation to SQLite:', err);
  }
}

export async function deleteDbAnnotation(
  bookId: string,
  annotationIdOrValue: string
): Promise<void> {
  if (!isTauri()) {
    try {
      const data = localStorage.getItem('foliate_book_annotations');
      if (!data) return;
      const map = JSON.parse(data);
      const list: Annotation[] = map[bookId] || [];
      map[bookId] = list.filter(
        (a) => a.id !== annotationIdOrValue && a.value !== annotationIdOrValue
      );
      localStorage.setItem('foliate_book_annotations', JSON.stringify(map));
    } catch (err) {
      console.error('Failed to delete annotation from localStorage:', err);
    }
    return;
  }

  try {
    await invoke('db_delete_annotation', { idOrValue: annotationIdOrValue });
  } catch (err) {
    console.error('Failed to delete annotation from SQLite:', err);
  }
}

// ================= SYNC API =================

export async function syncBookData(bookId: string): Promise<SyncResult | null> {
  if (!isTauri()) return null;

  try {
    const serverUrl = getServerUrl();
    if (!serverUrl) return null;
    const token = getAccessToken();

    return await invoke<SyncResult>('sync_book_data', {
      bookId,
      serverUrl,
      token: token || null,
    });
  } catch (err) {
    console.warn(`Sync failed for book ${bookId}:`, err);
    return null;
  }
}

export async function syncAllPending(): Promise<SyncResult[]> {
  if (!isTauri()) return [];

  try {
    const serverUrl = getServerUrl();
    if (!serverUrl) return [];
    const token = getAccessToken();

    return await invoke<SyncResult[]>('sync_all_pending', {
      serverUrl,
      token: token || null,
    });
  } catch (err) {
    console.warn('Sync all pending failed:', err);
    return [];
  }
}
