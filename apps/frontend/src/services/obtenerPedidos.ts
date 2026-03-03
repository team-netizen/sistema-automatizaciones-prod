/**
 * Servicio de Frontend para obtener pedidos
 */
export const obtenerPedidos = async () => {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) throw new Error('No hay token de acceso');

        const response = await fetch('/api/pedidos', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

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
