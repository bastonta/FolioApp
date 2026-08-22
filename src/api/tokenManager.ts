/**
 * Singleton Token Manager
 *
 * Stores access token in a module-level variable so every import shares the
 * same value. Prevents refresh-token races by queuing concurrent 401
 * retries behind a single in-flight refresh request.
 *
 * All refresh token requests and rotation are handled via Rust proxy commands.
 */

import { invoke } from '@tauri-apps/api/core';
import type { User } from '../types/auth';

// ─── Module-level state (shared across all imports) ──────────────────────

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

// ─── localStorage keys ──────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'folio_access_token';
const SERVER_URL_KEY = 'folio_server_url';
const CACHED_USER_KEY = 'folio_cached_user';

// ─── Helpers ─────────────────────────────────────────────────────────────

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (typeof err === 'string') {
    const lower = err.toLowerCase();
    return (
      lower.includes('network error') ||
      lower.includes('failed to fetch') ||
      lower.includes('connection refused') ||
      lower.includes('timeout') ||
      lower.includes('dns') ||
      lower.includes('host unreachable')
    );
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as any).message).toLowerCase();
    return (
      msg.includes('network error') ||
      msg.includes('failed to fetch') ||
      msg.includes('connection refused') ||
      msg.includes('timeout') ||
      msg.includes('dns') ||
      msg.includes('host unreachable')
    );
  }
  return false;
}

function processQueue(error: unknown, token: string | null = null) {
  const queue = refreshQueue;
  refreshQueue = [];
  queue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
}

// ─── Public API ──────────────────────────────────────────────────────────

/** Return the current access token (from memory, falling back to storage). */
export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return accessToken;
}

/** Persist a new access token (or clear it with `null`). */
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

/** Return the cached user profile. */
export function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/** Persist or clear the cached user profile. */
export function setCachedUser(user: User | null) {
  if (user) {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CACHED_USER_KEY);
  }
}

/** Return the saved server URL, e.g. `https://folio.example.com`. */
export function getServerUrl(): string | null {
  return localStorage.getItem(SERVER_URL_KEY);
}

/** Persist server URL (with trailing slash stripped). */
export function setServerUrl(url: string | null) {
  if (url) {
    // Normalise: remove trailing slash
    const normalised = url.replace(/\/+$/, '');
    localStorage.setItem(SERVER_URL_KEY, normalised);
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
}

/** Clear all tokens (used on logout / session expiry). */
export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(CACHED_USER_KEY);
  invoke('clear_auth_cookies').catch(() => {});
}

/**
 * Refresh the access token via Rust proxy.
 *
 * If a refresh is already in flight, callers are queued and resolved once
 * the single refresh request completes — preventing concurrent refresh
 * races.
 */
export async function refreshAccessToken(): Promise<string> {
  // If another caller is already refreshing, queue this one
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error('Server URL not configured');

    const newToken = await invoke<string>('refresh_access_token', {
      serverUrl,
    });

    if (!newToken) {
      throw new Error('Token refresh failed');
    }

    setAccessToken(newToken);
    processQueue(null, newToken);
    return newToken;
  } catch (err) {
    processQueue(err);
    if (!isNetworkError(err)) {
      clearTokens();
    }
    throw err;
  } finally {
    isRefreshing = false;
  }
}


