/**
 * ═══════════════════════════════════════════════════════════
 * GET  /api/operaciones/productos   → Listar productos
 * POST /api/operaciones/productos   → Crear producto
 * ═══════════════════════════════════════════════════════════
 *
 * Seguridad:
 *   - withModulo('OPERACIONES') → auth + empresa activa + módulo
 *   - Todas las queries filtran por empresa_id
 * ═══════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

// ─── GET: Listar productos de la empresa ─────────────────
export const GET = withModulo('OPERACIONES', async (req, usuario) => {
    const { empresa_id } = usuario;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
        .from('productos')
        .select('*', { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('fecha_creacion', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('[productos/GET]', error);
        return NextResponse.json(
            { error: 'Error al obtener productos.' },
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

// ─── POST: Crear producto ────────────────────────────────
export const POST = withModulo('OPERACIONES', async (req, usuario) => {
    // Solo owner, admin, empleado pueden crear productos
    verificarRol(usuario, ['owner', 'admin', 'empleado', 'operador']);

    const body = await req.json();
    const { nombre, sku, descripcion, precio, stock_actual, stock_minimo, categoria } = body;

    // Validación básica
    if (!nombre || !sku) {
        return NextResponse.json(
            { error: 'Los campos "nombre" y "sku" son requeridos.' },
            { status: 400 }
        );
    }

    const { data, error } = await supabaseAdmin
        .from('productos')
        .insert({
            empresa_id: usuario.empresa_id,
            nombre,
            sku,
            descripcion: descripcion ?? null,
            precio: precio ?? 0,
            stock_actual: stock_actual ?? 0,
            stock_minimo: stock_minimo ?? 0,
            categoria: categoria ?? null,
            creado_por: usuario.id,
        })
        .select()
        .single();

    if (error) {
        // Duplicate SKU
        if (error.code === '23505') {
            return NextResponse.json(
                { error: `El SKU "${sku}" ya existe para esta empresa.` },
                { status: 409 }
            );
        }
        console.error('[productos/POST]', error);
        return NextResponse.json(
            { error: 'Error al crear el producto.' },
            { status: 500 }
        );
    }

    return NextResponse.json({ data }, { status: 201 });
});
