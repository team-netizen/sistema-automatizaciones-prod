/**
 * ═══════════════════════════════════════════════════════════
 * GET /api/operaciones/dashboard
 * ═══════════════════════════════════════════════════════════
 *
 * Retorna métricas del dashboard del Centro de Operaciones.
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

export const GET = withModulo('OPERACIONES', async (_req, usuario) => {
    verificarRol(usuario, ['admin_empresa']);
    const { empresa_id } = usuario;

    // ── KPI: Total productos ──────────────────────────────
    const { count: totalProductos } = await supabaseAdmin
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresa_id);

    // ── KPI: Total pedidos del mes ────────────────────────
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count: pedidosMes } = await supabaseAdmin
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresa_id)
        .gte('fecha_creacion', inicioMes.toISOString());

    // ── KPI: Movimientos recientes (últimos 7 días) ───────
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const { count: movimientosRecientes } = await supabaseAdmin
        .from('movimientos_stock')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresa_id)
        .gte('fecha_creacion', hace7Dias.toISOString());

    // ── KPI: Alertas activas ──────────────────────────────
    const { count: alertasActivas } = await supabaseAdmin
        .from('alertas_generadas')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresa_id)
        .eq('leida', false);

    return NextResponse.json({
        empresa_id,
        metricas: {
            total_productos: totalProductos ?? 0,
            pedidos_mes: pedidosMes ?? 0,
            movimientos_recientes: movimientosRecientes ?? 0,
            alertas_activas: alertasActivas ?? 0,
        },
        periodo: {
            inicio_mes: inicioMes.toISOString(),
            ultimos_7_dias: hace7Dias.toISOString(),
        },
    });
});

