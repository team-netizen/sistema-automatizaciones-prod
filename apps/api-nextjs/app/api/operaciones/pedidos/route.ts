import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

type PedidoRow = Record<string, any>;
type PedidoItemRow = Record<string, any>;

const ORDER_CANDIDATES = ['fecha_creacion', 'created_at', 'fecha_sinc'] as const;
const OBS_BUNDLE_PREFIX = '[[SISAUTO]]';
const REQUIRED_DETAIL_COLUMNS = [
  'nombre_cliente',
  'telefono_cliente',
  'email_cliente',
  'observaciones',
  'direccion_envio',
  'distrito',
  'provincia',
] as const;

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

async function detectMissingDetailColumns(): Promise<string[]> {
  const missing: string[] = [];

  for (const column of REQUIRED_DETAIL_COLUMNS) {
    const { error } = await supabaseAdmin.from('pedidos').select(column).limit(1);
    if (!error) continue;
    if (isRecoverableOrderError(error)) {
      missing.push(column);
    }
  }

  return missing;
}

function sanitizeText(value: any, maxLength = 600): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const withoutHtml = raw.replace(/<[^>]*>/g, ' ');
  const decoded = withoutHtml
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  const compact = decoded.replace(/\s+/g, ' ').trim();
  if (!compact) return null;

  return compact.slice(0, maxLength);
}

function decodeObservacionesBundle(text: string | null): { note: string | null; items: string | null } {
  const clean = sanitizeText(text, 2500);
  if (!clean || !clean.startsWith(OBS_BUNDLE_PREFIX)) {
    return { note: null, items: null };
  }

  const payloadRaw = clean.slice(OBS_BUNDLE_PREFIX.length).trim();
  if (!payloadRaw) return { note: null, items: null };

  try {
    const payload = JSON.parse(payloadRaw);
    return {
      note: sanitizeText(payload?.note ?? null, 1500),
      items: sanitizeText(payload?.items ?? null, 1500),
    };
  } catch {
    return { note: null, items: null };
  }
}

function extractItemSummaryFromObservaciones(text: string | null): string | null {
  const clean = sanitizeText(text, 2500);
  if (!clean) return null;

  const segments = clean
    .split('|')
    .map((seg) => seg.trim())
    .filter(Boolean);

  const itemLike = segments.filter((seg) => /\bSKU\s*:|\bx\s*\d+\b/i.test(seg));
  if (itemLike.length > 0) {
    return itemLike.join(' | ');
  }

  if (/\bSKU\s*:|\bx\s*\d+\b/i.test(clean)) return clean;
  return null;
}

function stripItemSummaryFromObservaciones(text: string | null): string | null {
  const clean = sanitizeText(text, 2500);
  if (!clean) return null;

  const segments = clean
    .split('|')
    .map((seg) => seg.trim())
    .filter(Boolean);

  const noteSegments = segments.filter((seg) => !/\bSKU\s*:|\bx\s*\d+\b/i.test(seg));
  if (noteSegments.length > 0) {
    return noteSegments.join(' | ').slice(0, 1500);
  }

  return null;
}

function extractSkuFromText(text: string | null): string | null {
  const clean = sanitizeText(text, 2500);
  if (!clean) return null;

  const matches = [...clean.matchAll(/\bSKU\s*:\s*([A-Za-z0-9._-]+)/gi)].map((m) => String(m[1]).trim());
  const unique = [...new Set(matches.filter(Boolean))];
  if (!unique.length) return null;
  return unique.join(', ');
}

function extractCantidadFromText(text: string | null): string | null {
  const clean = sanitizeText(text, 2500);
  if (!clean) return null;

  const matches = [...clean.matchAll(/\bx\s*(\d+)\b/gi)].map((m) => String(m[1]).trim());
  if (!matches.length) return null;
  return matches[matches.length - 1];
}

function normalizeCantidadValue(value: string | null): string | null {
  const clean = sanitizeText(value, 120);
  if (!clean) return null;

  const fromX = [...clean.matchAll(/\bx\s*(\d+)\b/gi)].map((m) => String(m[1]).trim());
  if (fromX.length > 0) return fromX[fromX.length - 1];

  const tokens = [...clean.matchAll(/\b\d+\b/g)].map((m) => String(m[0]).trim());
  if (tokens.length > 0) return tokens[tokens.length - 1];

  return null;
}

