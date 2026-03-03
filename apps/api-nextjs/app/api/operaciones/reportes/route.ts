import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const GET = withModulo('OPERACIONES', async (_req, usuario) => {
    const { empresa_id } = usuario;

    // --- Resumen de Ventas y Pedidos ---
    const { data: pedidos, error: errorPedidos } = await supabaseAdmin
        .from('pedidos')
        .select('total, canal_id, created_at')
        .eq('empresa_id', empresa_id)
        .eq('estado', 'confirmado'); // Solo pedidos confirmados para reportes

    if (errorPedidos) {
        console.error('[reportes/GET] errorPedidos:', errorPedidos);
    }

    const totalVentas = pedidos?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0;
    const totalPedidos = pedidos?.length || 0;
    const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

    // --- Distribución por Canales ---
    const { data: canales, error: errorCanales } = await supabaseAdmin
        .from('canales_venta')
        .select('id, nombre')
        .eq('empresa_id', empresa_id);

    const canalesDistribucion = canales?.map(c => {
        const count = pedidos?.filter(p => p.canal_id === c.id).length || 0;
        const porcentaje = totalPedidos > 0 ? (count / totalPedidos) * 100 : 0;
        return {
            nombre: c.nombre,
            porcentaje: Math.round(porcentaje),
            color: '#22C55E' // Default color, can be randomized if needed
        };
    }) || [];

    // --- Top Productos ---
    const topProductos: any[] = []; // TODO: Implement real aggregation if needed

    return NextResponse.json({
        resumen: {
            ventas: totalVentas,
            pedidos: totalPedidos,
            ticket_promedio: ticketPromedio
        },
        top_productos: topProductos,
        canales: canalesDistribucion,
        proyeccion: [30, 45, 25, 60, 40, 70, 50, 35, 65, 55, 45, 60, 75] // Placeholder for now
    });
});
