import { withAuth } from "@/middlewares/withAuth"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { verificarRol } from "@/lib/permisos"
import { NextResponse } from "next/server"

/**
 * ═══════════════════════════════════════════════════════════
 * PUT /api/productos/[id] — Actualizar producto
 * ═══════════════════════════════════════════════════════════
 */
export const PUT = withAuth(async (req, usuario, context) => {
    try {
        // [SECURITY FIX] Solo admin/encargado pueden editar productos.
        verificarRol(usuario, ['admin_empresa', 'encargado_sucursal'])
        const params = await context.params;
        const productId = params?.id;

        if (!productId) {
            return NextResponse.json({ error: "ID de producto no proporcionado" }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const { nombre, sku, descripcion, precio, activo } = await req.json()

        const { data: producto, error } = await supabase
            .from('productos')
            .update({
                nombre,
                sku,
                descripcion,
                precio: Number(precio),
                activo
            })
            .eq('id', productId)
            .eq('empresa_id', empresaId) // Seguridad extra
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: producto
        })

    } catch (error: any) {
        console.error('[API_PRODUCTOS_ID] Error en PUT:', error.message)
        return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 })
    }
})

/**
 * ═══════════════════════════════════════════════════════════
 * DELETE /api/productos/[id] — Eliminar producto
 * ═══════════════════════════════════════════════════════════
 */
export const DELETE = withAuth(async (req, usuario, context) => {
    try {
        // [SECURITY FIX] Solo admin empresa puede eliminar productos.
        verificarRol(usuario, ['admin_empresa'])
        const params = await context.params;
        const productId = params?.id;

        if (!productId) {
            return NextResponse.json({ error: "ID de producto no proporcionado" }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const { error } = await supabase
            .from('productos')
            .delete()
            .eq('id', productId)
            .eq('empresa_id', empresaId)

        if (error) throw error

        return NextResponse.json({
            success: true,
            message: "Producto eliminado correctamente"
        })

    } catch (error: any) {
        console.error('[API_PRODUCTOS_ID] Error en DELETE:', error.message)
        return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 })
    }
})
