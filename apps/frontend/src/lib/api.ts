const normalizeApiUrl = (rawUrl?: string) => {
    const fallback = '/api';
    const input = (rawUrl ?? fallback).trim();

    if (!input) return fallback;

    if (input.startsWith('http://') || input.startsWith('https://')) {
        const withoutTrailingSlash = input.replace(/\/+$/, '');
        return withoutTrailingSlash.endsWith('/api')
            ? withoutTrailingSlash
            : `${withoutTrailingSlash}/api`;
    }

    const normalizedPath = input.replace(/\/+$/, '');
    return normalizedPath || fallback;
};

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

// Extraer la base (sin el /api al final)
const getBase = (url: string) => {
    if (url.startsWith('http')) {
        return url.replace(/\/api$/, '');
    }
    return '';
};

export const BASE_URL = getBase(API_URL);
export const AUTH_URL = API_URL ? `${API_URL}/auth` : '/api/auth';
export const NOTIFICACIONES_URL = API_URL ? `${API_URL}/notificaciones` : '/api/notificaciones';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const EXPIRES_AT_KEY = 'expires_at';
const USER_KEY = 'usuario';
const MUST_CHANGE_PASSWORD_KEY = 'must_change_password_override';

const decodeJwtPayload = (token: string): Record<string, any> | null => {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
};

const isAccessTokenExpired = (token: string): boolean => {
    const expiresAt = Number(sessionStorage.getItem(EXPIRES_AT_KEY) || 0);
    if (Number.isFinite(expiresAt) && expiresAt > 0) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        return nowSeconds >= expiresAt - 300;
    }

    const payload = decodeJwtPayload(token);
    const exp = Number(payload?.exp || 0);
    if (!exp) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    return nowSeconds >= exp - 300;
};

const clearAuthStorage = () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_AT_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
    localStorage.removeItem(USER_KEY);
};

const redirectToExpiredLogin = () => {
    if (typeof window === 'undefined') return;
    window.location.replace('/?expired=true');
};

let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = async (): Promise<string | null> => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
            if (!refreshToken) return null;

            const response = await fetch(`${AUTH_URL}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (!response.ok) {
                clearAuthStorage();
                return null;
            }

            const data = await response.json();
            const accessToken = data?.access_token || data?.sesion?.access_token;
            const nextRefreshToken = data?.refresh_token || data?.sesion?.refresh_token;
            const expiresAt = Number(data?.expires_at ?? data?.sesion?.expires_at ?? 0);

            if (!accessToken) {
                clearAuthStorage();
                return null;
            }

            sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
            if (nextRefreshToken) {
                sessionStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
            }
            if (expiresAt > 0) {
                sessionStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
            } else {
                sessionStorage.removeItem(EXPIRES_AT_KEY);
            }

            return accessToken;
        } catch {
            clearAuthStorage();
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

export const getValidAccessToken = async (): Promise<string | null> => {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;

    if (!isAccessTokenExpired(token)) {
        return token;
    }

    return refreshAccessToken();
};

export const getAuthHeaders = () => {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
};

export const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    const token = await getValidAccessToken();

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    let response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
            headers.set('Authorization', `Bearer ${refreshedToken}`);
            response = await fetch(input, { ...init, headers });
        }
    }

    if (response.status === 401) {
        clearAuthStorage();
        redirectToExpiredLogin();
    }

    return response;
};

export const apiFetch = authFetch;
