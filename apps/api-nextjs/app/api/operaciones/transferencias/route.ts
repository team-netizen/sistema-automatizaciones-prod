import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

const VALID_ESTADOS = new Set(['pendiente', 'en_transito', 'recibido', 'cancelado']);

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRecoverableColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '').toLowerCase();

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9-]{1,80}$/.test(value);
}

export const GET = withModulo('OPERACIONES', async (req, usuario) => {
  verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);

  const { searchParams } = new URL(req.url);
  const page = toPositiveInt(searchParams.get('page'), 1);
  const limit = Math.min(toPositiveInt(searchParams.get('limit'), 20), 100);
  const offset = (page - 1) * limit;
  const estado = searchParams.get('estado');
  const sucursalOrigen = searchParams.get('sucursal_origen_id');
  const sucursalDestino = searchParams.get('sucursal_destino_id');

  if (estado && !VALID_ESTADOS.has(estado)) {
    return NextResponse.json({ error: 'Estado de transferencia invalido.' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('transferencias_stock')
    .select('*', { count: 'exact' })
    .eq('empresa_id', usuario.empresa_id);

  if (estado) {
    query = query.eq('estado', estado);
  }

  if (usuario.rol === 'encargado_sucursal' && usuario.sucursal_id) {
    if (sucursalOrigen && sucursalOrigen !== usuario.sucursal_id) {
      return NextResponse.json(
        { error: 'No puedes consultar transferencias de otra sucursal (origen).' },
        { status: 403 },
      );
    }

    if (sucursalDestino && sucursalDestino !== usuario.sucursal_id) {
      return NextResponse.json(
        { error: 'No puedes consultar transferencias de otra sucursal (destino).' },
        { status: 403 },
      );
    }

    const sucursalScope = usuario.sucursal_id;
    if (!isSafeId(sucursalScope)) {
      return NextResponse.json({ error: 'Sucursal invalida para consulta.' }, { status: 400 });
    }

    query = query.or(
      `sucursal_origen_id.eq.${sucursalScope},sucursal_destino_id.eq.${sucursalScope}`,
    );
  } else {
    if (sucursalOrigen) query = query.eq('sucursal_origen_id', sucursalOrigen);
    if (sucursalDestino) query = query.eq('sucursal_destino_id', sucursalDestino);
  }

  let response = await query
    .order('fecha_creacion', { ascending: false })
    .range(offset, offset + limit - 1);

  if (response.error && isRecoverableColumnError(response.error)) {
    response = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  }

  if (response.error) {
    const message = response.error.message;
    console.error('[operaciones/transferencias][GET]', message);
    return NextResponse.json({ error: 'Error al obtener transferencias.' }, { status: 500 });
  }

  const transferencias = (response.data ?? []) as Array<Record<string, unknown>>;
  const sucursalIds = [
    ...new Set(
      transferencias
        .flatMap((row) => [row.sucursal_origen_id, row.sucursal_destino_id])
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const sucursalesMap = new Map<string, string>();
  if (sucursalIds.length > 0) {
    const { data: sucursales, error: sucursalesError } = await supabaseAdmin
      .from('sucursales')
      .select('id, nombre')
      .eq('empresa_id', usuario.empresa_id)
      .in('id', sucursalIds);

    if (sucursalesError) {
      console.error('[operaciones/transferencias][GET] sucursales map error:', sucursalesError.message);
      return NextResponse.json(
        { error: 'Error al resolver nombres de sucursales.' },
        { status: 500 },
      );
    }

    for (const sucursal of sucursales ?? []) {
      const id = typeof sucursal.id === 'string' ? sucursal.id : null;
      const nombre = typeof sucursal.nombre === 'string' ? sucursal.nombre : null;
      if (id && nombre) sucursalesMap.set(id, nombre);
    }
  }

  const mapped = transferencias.map((row) => {
    const origenId = typeof row.sucursal_origen_id === 'string' ? row.sucursal_origen_id : null;
    const destinoId = typeof row.sucursal_destino_id === 'string' ? row.sucursal_destino_id : null;

    return {
      ...row,
      sucursal_origen: origenId ? sucursalesMap.get(origenId) ?? null : null,
      sucursal_destino: destinoId ? sucursalesMap.get(destinoId) ?? null : null,
    };
  });

  return NextResponse.json({
    transferencias: mapped,
    data: mapped,
    paginacion: {
      pagina: page,
      limite: limit,
      total: response.count ?? 0,
      total_paginas: Math.ceil((response.count ?? 0) / limit),
    },
  });
});

export const POST = withModulo('OPERACIONES', async (req, usuario) => {
  verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);

  const body = await req.json().catch(() => ({}));
  const sucursal_origen_id = String(body?.sucursal_origen_id ?? '');
  const sucursal_destino_id = String(body?.sucursal_destino_id ?? '');
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!sucursal_origen_id || !sucursal_destino_id) {
    return NextResponse.json(
      { error: 'sucursal_origen_id y sucursal_destino_id son obligatorios.' },
      { status: 400 },
    );
  }

  if (sucursal_origen_id === sucursal_destino_id) {
    return NextResponse.json(
      { error: 'La sucursal de origen y destino no pueden ser la misma.' },
      { status: 400 },
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: 'La transferencia debe incluir al menos un item.' },
      { status: 400 },
    );
  }

  if (usuario.rol === 'encargado_sucursal' && usuario.sucursal_id) {
    const participaSucursal =
      sucursal_origen_id === usuario.sucursal_id || sucursal_destino_id === usuario.sucursal_id;

    if (!participaSucursal) {
      return NextResponse.json(
        { error: 'Encargado solo puede crear transferencias donde participe su sucursal.' },
        { status: 403 },
      );
    }
  }

  const { data: sucursales, error: sucursalesError } = await supabaseAdmin
    .from('sucursales')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .in('id', [sucursal_origen_id, sucursal_destino_id]);

  if (sucursalesError || (sucursales ?? []).length !== 2) {
    return NextResponse.json(
      { error: 'Las sucursales no pertenecen a tu empresa.' },
      { status: 400 },
    );
  }

  const normalizedItems = items.map((item: any) => ({
    producto_id: String(item?.producto_id ?? ''),
    cantidad_enviada: Number(item?.cantidad_enviada ?? 0),
  }));

  if (
    normalizedItems.some(
      (item) => !item.producto_id || !Number.isFinite(item.cantidad_enviada) || item.cantidad_enviada <= 0,
    )
  ) {
    return NextResponse.json(
      { error: 'Cada item debe incluir producto_id y cantidad_enviada > 0.' },
      { status: 400 },
    );
  }

  const productoIds = [...new Set(normalizedItems.map((item) => item.producto_id))];
  const { data: productos, error: productosError } = await supabaseAdmin
    .from('productos')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .in('id', productoIds);

  if (productosError || (productos ?? []).length !== productoIds.length) {
    return NextResponse.json(
      { error: 'Uno o mas productos no pertenecen a tu empresa.' },
      { status: 400 },
    );
  }

  const { data: transferencia, error: transferenciaError } = await supabaseAdmin
    .from('transferencias_stock')
    .insert({
      empresa_id: usuario.empresa_id,
      sucursal_origen_id,
      sucursal_destino_id,
      creado_por: usuario.id,
      estado: 'en_transito',
    })
    .select('*')
    .single();

  if (transferenciaError || !transferencia) {
    console.error('[operaciones/transferencias][POST] transferencia error:', transferenciaError?.message);
    return NextResponse.json({ error: 'Error al crear transferencia.' }, { status: 500 });
  }

  const transferenciaId = typeof transferencia.id === 'string' ? transferencia.id : null;
  if (!transferenciaId) {
    return NextResponse.json({ error: 'No se pudo resolver el id de transferencia.' }, { status: 500 });
  }

  const transferenciaItems = normalizedItems.map((item) => ({
    transferencia_id: transferenciaId,
    producto_id: item.producto_id,
    cantidad_enviada: item.cantidad_enviada,
  }));

  const { data: insertedItems, error: itemsError } = await supabaseAdmin
    .from('transferencia_items')
    .insert(transferenciaItems)
    .select('*');

  if (itemsError) {
    await supabaseAdmin
      .from('transferencias_stock')
      .delete()
      .eq('id', transferenciaId)
      .eq('empresa_id', usuario.empresa_id);

    console.error('[operaciones/transferencias][POST] items error:', itemsError.message);
    return NextResponse.json({ error: 'Error al registrar items de transferencia.' }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        ...transferencia,
        items: insertedItems ?? [],
      },
      transferencia,
      items: insertedItems ?? [],
    },
    { status: 201 },
  );
});
