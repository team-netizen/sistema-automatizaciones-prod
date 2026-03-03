import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * Obtiene todos los pedidos con mapeo de columnas sugerido por el usuario
 * Mapeo:
 * - id_externo -> id_transaccion
 * - medio_pedido -> canal_origen
 * - total -> monto_total
 * - fecha_creacion -> fecha_sinc
 * - estado -> estado
 */
const obtenerPedidos = async () => {
    try {
        const { data, error } = await supabaseAdmin
            .from('pedidos')
            .select(`
        id_transaccion:id_externo,
        canal_origen:medio_pedido,
        monto_total:total,
        fecha_sinc:fecha_creacion,
        estado
      `)
            .order('fecha_creacion', { ascending: false });

        if (error) {
            throw new Error('Error al obtener los pedidos: ' + error.message);
        }

        return data;
    } catch (err: any) {
        console.error('Error fetching pedidos:', err.message);
        return [];
    }
};

export default obtenerPedidos;
