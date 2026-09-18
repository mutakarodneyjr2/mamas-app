import { auth } from '../firebase';

/**
 * Retrieves and normalizes the backend API base URL.
 * Reads import.meta.env.VITE_API_BASE_URL.
 * If empty on web, defaults to '' for same-origin relative calls.
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

/**
 * Builds an absolute or same-origin API URL.
 * Ensures path is prefixed with / if missing.
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${normalizedPath}`;
}

/**
 * Dispatches an HTTP request to the backend API.
 * - Prefixes VITE_API_BASE_URL when defined (or on native environments)
 * - Automatically attaches 'Authorization: Bearer <Firebase ID token>' if user is authenticated
 * - Forwards caller headers, method, body, signal, credentials
 * - Returns fetch Response object
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  const headers = new Headers(init?.headers || {});

  // Automatically attach Bearer token if user is signed in and caller did not explicitly provide one
  if (!headers.has('Authorization') && auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    } catch (err) {
      console.warn('[apiClient] Could not retrieve Firebase ID token:', err);
    }
  }

  return fetch(url, {
    ...init,
    headers
  });
}
