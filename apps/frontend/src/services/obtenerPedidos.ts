/**
 * Servicio de Frontend para obtener pedidos
 */
import { API_URL, authFetch } from '../lib/api';

export const obtenerPedidos = async () => {
    try {
        const response = await authFetch(`${API_URL}/operaciones/pedidos`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al obtener los pedidos');
        }

        const result = await response.json();
        return result.data || [];
    } catch (err: any) {
        console.error('Error fetching pedidos:', err.message);
        return [];
    }
};

export default obtenerPedidos;
