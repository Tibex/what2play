import toast from 'react-hot-toast';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`;

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** When false, omit Bearer token (for public endpoints). Avoids 401-triggered login modal redirects with stale session. */
  auth?: boolean;
  /** When false, suppress the automatic error toast. Default true. */
  showErrorToast?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const token =
    useAuth && globalThis.window !== undefined ? localStorage.getItem('accessToken') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    const msg = 'Network error — is the backend running?';
    if (options.showErrorToast !== false) toast.error(msg);
    throw new Error(msg);
  }

  if (res.status === 401 && token) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options);
    if (globalThis.window !== undefined) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      const current = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
      const separator = current.includes('?') ? '&' : '?';
      globalThis.location.href = `${current}${separator}m=login`;
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    const msg = error.message || `HTTP ${res.status}`;
    if (options.showErrorToast !== false) toast.error(msg);
    throw new Error(msg);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken =
    globalThis.window === undefined ? null : localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string, opts?: Pick<RequestOptions, 'auth' | 'showErrorToast'>) =>
    request<T>(path, opts),
  post: <T>(
    path: string,
    body?: unknown,
    opts?: Pick<RequestOptions, 'auth' | 'showErrorToast'>,
  ) => request<T>(path, { method: 'POST', body, ...opts }),
  patch: <T>(
    path: string,
    body?: unknown,
    opts?: Pick<RequestOptions, 'auth' | 'showErrorToast'>,
  ) => request<T>(path, { method: 'PATCH', body, ...opts }),
  delete: <T>(path: string, opts?: Pick<RequestOptions, 'auth' | 'showErrorToast'>) =>
    request<T>(path, { method: 'DELETE', ...opts }),
};
