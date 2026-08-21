import { invoke } from '@tauri-apps/api/core';
import { LocalBookFile } from '../types/browse';

export const fileManager = {
  /**
   * Retrieves default download folder path from OS (e.g. ~/Downloads/FolioBooks).
   */
  getDefaultDownloadDir: async (): Promise<string> => {
    try {
      return await invoke<string>('get_default_download_dir');
    } catch (err) {
      console.warn('Failed to get default download dir from Tauri:', err);
      return '';
    }
  },

  /**
   * Opens native folder picker dialog.
   */
  pickFolder: async (defaultPath?: string): Promise<string | null> => {
    try {
      const result = await invoke<string | null>('pick_folder', {
        defaultPath: defaultPath || null,
      });
      return result;
    } catch (err) {
      console.error('Failed to open folder picker:', err);
      return null;
    }
  },

  /**
   * Recursively scans directory for .epub book files.
   */
  scanLocalBooks: async (dirPath: string): Promise<LocalBookFile[]> => {
    if (!dirPath || !dirPath.trim()) return [];
    try {
      return await invoke<LocalBookFile[]>('scan_local_books', { dirPath });
    } catch (err) {
      console.error(`Failed to scan local books in '${dirPath}':`, err);
      return [];
    }
  },

  /**
   * Reads raw bytes of a local book file from disk and returns a Blob.
   */
  readBookFile: async (filePath: string): Promise<Blob> => {
    try {
      const bytes = await invoke<number[]>('read_book_file', { filePath });
      const uint8 = new Uint8Array(bytes);
      return new Blob([uint8], { type: 'application/epub+zip' });
    } catch (err) {
      console.error(`Failed to read book file '${filePath}':`, err);
      throw err;
    }
  },

  /**
   * Downloads a book from the Folio server into the download folder / series subfolder.
   */
  downloadBookFile: async (options: {
    serverUrl: string;
    token?: string;
    bookId: string;
    fileName: string;
    seriesName?: string;
    baseDir: string;
    customTargetDir?: string;
  }): Promise<string> => {
    try {
      return await invoke<string>('download_book_file', {
        serverUrl: options.serverUrl,
        token: options.token || null,
        bookId: options.bookId,
        fileName: options.fileName,
        seriesName: options.seriesName || null,
        baseDir: options.baseDir,
        customTargetDir: options.customTargetDir || null,
      });
    } catch (err) {
      console.error(`Failed to download book '${options.fileName}':`, err);
      throw err;
    }
  },

  /**
   * Deletes a local book file from disk.
   */
  deleteBookFile: async (filePath: string): Promise<boolean> => {
    try {
      return await invoke<boolean>('delete_book_file', { filePath });
    } catch (err) {
      console.error(`Failed to delete book file '${filePath}':`, err);
      return false;
    }
  },

  /**
   * Checks if book already exists in download folder / series folder.
   */
  checkBookDownloaded: async (options: {
    baseDir: string;
    fileName: string;
    seriesName?: string;
  }): Promise<string | null> => {
    if (!options.baseDir) return null;
    try {
      return await invoke<string | null>('check_book_downloaded', {
        baseDir: options.baseDir,
        fileName: options.fileName,
        seriesName: options.seriesName || null,
      });
    } catch (err) {
      console.warn('Check book downloaded error:', err);
      return null;
    }
  },
};
