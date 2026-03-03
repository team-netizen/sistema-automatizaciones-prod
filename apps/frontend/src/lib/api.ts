export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Extraer la base (sin el /api al final)
const getBase = (url: string) => {
    if (url.startsWith('http')) {
        return url.replace(/\/api$/, '');
    }
    return '';
};

export const BASE_URL = getBase(API_URL);
export const AUTH_URL = BASE_URL ? `${BASE_URL}/auth` : '/auth';
export const NOTIFICACIONES_URL = BASE_URL ? `${BASE_URL}/notificaciones` : '/notificaciones';

export const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json'
});
