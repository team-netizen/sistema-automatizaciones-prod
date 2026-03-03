import { withAuth } from '@/middlewares/withAuth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';
import { procesarPedido } from '@/services/procesarPedido';

type PedidoRow = Record<string, any>;
type PedidoItemRow = Record<string, any>;

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
            row.numero ??
            row.id_externo ??
            row.order_id_externo ??
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
        dni: row.dni ?? row.dni_cliente ?? null,
        fecha_pedido: row.fecha_pedido ?? row.fecha_creacion ?? null,
        nombre_cliente: row.nombre_cliente ?? row.cliente_nombre ?? null,
        telefono: row.telefono ?? row.telefono_cliente ?? null,
        email: row.email ?? row.email_cliente ?? null,
        direccion_envio: row.direccion_envio ?? row.direccion_cliente ?? null,
        distrito: row.distrito ?? row.distrito_cliente ?? null,
        provincia: row.provincia ?? row.provincia_cliente ?? null,
        metodo_pago: row.metodo_pago ?? null,
        observaciones: row.observaciones ?? row.notas ?? null,
        estado: row.estado ?? 'pendiente',
    };
}

function extractProductoNombre(item: PedidoItemRow): string {
    const productosRel = item?.productos;

    if (Array.isArray(productosRel)) {
        const nombre = productosRel[0]?.nombre;
        return typeof nombre === 'string' ? nombre : '';
    }

    if (productosRel && typeof productosRel === 'object') {
        const nombre = (productosRel as any).nombre;
        return typeof nombre === 'string' ? nombre : '';
    }

    return '';
}

async function attachPedidoItemsSummary(rows: PedidoRow[]): Promise<PedidoRow[]> {
    const pedidoIds = rows.map((row) => row.id).filter(Boolean);
    if (pedidoIds.length === 0) return rows;

    const { data: items, error } = await supabaseAdmin
        .from('pedido_items')
        .select('pedido_id, cantidad, sku_producto, productos (nombre)')
        .in('pedido_id', pedidoIds);

    if (error || !items) {
        if (error) {
            console.error('[API_PEDIDOS] attach items summary error:', error.message);
        }
        return rows;
    }

    const grouped = new Map<
        string,
        {
            productos: string[];
            cantidades: string[];
            skus: string[];
        }
    >();

    for (const item of items as PedidoItemRow[]) {
        const pedidoId = String(item.pedido_id || '');
        if (!pedidoId) continue;

        if (!grouped.has(pedidoId)) {
            grouped.set(pedidoId, { productos: [], cantidades: [], skus: [] });
        }

        const bucket = grouped.get(pedidoId)!;
        const nombreProducto = extractProductoNombre(item);
        const sku = String(item.sku_producto || '').trim();
        const cantidad = Number(item.cantidad ?? 0);

        bucket.productos.push(nombreProducto || sku || 'SIN_PRODUCTO');
        bucket.skus.push(sku || 'N/A');
        bucket.cantidades.push(Number.isFinite(cantidad) ? String(cantidad) : '0');
    }

    return rows.map((row) => {
        const key = String(row.id || '');
        const summary = grouped.get(key);
        if (!summary) return row;

        return {
            ...row,
            productos: summary.productos.join(' | '),
            cantidad: summary.cantidades.join(', '),
            sku: summary.skus.join(', '),
        };
    });
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

        const withItems = await attachPedidoItemsSummary(pedidos || []);
        const normalized = withItems.map(mapPedido);

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
