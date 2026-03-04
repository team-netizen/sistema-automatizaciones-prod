import { withAuth } from "@/middlewares/withAuth"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { verificarRol } from "@/lib/permisos"
import { NextResponse } from "next/server"

/**
 * ═══════════════════════════════════════════════════════════
 * GET /api/productos
 * ═══════════════════════════════════════════════════════════
 */
export const GET = withAuth(async (req, usuario) => {
    try {
        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const { data: productos, error } = await supabase
            .from('productos')
            .select('*')
            .eq('empresa_id', empresaId)
            .order('nombre', { ascending: true })

        console.log(`[API_PRODUCTOS] Recuperados ${productos?.length || 0} productos para empresa ${empresaId}`);

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: productos || []
        }, { status: 200 })

    } catch (error: any) {
        console.error('[API_PRODUCTOS] Error en GET:', error.message)
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
    }
})

/**
 * ═══════════════════════════════════════════════════════════
 * POST /api/productos
 * ═══════════════════════════════════════════════════════════
 */
export const POST = withAuth(async (req, usuario) => {
    try {
        // [SECURITY FIX] Solo admin/encargado pueden crear productos.
        verificarRol(usuario, ['admin_empresa', 'encargado_sucursal'])
        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const { nombre, sku, descripcion, precio } = await req.json()

        if (!nombre) {
            return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
        }

        const { data: producto, error } = await supabase
            .from('productos')
            .insert({
                empresa_id: empresaId,
                nombre,
                sku,
                descripcion,
                precio: Number(precio) || 0,
                activo: true
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: producto
        }, { status: 201 })

    } catch (error: any) {
        console.error('[API_PRODUCTOS] Error en POST:', error.message)
        return NextResponse.json({ error: "Error al crear producto" }, { status: 500 })
    }
})
