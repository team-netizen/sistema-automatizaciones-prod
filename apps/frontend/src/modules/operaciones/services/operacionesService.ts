import { API_URL, authFetch } from '../../../lib/api';

export const operacionesService = {
    getDashboard: async () => {
        const response = await authFetch(`${API_URL}/operaciones/dashboard`);
        if (!response.ok) throw new Error('Error al obtener dashboard');
        return response.json();
    },

    getProductos: async (filters: any) => {
        const query = new URLSearchParams(filters).toString();
        const response = await authFetch(`${API_URL}/operaciones/productos?${query}`);
        if (!response.ok) throw new Error('Error al obtener productos');
        return response.json();
    },

    getMovimientos: async (filters: any) => {
        const query = new URLSearchParams(filters).toString();
        const response = await authFetch(`${API_URL}/operaciones/movimientos?${query}`);
        if (!response.ok) throw new Error('Error al obtener movimientos');
        return response.json();
    },

    getPedidos: async () => {
        const response = await authFetch(`${API_URL}/operaciones/pedidos`);
        if (!response.ok) throw new Error('Error al obtener pedidos');
        return response.json();
    },

    getAlertas: async () => {
        const response = await authFetch(`${API_URL}/operaciones/alertas`);
        if (!response.ok) throw new Error('Error al obtener alertas');
        return response.json();
    },

    getReportes: async () => {
        const response = await authFetch(`${API_URL}/operaciones/reportes`);
        if (!response.ok) throw new Error('Error al obtener reportes');
        return response.json();
    },

    getDashboardMetrics: async () => {
        const response = await authFetch(`${API_URL}/operaciones/dashboard`);
        if (!response.ok) throw new Error('Error al obtener metricas del dashboard');
        return response.json();
    }
};
