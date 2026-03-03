/**
 * ═══════════════════════════════════════════════════════════
 * GET  /api/operaciones/pedidos   → Listar pedidos
 * POST /api/operaciones/pedidos   → Crear pedido
 * ═══════════════════════════════════════════════════════════
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

// ─── GET: Listar pedidos de la empresa ───────────────────
export const GET = withModulo('OPERACIONES', async (req, usuario) => {
    const { empresa_id } = usuario;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = (page - 1) * limit;
    const estado = searchParams.get('estado'); // filtro opcional

    let query = supabaseAdmin
        .from('pedidos')
        .select('*', { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('fecha_creacion', { ascending: false })
        .range(offset, offset + limit - 1);

    if (estado) {
        query = query.eq('estado', estado);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('[pedidos/GET]', error);
        return NextResponse.json(
            { error: 'Error al obtener pedidos.' },
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

// ─── POST: Crear pedido ──────────────────────────────────
export const POST = withModulo('OPERACIONES', async (req, usuario) => {
    verificarRol(usuario, ['owner', 'admin', 'empleado', 'operador']);

    const body = await req.json();
    const { cliente, items, notas, prioridad } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
            { error: 'El campo "items" es requerido y debe tener al menos un elemento.' },
            { status: 400 }
        );
    }

    const { data, error } = await supabaseAdmin
        .from('pedidos')
        .insert({
            empresa_id: usuario.empresa_id,
            cliente: cliente ?? null,
            items,
            notas: notas ?? null,
            prioridad: prioridad ?? 'normal',
            estado: 'pendiente',
            creado_por: usuario.id,
        })
        .select()
        .single();

    if (error) {
        console.error('[pedidos/POST]', error);
        return NextResponse.json(
            { error: 'Error al crear el pedido.' },
            { status: 500 }
        );
    }

    return NextResponse.json({ data }, { status: 201 });
});
