/**
 * ═══════════════════════════════════════════════════════════
 * GET /api/operaciones/alertas   → Listar alertas activas
 * ═══════════════════════════════════════════════════════════
 *
 * Alertas del Centro de Operaciones:
 *   - Stock bajo
 *   - Pedidos vencidos
 *   - Anomalías de inventario
 *
 * Seguridad:
 *   - withModulo('OPERACIONES') → auth + empresa activa + módulo
 *   - Todas las queries filtran por empresa_id
 * ═══════════════════════════════════════════════════════════
 */

import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

// ─── GET: Listar alertas de la empresa ───────────────────
export const GET = withModulo('OPERACIONES', async (req, usuario) => {
    verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);
    const { empresa_id } = usuario;
    const { searchParams } = new URL(req.url);

    const soloNoLeidas = searchParams.get('no_leidas') === 'true';
    const nivel = searchParams.get('nivel'); // informativa | advertencia | critica
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from('alertas_generadas')
        .select('*, alertas_configuracion(tipo_alerta)', { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('fecha_generada', { ascending: false })
        .range(offset, offset + limit - 1);

    if (soloNoLeidas) {
        query = query.eq('leida', false);
    }

    if (nivel && ['informativa', 'advertencia', 'critica'].includes(nivel)) {
        query = query.eq('nivel', nivel);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('[alertas/GET]', error);
        return NextResponse.json(
            { error: 'Error al obtener alertas.' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        data,
        paginacion: {
            pagina: page,
            limite: limit,
            total: count ?? 0,
            total_paginas: Math.ceil((count ?? 0) / limit),
        },
    });
});

