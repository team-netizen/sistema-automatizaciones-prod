import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

type PedidoRow = Record<string, any>;

const ORDER_CANDIDATES = ['fecha_creacion', 'created_at', 'fecha_sinc'] as const;

function isRecoverableOrderError(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

function mapPedido(row: PedidoRow) {
  return {
    ...row,
    id_transaccion:
      row.id_transaccion ??
      row.id_externo ??
      row.order_id_externo ??
      row.numero ??
      row.id,
    canal_origen:
      row.canal_origen ??
      row.medio_pedido ??
      row.origen ??
      row.canal ??
      'desconocido',
    monto_total: Number(row.monto_total ?? row.total ?? row.monto ?? 0),
    fecha_sinc:
      row.fecha_sinc ??
      row.fecha_creacion ??
      row.created_at ??
      row.fecha ??
      null,
    id_orden:
      row.id_orden ??
      row.id_externo ??
      row.order_id_externo ??
      null,
    estado: row.estado ?? 'pendiente',
  };
}

async function fetchPedidos(params: {
  empresaId: string;
  offset: number;
  limit: number;
  estado: string | null;
}) {
  const { empresaId, offset, limit, estado } = params;
  let lastError: any = null;

  for (const orderBy of ORDER_CANDIDATES) {
    let query = supabaseAdmin
      .from('pedidos')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .order(orderBy, { ascending: false })
      .range(offset, offset + limit - 1);

    if (estado) {
      query = query.eq('estado', estado);
    }

    const result = await query;

    if (!result.error) {
      return {
        data: result.data || [],
        count: result.count ?? 0,
        error: null,
      };
    }

    lastError = result.error;
    if (!isRecoverableOrderError(result.error)) {
      break;
    }
  }

  let fallback = supabaseAdmin
    .from('pedidos')
    .select('*', { count: 'exact' })
    .eq('empresa_id', empresaId)
    .range(offset, offset + limit - 1);

  if (estado) {
    fallback = fallback.eq('estado', estado);
  }

  const fallbackResult = await fallback;

  if (!fallbackResult.error) {
    return {
      data: fallbackResult.data || [],
      count: fallbackResult.count ?? 0,
      error: null,
    };
  }

  return {
    data: null,
    count: null,
    error: fallbackResult.error || lastError,
  };
}

export const GET = withModulo('OPERACIONES', async (req, usuario) => {
  const { empresa_id } = usuario;
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = (page - 1) * limit;
  const estado = searchParams.get('estado');

  const { data, error, count } = await fetchPedidos({
    empresaId: empresa_id,
    offset,
    limit,
    estado,
  });

  if (error) {
    console.error('[pedidos/GET]', error);
    return NextResponse.json({ error: 'Error al obtener pedidos.' }, { status: 500 });
  }

  return NextResponse.json({
    data: (data || []).map(mapPedido),
    paginacion: {
      pagina: page,
      limite: limit,
      total: count ?? 0,
      total_paginas: Math.ceil((count ?? 0) / limit),
    },
  });
});

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
    return NextResponse.json({ error: 'Error al crear el pedido.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
});
