/**
 * Singleton Token Manager
 *
 * Stores access token in a module-level variable so every import shares the
 * same value.  Prevents refresh-token races by queuing concurrent 401
 * retries behind a single in-flight refresh request.
 *
 * Refresh strategy:
 *   1. Try `fetch` with `credentials: 'include'` (WebView cookie-based).
 *   2. If that fails, fall back to a Tauri Rust command that uses its own
 *      reqwest cookie jar.
 */

import { fetch } from '@tauri-apps/plugin-http';

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

// ─── Helpers ─────────────────────────────────────────────────────────────

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
}

/**
 * Refresh the access token.
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

    let newToken: string | null = null;

    // ── Strategy 1: fetch with credentials (WebView cookies) ──────────
    try {
      const res = await fetch(`${serverUrl}/api/identity/token/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        newToken = data.token ?? null;
      }
    } catch {
      // Fetch failed (network, CORS, etc.) — try fallback
    }

    // ── Strategy 2: Tauri Rust proxy (has its own cookie jar) ─────────
    if (!newToken) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        newToken = await invoke<string | null>('refresh_access_token', {
          serverUrl,
        });
      } catch {
        // Rust fallback also failed
      }
    }

    if (!newToken) {
      throw new Error('Token refresh failed');
    }

    setAccessToken(newToken);
    processQueue(null, newToken);
    return newToken;
  } catch (err) {
    processQueue(err);
    clearTokens();
    throw err;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Notify the Rust side about a successful login so it can store the refresh
 * cookie in its own cookie jar (for the fallback strategy).
 */
export async function notifyRustLogin(
  serverUrl: string,
  email: string,
  password: string,
): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('auth_login_proxy', { serverUrl, email, password });
  } catch {
    // Non-critical — fallback only
  }
}
