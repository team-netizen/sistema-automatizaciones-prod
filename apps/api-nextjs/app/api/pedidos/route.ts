import { withAuth } from '@/middlewares/withAuth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';
import { procesarPedido } from '@/services/procesarPedido';

type PedidoRow = Record<string, any>;

const ORDER_CANDIDATES = ['fecha_creacion', 'created_at', 'fecha_sinc'] as const;

function isRecoverableOrderError(error: any): boolean {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();

    return (
        code === '42703' || // undefined_column (Postgres)
        code === 'PGRST204' || // column missing in schema cache
        message.includes('column') ||
        message.includes('schema cache') ||
        message.includes('does not exist')
    );
}

async function fetchPedidosByEmpresa(empresaId: string) {
    let lastError: any = null;

    for (const orderBy of ORDER_CANDIDATES) {
        const result = await supabaseAdmin
            .from('pedidos')
            .select('*')
            .eq('empresa_id', empresaId)
            .order(orderBy, { ascending: false });

        if (!result.error) {
            return { data: result.data || [], error: null };
        }

        lastError = result.error;
        if (!isRecoverableOrderError(result.error)) {
            break;
        }
    }

    // Ultimo intento sin ORDER BY (por compatibilidad de esquemas legacy)
    const fallback = await supabaseAdmin
        .from('pedidos')
        .select('*')
        .eq('empresa_id', empresaId);

    if (!fallback.error) {
        return { data: fallback.data || [], error: null };
    }

    return { data: null, error: fallback.error || lastError };
}

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

        const { data: pedidos, error } = await fetchPedidosByEmpresa(empresaId);

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
