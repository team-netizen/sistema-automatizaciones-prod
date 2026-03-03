import { withAuth } from "@/middlewares/withAuth"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { NextResponse } from "next/server"

/**
 * ═══════════════════════════════════════════════════════════
 * GET /api/sucursales — Listar sucursales de la empresa
 * ═══════════════════════════════════════════════════════════
 */
export const GET = withAuth(async (req, usuario) => {
    try {
        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        console.log('[API_SUCURSALES] GET - Empresa:', empresaId);

        // Consulta con conteos de stock y skus
        const { data: sucursales, error } = await supabase
            .from('sucursales')
            .select(`
                *,
                stock_por_sucursal (
                    cantidad,
                    producto_id
                )
            `)
            .eq('empresa_id', empresaId)
            .order('nombre', { ascending: true })

        if (error) {
            console.error('[API_SUCURSALES] Error Supabase en GET:', error);
            throw error;
        }

        // Mapear para calcular agregados manualmente
        const result = sucursales?.map(s => {
            const stockItems = s.stock_por_sucursal || [];
            const uniqueSkus = new Set(stockItems.map((item: any) => item.producto_id)).size;
            const totalStock = stockItems.reduce((acc: number, item: any) => acc + (Number(item.cantidad) || 0), 0);

            // Eliminar la relación cruda para limpiar el objeto
            const { stock_por_sucursal, ...rest } = s;

            return {
                ...rest,
                total_skus: uniqueSkus,
                total_stock: totalStock
            };
        }) || [];

        return NextResponse.json({
            success: true,
            data: result
        })

    } catch (error: any) {
        console.error('[API_SUCURSALES] Error detallado en GET:', error)
        return NextResponse.json({ error: error.message || "Error al obtener sucursales" }, { status: 500 })
    }
})

/**
 * ═══════════════════════════════════════════════════════════
 * POST /api/sucursales — Crear nueva sucursal
 * ═══════════════════════════════════════════════════════════
 */
export const POST = withAuth(async (req, usuario) => {
    try {
        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const body = await req.json().catch(() => ({}));
        const { nombre, tipo, direccion, activa } = body;

        console.log('[API_SUCURSALES] POST - Intentando crear:', { nombre, tipo, empresaId });

        if (!nombre) {
            return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
        }

        const { data: sucursal, error } = await supabase
            .from('sucursales')
            .insert({
                empresa_id: empresaId,
                nombre,
                tipo: tipo || 'Física',
                direccion: direccion || '',
                activa: activa !== undefined ? activa : true
            })
            .select()
            .single()

        if (error) {
            console.error('[API_SUCURSALES] Error Supabase en POST:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            data: sucursal
        }, { status: 201 })

    } catch (error: any) {
        console.error('[API_SUCURSALES] Error fatal en POST:', error)
        return NextResponse.json({ error: error.message || "Error interno al crear sucursal" }, { status: 500 })
    }
})
