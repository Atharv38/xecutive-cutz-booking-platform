const SESSION_STORAGE_KEY = 'xc_session_token';
let memoryToken: string | null = null;

export function getStoredSessionToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const val = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (val) {
      memoryToken = val;
      return val;
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

export function setStoredSessionToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable
  }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredSessionToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}
