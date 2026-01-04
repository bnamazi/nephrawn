const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'nephrawn_token';

// Session storage for token persistence (survives page refresh, cleared on tab close)
// Note: For production, consider httpOnly cookies via backend Set-Cookie header
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(t: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TOKEN_KEY, t);
  } catch {
    // Storage might be full or disabled
    console.warn('Failed to store token in sessionStorage');
  }
}

function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore errors
  }
}

// In-memory cache for SSR compatibility
let tokenCache: string | null = null;

export function setToken(t: string) {
  tokenCache = t;
  setStoredToken(t);
}

export function clearToken() {
  tokenCache = null;
  clearStoredToken();
}

export function getToken(): string | null {
  // Check cache first (for SSR), then storage
  if (tokenCache) return tokenCache;
  const stored = getStoredToken();
  if (stored) {
    tokenCache = stored; // Sync cache
  }
  return stored;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const currentToken = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new ApiError('Unauthorized', 401);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.error || 'Request failed',
      res.status,
      data.details
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
