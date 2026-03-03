import { withAuth } from "@/middlewares/withAuth"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { NextResponse } from "next/server"
import { procesarPedido } from "@/services/procesarPedido"

/**
 * ═══════════════════════════════════════════════════════════
 * GET /api/pedidos — Listar pedidos de la empresa
 * ═══════════════════════════════════════════════════════════
 */
export const GET = withAuth(async (req, usuario) => {
    try {
        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select(`
                id,
                id_transaccion:id_externo,
                canal_origen:medio_pedido,
                monto_total:total,
                fecha_sinc:fecha_creacion,
                estado,
                id_orden,
                numero,
                empresa_id,
                sucursal_id,
                canal_id,
                usuario_id,
                sucursales (
                    nombre,
                    tipo
                )
            `)
            .eq('empresa_id', empresaId)
            .order('fecha_creacion', { ascending: false })

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: pedidos || []
        })

    } catch (error: any) {
        console.error('[API_PEDIDOS] Error en GET:', error.message)
        return NextResponse.json({ error: "Error al obtener pedidos" }, { status: 500 })
    }
})

/**
 * ═══════════════════════════════════════════════════════════
 * POST /api/pedidos — Crear nuevo pedido con items (Vía Servicio)
 * ═══════════════════════════════════════════════════════════
 */
export const POST = withAuth(async (req, usuario) => {
    try {
        const empresaId = usuario.empresa_id
        const body = await req.json()

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
            metodo_pago
        } = body

        if (!sucursal_id || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({
                error: "Faltan campos obligatorios: sucursal_id e items"
            }, { status: 400 })
        }

        // Usamos el servicio centralizado para asegurar consistencia
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
                sku_producto: it.sku_producto
            })),
            usuarioSistemaId: usuario.id,
            id_orden: id_externo || `MANUAL-${Date.now()}`,
            medio_pedido: medio_pedido || 'fisico',
            cliente_id: cliente_nombre || 'Cliente Manual',
            metodo_pago: metodo_pago || 'efectivo',
            dni_cliente: dni_cliente || null,
            fecha_pedido: new Date().toISOString()
        })

        return NextResponse.json({
            success: true,
            data: resultado.data
        }, { status: 201 })

    } catch (error: any) {
        console.error('[API_PEDIDOS] Error en POST:', error.message)
        return NextResponse.json({
            success: false,
            error: error.message || "Error al crear pedido"
        }, { status: 500 })
    }
})
