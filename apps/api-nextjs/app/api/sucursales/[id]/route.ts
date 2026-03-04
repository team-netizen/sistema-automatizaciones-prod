import { withAuth } from "@/middlewares/withAuth"
import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { verificarRol } from "@/lib/permisos"
import { NextResponse } from "next/server"

/**
 * ═══════════════════════════════════════════════════════════
 * PUT /api/sucursales/[id] — Actualizar sucursal
 * ═══════════════════════════════════════════════════════════
 */
export const PUT = withAuth(async (req, usuario, context) => {
    try {
        // [SECURITY FIX] Solo admin empresa puede editar sucursales.
        verificarRol(usuario, ['admin_empresa'])
        const { id } = await context.params
        const sucursalId = id

        if (!sucursalId) {
            return NextResponse.json({ error: "ID de sucursal no proporcionado" }, { status: 400 })
        }

        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        const { nombre, tipo, direccion, activa } = await req.json()

        const { data: sucursal, error } = await supabase
            .from('sucursales')
            .update({
                nombre,
                tipo,
                direccion,
                activa
            })
            .eq('id', sucursalId)
            .eq('empresa_id', empresaId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: sucursal
        })

    } catch (error: any) {
        console.error('[API_SUCURSAL_ID] Error en PUT:', error.message)
        return NextResponse.json({ error: "Error al actualizar sucursal" }, { status: 500 })
    }
})

/**
 * ═══════════════════════════════════════════════════════════
 * DELETE /api/sucursales/[id] — Eliminar sucursal
 * ═══════════════════════════════════════════════════════════
 */
export const DELETE = withAuth(async (req, usuario, context) => {
    try {
        // [SECURITY FIX] Solo admin empresa puede eliminar sucursales.
        verificarRol(usuario, ['admin_empresa'])
        const { id } = await context.params
        const sucursalId = id

        if (!sucursalId) {
            return NextResponse.json({ error: "ID de sucursal no proporcionado" }, { status: 400 })
        }

        const supabase = await createSupabaseServerClient()
        const empresaId = usuario.empresa_id

        // Nota: En una BD real, borrar una sucursal con FK activas (como stock_por_sucursal) 
        // podría fallar si no hay cascada. Se debería manejar con cuidado.
        const { error } = await supabase
            .from('sucursales')
            .delete()
            .eq('id', sucursalId)
            .eq('empresa_id', empresaId)

        if (error) throw error

        return NextResponse.json({
            success: true,
            message: "Sucursal eliminada correctamente"
        })

    } catch (error: any) {
        console.error('[API_SUCURSAL_ID] Error en DELETE:', error.message)
        return NextResponse.json({ error: "Error al eliminar sucursal" }, { status: 500 })
    }
})
