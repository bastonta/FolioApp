/**
 * Fetch-based HTTP client for the Folio API.
 *
 * All requests flow through `apiFetch` which:
 *   - Resolves the base URL from the token manager's `getServerUrl()`
 *   - Attaches the `Authorization: Bearer` header
 *   - On 401 (non-identity endpoints): triggers a single token refresh then
 *     retries the original request
 *   - Sends `credentials: 'include'` so the WebView passes cookies
 */

import { fetch } from '@tauri-apps/plugin-http';
import {
  getAccessToken,
  getServerUrl,
  setAccessToken,
  refreshAccessToken,
  clearTokens,
} from './tokenManager';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  data?: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function apiBase(): string {
  const url = getServerUrl();
  if (!url) throw new Error('Server URL not configured');
  return `${url}/api`;
}

function isAuthPath(path: string): boolean {
  return path.startsWith('/identity/');
}

async function parseErrorBody(res: Response): Promise<ApiError> {
  let message = res.statusText || 'Request failed';
  let data: unknown;
  try {
    data = await res.json();
    if (typeof data === 'object' && data !== null && 'message' in data) {
      message = (data as { message: string }).message;
    }
  } catch {
    // response body wasn't JSON
  }
  return { status: res.status, message, data };
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────

/**
 * Make an authenticated API request.
 *
 * @param path   Relative path (e.g. `/identity/login` or `/profile/info`)
 * @param init   Standard RequestInit overrides
 * @param _retry Internal flag to prevent infinite retry loops
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  _retry = false,
): Promise<T> {
  const base = apiBase();
  const url = `${base}${path}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  // ── Handle 401 with automatic token refresh ────────────────────────
  if (res.status === 401 && !_retry && !isAuthPath(path)) {
    try {
      const newToken = await refreshAccessToken();
      // Retry with fresh token
      headers.set('Authorization', `Bearer ${newToken}`);
      const retryRes = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (!retryRes.ok) {
        throw await parseErrorBody(retryRes);
      }

      // Handle empty body (204, etc.)
      const ct = retryRes.headers.get('content-type');
      if (retryRes.status === 204 || !ct?.includes('application/json')) {
        return undefined as T;
      }
      return retryRes.json() as Promise<T>;
    } catch {
      // Refresh failed — force logout
      clearTokens();
      window.dispatchEvent(new CustomEvent('folio:session-expired'));
      throw { status: 401, message: 'Session expired' } as ApiError;
    }
  }

  if (!res.ok) {
    throw await parseErrorBody(res);
  }

  // Handle empty body
  const ct = res.headers.get('content-type');
  if (res.status === 204 || !ct?.includes('application/json')) {
    return undefined as T;
  }

  // If this is a login/email-confirm response, extract the token
  const data = await res.json();

  // Auto-store access token from auth responses
  if (
    data &&
    typeof data === 'object' &&
    'token' in data &&
    typeof data.token === 'string' &&
    isAuthPath(path) &&
    // Don't store intermediate 2FA token
    !('need2fa' in data && data.need2fa === true)
  ) {
    setAccessToken(data.token);
  }

  return data as T;
}

// ─── Convenience methods ─────────────────────────────────────────────────

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

export function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
