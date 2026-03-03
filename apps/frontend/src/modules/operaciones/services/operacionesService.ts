import { API_URL } from '../../../lib/api';

export const operacionesService = {
    getDashboard: async () => {
        const response = await fetch(`${API_URL}/operaciones/dashboard`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener dashboard');
        return response.json();
    },

    getProductos: async (filters: any) => {
        const query = new URLSearchParams(filters).toString();
        const response = await fetch(`${API_URL}/operaciones/productos?${query}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener productos');
        return response.json();
    },

    getMovimientos: async (filters: any) => {
        const query = new URLSearchParams(filters).toString();
        const response = await fetch(`${API_URL}/operaciones/movimientos?${query}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener movimientos');
        return response.json();
    },

    getPedidos: async () => {
        const response = await fetch(`${API_URL}/operaciones/pedidos`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener pedidos');
        return response.json();
    },

    getAlertas: async () => {
        const response = await fetch(`${API_URL}/operaciones/alertas`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener alertas');
        return response.json();
    },

    getReportes: async () => {
        const response = await fetch(`${API_URL}/operaciones/reportes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener reportes');
        return response.json();
    },

    getDashboardMetrics: async () => {
        const response = await fetch(`${API_URL}/operaciones/dashboard`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        if (!response.ok) throw new Error('Error al obtener métricas del dashboard');
        return response.json();
    }
};
