import { withAuth } from '@/middlewares/withAuth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';
import { procesarPedido } from '@/services/procesarPedido';

type PedidoRow = Record<string, any>;

function mapPedido(row: PedidoRow) {
    return {
        ...row,
        id_transaccion:
            row.id_transaccion ??
            row.id_externo ??
            row.order_id_externo ??
            row.numero ??
            row.id,
        canal_origen:
            row.canal_origen ??
            row.medio_pedido ??
            row.origen ??
            row.canal ??
            'desconocido',
        monto_total: Number(row.monto_total ?? row.total ?? row.monto ?? 0),
        fecha_sinc:
            row.fecha_sinc ??
            row.fecha_creacion ??
            row.created_at ??
            row.fecha ??
            null,
        id_orden:
            row.id_orden ??
            row.id_externo ??
            row.order_id_externo ??
            null,
        estado: row.estado ?? 'pendiente',
    };
}

/**
 * GET /api/pedidos - Listar pedidos de la empresa.
 */
export const GET = withAuth(async (_req, usuario) => {
    try {
        const empresaId = usuario.empresa_id;

        const { data: pedidos, error } = await supabaseAdmin
            .from('pedidos')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[API_PEDIDOS] Error en GET:', error);
            return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
        }

        const normalized = (pedidos || []).map(mapPedido);

        return NextResponse.json({
            success: true,
            data: normalized,
        });
    } catch (error: any) {
        console.error('[API_PEDIDOS] Error inesperado en GET:', error?.message || error);
        return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
    }
});

/**
 * POST /api/pedidos - Crear nuevo pedido con items.
 */
export const POST = withAuth(async (req, usuario) => {
    try {
        const empresaId = usuario.empresa_id;
        const body = await req.json();

        const {
            sucursal_id,
            canal_id,
            numero,
            id_externo,
            total,
            items,
            medio_pedido,
            cliente_nombre,
            dni_cliente,
            metodo_pago,
        } = body;

        if (!sucursal_id || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'Faltan campos obligatorios: sucursal_id e items' },
                { status: 400 }
            );
        }

        const resultado = await procesarPedido({
            empresaId,
            sucursalId: sucursal_id,
            canalId: canal_id || 'manual',
            idExterno: id_externo || `MANUAL-${Date.now()}`,
            numeroPedido: numero || `ORD-${Date.now().toString().slice(-6)}`,
            total: total || 0,
            items: items.map((it: any) => ({
                productoId: it.producto_id,
                cantidad: it.cantidad,
                precioUnitario: it.precio_unitario,
                sku_producto: it.sku_producto,
            })),
            usuarioSistemaId: usuario.id,
            id_orden: id_externo || `MANUAL-${Date.now()}`,
            medio_pedido: medio_pedido || 'fisico',
            cliente_id: cliente_nombre || 'Cliente Manual',
            metodo_pago: metodo_pago || 'efectivo',
            dni_cliente: dni_cliente || null,
            fecha_pedido: new Date().toISOString(),
        });

        return NextResponse.json(
            {
                success: true,
                data: resultado.data,
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[API_PEDIDOS] Error en POST:', error?.message || error);
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Error al crear pedido',
            },
            { status: 500 }
        );
    }
});