function mapPedido(row: PedidoRow) {
  const observacionesRaw = sanitizeText(row.observaciones ?? row.notas ?? null, 1500);
  const obsBundle = decodeObservacionesBundle(observacionesRaw);
  const productosRaw = sanitizeText(row.productos ?? null, 1500);
  const productosFromObs = obsBundle.items || extractItemSummaryFromObservaciones(observacionesRaw);
  const productos = productosRaw || productosFromObs;
  const cantidad = normalizeCantidadValue(row.cantidad ?? null) || extractCantidadFromText(productos);
  const sku = sanitizeText(row.sku ?? null, 350) || extractSkuFromText(productos);
  const observacionesOnlyNotes = obsBundle.note ?? stripItemSummaryFromObservaciones(observacionesRaw);

  return {
    ...row,
    id_transaccion:
      row.id_transaccion ??
      row.numero ??
      row.id_externo ??
      row.order_id_externo ??
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
    dni: row.dni ?? row.dni_cliente ?? null,
    fecha_pedido: row.fecha_pedido ?? row.fecha_creacion ?? null,
    nombre_cliente: sanitizeText(row.nombre_cliente ?? row.cliente_nombre ?? row.id_cliente ?? null, 180),
    telefono: sanitizeText(row.telefono ?? row.telefono_cliente ?? null, 40),
    email: sanitizeText(row.email ?? row.email_cliente ?? null, 180),
    direccion_envio: sanitizeText(row.direccion_envio ?? row.direccion_cliente ?? null, 350),
    distrito: sanitizeText(row.distrito ?? row.distrito_cliente ?? null, 120),
    provincia: sanitizeText(row.provincia ?? row.provincia_cliente ?? null, 120),
    metodo_pago: sanitizeText(row.metodo_pago ?? null, 220),
    productos,
    cantidad,
    sku,
    observaciones: observacionesOnlyNotes,
    estado: row.estado ?? 'pendiente',
  };
}

function extractProductoNombre(item: PedidoItemRow): string {
  const productosRel = item?.productos;

  if (Array.isArray(productosRel)) {
    const nombre = productosRel[0]?.nombre;
    return typeof nombre === 'string' ? nombre : '';
  }

  if (productosRel && typeof productosRel === 'object') {
    const nombre = (productosRel as any).nombre;
    return typeof nombre === 'string' ? nombre : '';
  }

  return '';
}

async function attachPedidoItemsSummary(rows: PedidoRow[]): Promise<PedidoRow[]> {
  const pedidoIds = rows.map((row) => row.id).filter(Boolean);
  if (pedidoIds.length === 0) return rows;

  const { data: items, error } = await supabaseAdmin
    .from('pedido_items')
    .select('pedido_id, cantidad, sku_producto, productos (nombre)')
    .in('pedido_id', pedidoIds);

  if (error || !items) {
    if (error) {
      console.error('[pedidos/GET] attach items summary error:', error.message);
    }
    return rows;
  }

  const grouped = new Map<
    string,
    {
      productos: string[];
      cantidades: string[];
      skus: string[];
    }
  >();

  for (const item of items as PedidoItemRow[]) {
    const pedidoId = String(item.pedido_id || '');
    if (!pedidoId) continue;

    if (!grouped.has(pedidoId)) {
      grouped.set(pedidoId, { productos: [], cantidades: [], skus: [] });
    }

    const bucket = grouped.get(pedidoId)!;
    const nombreProducto = extractProductoNombre(item);
    const sku = String(item.sku_producto || '').trim();
    const cantidad = Number(item.cantidad ?? 0);

    bucket.productos.push(nombreProducto || sku || 'SIN_PRODUCTO');
    bucket.skus.push(sku || 'N/A');
    bucket.cantidades.push(Number.isFinite(cantidad) ? String(cantidad) : '0');
  }

  return rows.map((row) => {
    const key = String(row.id || '');
    const summary = grouped.get(key);
    if (!summary) return row;

    return {
      ...row,
      productos: summary.productos.join(' | '),
      cantidad: summary.cantidades.join(', '),
      sku: summary.skus.join(', '),
    };
  });
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

  const withItems = await attachPedidoItemsSummary(data || []);
  const missingColumns = await detectMissingDetailColumns();

  return NextResponse.json({
    data: withItems.map(mapPedido),
    schema_warning:
      missingColumns.length > 0
        ? {
            missing_columns: missingColumns,
            message:
              'Faltan columnas en la tabla pedidos para almacenar todos los campos del webhook.',
            migration: 'scripts/2026-03-03_pedidos_campos_adicionales.sql',
          }
        : null,
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
