/**
 * ═══════════════════════════════════════════════════════════
 * GET  /api/operaciones/movimientos   → Listar movimientos
 * POST /api/operaciones/movimientos   → Registrar movimiento
 * ═══════════════════════════════════════════════════════════
 *
 * Movimientos de inventario: entradas, salidas, ajustes.
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

// ─── Tipos de movimiento válidos ─────────────────────────
const TIPOS_MOVIMIENTO = ['entrada', 'salida', 'ajuste', 'devolucion'] as const;

// ─── GET: Listar movimientos ─────────────────────────────
export const GET = withModulo('OPERACIONES', async (req, usuario) => {
    verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);
    const { empresa_id } = usuario;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = (page - 1) * limit;
    const tipo = searchParams.get('tipo');

    let query = supabaseAdmin
        .from('movimientos_stock')
        .select(`
            *,
            productos (nombre),
            perfiles (id)
        `, { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('fecha_creacion', { ascending: false })
        .range(offset, offset + limit - 1);

    if (tipo && TIPOS_MOVIMIENTO.includes(tipo as typeof TIPOS_MOVIMIENTO[number])) {
        query = query.eq('tipo', tipo);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('[movimientos/GET]', error);
        return NextResponse.json(
            { error: 'Error al obtener movimientos.' },
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

// ─── POST: Registrar movimiento ──────────────────────────
export const POST = withModulo('OPERACIONES', async (req, usuario) => {
    verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);

    const body = await req.json();
    const { producto_id, tipo, cantidad, motivo } = body;

    // Validaciones
    if (!producto_id || !tipo || cantidad === undefined) {
        return NextResponse.json(
            { error: 'Los campos "producto_id", "tipo" y "cantidad" son requeridos.' },
            { status: 400 }
        );
    }

    if (!TIPOS_MOVIMIENTO.includes(tipo)) {
        return NextResponse.json(
            { error: `Tipo de movimiento inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(', ')}` },
            { status: 400 }
        );
    }

    if (typeof cantidad !== 'number' || cantidad <= 0) {
        return NextResponse.json(
            { error: 'La cantidad debe ser un número positivo.' },
            { status: 400 }
        );
    }

    // Verificar que el producto pertenece a la misma empresa
    const { data: producto, error: prodError } = await supabaseAdmin
        .from('productos')
        .select('id, empresa_id')
        .eq('id', producto_id)
        .eq('empresa_id', usuario.empresa_id)
        .single();

    if (prodError || !producto) {
        return NextResponse.json(
            { error: 'Producto no encontrado en tu empresa.' },
            { status: 404 }
        );
    }

    const { data, error } = await supabaseAdmin
        .from('movimientos_stock')
        .insert({
            empresa_id: usuario.empresa_id,
            producto_id,
            tipo,
            cantidad,
            motivo: motivo ?? null,
            registrado_por: usuario.id,
        })
        .select()
        .single();

    if (error) {
        console.error('[movimientos/POST]', error);
        return NextResponse.json(
            { error: 'Error al registrar el movimiento.' },
            { status: 500 }
        );
    }

    return NextResponse.json({ data }, { status: 201 });
});


