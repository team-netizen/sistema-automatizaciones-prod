import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { procesarPedido, PedidoItemSimple } from '@/services/procesarPedido';

const DEFAULT_ACCEPTED_STATUSES = ['processing', 'completed', 'on-hold', 'pending'];

type PedidoEstado = 'pendiente' | 'confirmado' | 'cancelado' | null;

function getAcceptedStatuses(): string[] {
  const raw = process.env.WC_ACCEPTED_STATUSES?.trim();
  if (!raw) return DEFAULT_ACCEPTED_STATUSES;

  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function computeUnitPrice(item: any, qty: number, fallbackPrice: number): number {
  const fromPrice = Number(item?.price);
  if (Number.isFinite(fromPrice) && fromPrice >= 0) return fromPrice;

  const lineTotal = Number(item?.total);
  if (Number.isFinite(lineTotal) && lineTotal >= 0 && qty > 0) {
    return lineTotal / qty;
  }

  return Number.isFinite(fallbackPrice) ? fallbackPrice : 0;
}

function mapWooStatusToPedidoEstado(status: string | undefined): PedidoEstado {
  const normalized = String(status || '').toLowerCase().trim();

  if (normalized === 'processing' || normalized === 'completed') return 'confirmado';
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'failed' || normalized === 'refunded') {
    return 'cancelado';
  }
  if (normalized === 'pending' || normalized === 'on-hold') return 'pendiente';
  return null;
}

function isValidHmacSignature(rawBody: string, webhookToken: string, signature: string): boolean {
  const generated = crypto
    .createHmac('sha256', webhookToken)
    .update(rawBody)
    .digest('base64');

  return (
    signature.length === generated.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(generated))
  );
}

function parseWebhookBody(rawBody: string): any | null {
  try {
    return JSON.parse(rawBody);
  } catch {
    try {
      const params = new URLSearchParams(rawBody);
      const embeddedPayload =
        params.get('payload') ||
        params.get('body') ||
        params.get('data') ||
        params.get('order');

      if (embeddedPayload) {
        return JSON.parse(embeddedPayload);
      }

      const id = params.get('id') || params.get('order_id');
      if (id) {
        return {
          id,
          status: params.get('status') || 'processing',
          total: params.get('total') || '0',
          line_items: [],
          billing: {},
          shipping: {},
          meta_data: [],
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getLineItems(body: any): any[] {
  if (Array.isArray(body?.line_items)) return body.line_items;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.lineItems)) return body.lineItems;
  return [];
}

function isMissingColumnError(error: any): boolean {
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

function cleanText(value: any, maxLength = 255): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanHumanText(value: any, maxLength = 255): string | null {
  const raw = String(value ?? '');
  if (!raw.trim()) return null;

  const noHtml = raw.replace(/<[^>]*>/g, ' ');
  const decoded = decodeHtmlEntities(noHtml);
  const compact = decoded.replace(/\s+/g, ' ').trim();
  if (!compact) return null;

  return compact.slice(0, maxLength);
}

function normalizeMetaKey(key: any): string {
  return String(key || '')
    .toLowerCase()
    .trim()
    .replace(/^_+/, '');
}

function getMetaValue(metaData: any[], keys: string[]): string | null {
  const normalizedKeys = new Set(keys.map((k) => normalizeMetaKey(k)));

  for (const entry of metaData || []) {
    const key = normalizeMetaKey(entry?.key);
    if (!normalizedKeys.has(key)) continue;

    const value = entry?.value;
    if (value === null || value === undefined) continue;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      const first = value.find((v) => v !== null && v !== undefined);
      if (first !== undefined) return String(first);
      continue;
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        continue;
      }
    }
  }

  return null;
}

function buildNombreCliente(body: any, metaData: any[]): string | null {
  const billing = body?.billing || {};
  const shipping = body?.shipping || {};

  const firstName = cleanHumanText(
    billing?.first_name ||
      shipping?.first_name ||
      getMetaValue(metaData, ['billing_first_name', '_billing_first_name', 'first_name', 'nombre']),
    90
  );
  const lastName = cleanHumanText(
    billing?.last_name ||
      shipping?.last_name ||
      getMetaValue(metaData, ['billing_last_name', '_billing_last_name', 'last_name', 'apellido']),
    90
  );

  const billingName = `${firstName || ''} ${lastName || ''}`.trim();
  if (billingName) return billingName.slice(0, 180);

  const company = cleanHumanText(
    billing?.company || shipping?.company || getMetaValue(metaData, ['billing_company', 'company']),
    180
  );
  if (company) return company;

  const emailPrefix = cleanHumanText(
    String(billing?.email || getMetaValue(metaData, ['billing_email', 'email']) || '').split('@')[0],
    120
  );
  if (emailPrefix) return emailPrefix;

  return null;
}

function buildItemsResumen(lineItems: any[]): string | null {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return null;

  const parts = lineItems.map((item: any) => {
    const name = String(item?.name || 'Producto').trim();
    const sku = String(item?.sku || 'N/A').trim();
    const qty = Number(item?.quantity ?? 0);
    const qtyText = Number.isFinite(qty) && qty > 0 ? qty : 1;
    return `${name} [SKU:${sku}] x${qtyText}`;
  });

  return parts.join(' | ').slice(0, 1200);
}

async function getNextConsecutiveNumero(empresaId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('pedidos')
    .select('numero')
    .eq('empresa_id', empresaId)
    .order('fecha_creacion', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('[WC_WEBHOOK] getNextConsecutiveNumero error:', error.message);
    return String(Date.now()).slice(-6);
  }

  let maxNumero = 0;
  for (const row of data || []) {
    const numero = String(row?.numero || '').trim();
    if (!/^\d+$/.test(numero)) continue;
    const parsed = Number(numero);
    if (Number.isFinite(parsed) && parsed > maxNumero) {
      maxNumero = parsed;
    }
  }

  return String(maxNumero + 1);
}

async function resolveEmpresa(params: {
  empresaIdFromRequest: string | null;
  tokenFromQuery: string | null;
  firmaHeader: string | null;
  rawBody: string;
}) {
  const { empresaIdFromRequest, tokenFromQuery, firmaHeader, rawBody } = params;

  if (empresaIdFromRequest) {
    const { data } = await supabaseAdmin
      .from('empresas')
      .select('id, webhook_token, estado')
      .eq('id', empresaIdFromRequest)
      .maybeSingle();
    return data ?? null;
  }

  if (tokenFromQuery) {
    const { data } = await supabaseAdmin
      .from('empresas')
      .select('id, webhook_token, estado')
      .eq('webhook_token', tokenFromQuery)
      .maybeSingle();
    return data ?? null;
  }

  if (firmaHeader) {
    const { data: empresas } = await supabaseAdmin
      .from('empresas')
      .select('id, webhook_token, estado')
      .not('webhook_token', 'is', null)
      .limit(500);

    const matched = (empresas || []).find((e: any) =>
      isValidHmacSignature(rawBody, String(e.webhook_token || ''), firmaHeader)
    );

    return matched ?? null;
  }

  return null;
}

async function findProductoPorSku(empresaId: string, sku: string) {
  const exact = await supabaseAdmin
    .from('productos')
    .select('id, precio')
    .eq('empresa_id', empresaId)
    .eq('sku', sku)
    .maybeSingle();

  if (exact.data) return exact.data;

  const ci = await supabaseAdmin
    .from('productos')
    .select('id, precio')
    .eq('empresa_id', empresaId)
    .ilike('sku', sku)
    .limit(1)
    .maybeSingle();

  return ci.data;
}

async function findProductoPorNombre(empresaId: string, nombre: string) {
  const normalized = String(nombre || '').trim();
  if (!normalized) return null;

  const exact = await supabaseAdmin
    .from('productos')
    .select('id, precio')
    .eq('empresa_id', empresaId)
    .eq('nombre', normalized)
    .limit(1)
    .maybeSingle();

  if (exact.data) return exact.data;

  const ci = await supabaseAdmin
    .from('productos')
    .select('id, precio')
    .eq('empresa_id', empresaId)
    .ilike('nombre', normalized)
    .limit(1)
    .maybeSingle();

  return ci.data;
}

async function ensureSucursalActiva(empresaId: string): Promise<{ id: string }> {
  const existing = await supabaseAdmin
    .from('sucursales')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('activa', true)
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) return existing.data;

  const created = await supabaseAdmin
    .from('sucursales')
    .insert({
      empresa_id: empresaId,
      nombre: 'Almacen Principal',
      tipo: 'almacen',
      activa: true,
      permite_despacho: true,
      prioridad_despacho: 1,
    })
    .select('id')
    .single();

  if (created.error || !created.data?.id) {
    throw new Error(`no_active_sucursal: ${created.error?.message || 'insert_failed'}`);
  }

  return created.data;
}

async function ensureCanalActivo(empresaId: string): Promise<{ id: string }> {
  const woo = await supabaseAdmin
    .from('canales_venta')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .ilike('nombre', '%woo%')
    .limit(1)
    .maybeSingle();

  if (woo.data?.id) return woo.data;

  const any = await supabaseAdmin
    .from('canales_venta')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (any.data?.id) return any.data;

  const codigo = `WOO-${Date.now().toString(36).toUpperCase()}`;
  const created = await supabaseAdmin
    .from('canales_venta')
    .insert({
      empresa_id: empresaId,
      nombre: 'WooCommerce',
      codigo,
      activo: true,
    })
    .select('id')
    .single();

  if (created.error || !created.data?.id) {
    throw new Error(`no_active_canal: ${created.error?.message || 'insert_failed'}`);
  }

  return created.data;
}

async function tryUpdatePedidoField(
  pedidoId: string,
  columns: string[],
  value: string | null
): Promise<void> {
  if (value === null) return;

  for (const column of columns) {
    const { error } = await supabaseAdmin
      .from('pedidos')
      .update({ [column]: value })
      .eq('id', pedidoId);

    if (!error) return;
    if (isMissingColumnError(error)) continue;

    console.error(`[WC_WEBHOOK] update field "${column}" failed:`, error.message);
    return;
  }
}

async function persistPedidoExtras(params: {
  pedidoId: string;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  emailCliente: string | null;
  observaciones: string | null;
  direccionEnvio: string | null;
  distrito: string | null;
  provincia: string | null;
}) {
  await tryUpdatePedidoField(params.pedidoId, ['nombre_cliente', 'cliente_nombre'], params.nombreCliente);
  await tryUpdatePedidoField(params.pedidoId, ['id_cliente'], params.nombreCliente);
  await tryUpdatePedidoField(params.pedidoId, ['telefono_cliente', 'telefono'], params.telefonoCliente);
  await tryUpdatePedidoField(params.pedidoId, ['email_cliente', 'email'], params.emailCliente);
  await tryUpdatePedidoField(params.pedidoId, ['observaciones', 'nota', 'notas'], params.observaciones);
  await tryUpdatePedidoField(params.pedidoId, ['direccion_envio'], params.direccionEnvio);
  await tryUpdatePedidoField(params.pedidoId, ['distrito'], params.distrito);
  await tryUpdatePedidoField(params.pedidoId, ['provincia'], params.provincia);
}

async function persistPedidoItemsIfMissing(params: {
  pedidoId: string;
  empresaId: string;
  sucursalId: string;
  itemsInternos: PedidoItemSimple[];
}) {
  const { pedidoId, empresaId, sucursalId, itemsInternos } = params;
  if (!itemsInternos.length) return;

  const existing = await supabaseAdmin
    .from('pedido_items')
    .select('id')
    .eq('pedido_id', pedidoId)
    .limit(1);

  if (existing.data && existing.data.length > 0) {
    return;
  }

  const fullRows = itemsInternos.map((it) => ({
    pedido_id: pedidoId,
    empresa_id: empresaId,
    sucursal_id: sucursalId,
    producto_id: it.productoId,
    cantidad: it.cantidad,
    precio_unitario: it.precioUnitario,
    sku_producto: it.sku_producto || null,
  }));

  const fullInsert = await supabaseAdmin.from('pedido_items').insert(fullRows);
  if (!fullInsert.error) return;

  if (!isMissingColumnError(fullInsert.error)) {
    console.error('[WC_WEBHOOK] insert pedido_items failed:', fullInsert.error.message);
    return;
  }

  const compactRows = itemsInternos.map((it) => ({
    pedido_id: pedidoId,
    producto_id: it.productoId,
    cantidad: it.cantidad,
    precio_unitario: it.precioUnitario,
  }));

  const compactInsert = await supabaseAdmin.from('pedido_items').insert(compactRows);
  if (compactInsert.error) {
    console.error('[WC_WEBHOOK] insert pedido_items compact failed:', compactInsert.error.message);
  }
}

async function registrarPedidoFallback(params: {
  empresaId: string;
  sucursalId: string;
  canalId: string;
  idExterno: string;
  numeroPedido: string;
  total: number;
  idOrden: string;
  nombreCliente?: string | null;
  metodoPago: string;
  direccion: string;
  distrito: string;
  provincia: string;
  dni: string;
  fechaPedido: string;
  estado: PedidoEstado;
}) {
  const duplicated = await supabaseAdmin
    .from('pedidos')
    .select('id')
    .eq('empresa_id', params.empresaId)
    .eq('id_externo', params.idExterno)
    .maybeSingle();

  if (duplicated.data?.id) {
    return { pedidoId: duplicated.data.id, duplicado: true };
  }

  const richInsert = await supabaseAdmin
    .from('pedidos')
    .insert({
      empresa_id: params.empresaId,
      sucursal_id: params.sucursalId,
      canal_id: params.canalId,
      numero: String(params.numeroPedido || params.idExterno).slice(0, 120),
      total: Number.isFinite(params.total) ? params.total : 0,
      estado: params.estado,
      id_externo: String(params.idExterno || '').slice(0, 120),
      id_orden: String(params.idOrden || params.idExterno || '').slice(0, 120),
      medio_pedido: 'web',
      id_cliente: params.nombreCliente || null,
      metodo_pago: params.metodoPago || null,
      direccion_cliente: params.direccion || null,
      distrito_cliente: params.distrito || null,
      provincia_cliente: params.provincia || null,
      dni_cliente: params.dni || null,
      fecha_pedido: params.fechaPedido || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!richInsert.error && richInsert.data?.id) {
    return { pedidoId: richInsert.data.id, duplicado: false };
  }

  console.error(
    '[WC_WEBHOOK] fallback rich insert failed, retrying minimal insert:',
    richInsert.error?.message || 'unknown_error'
  );

  const minimalInsert = await supabaseAdmin
    .from('pedidos')
    .insert({
      empresa_id: params.empresaId,
      sucursal_id: params.sucursalId,
      canal_id: params.canalId,
      numero: String(params.numeroPedido || params.idExterno || `WC-${Date.now()}`).slice(0, 120),
      total: Number.isFinite(params.total) ? params.total : 0,
      estado: params.estado,
      id_externo: String(params.idExterno || '').slice(0, 120),
      medio_pedido: 'web',
      id_cliente: params.nombreCliente || null,
      fecha_pedido: params.fechaPedido || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (minimalInsert.error || !minimalInsert.data?.id) {
    throw new Error(
      `fallback_insert_failed: ${minimalInsert.error?.message || richInsert.error?.message || 'unknown'}`
    );
  }

  return { pedidoId: minimalInsert.data.id, duplicado: false };
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaIdFromRequest = req.headers.get('x-empresa-id') || searchParams.get('empresa_id');
    const tokenFromQuery = searchParams.get('token');
    const firmaHeader = req.headers.get('x-wc-webhook-signature');
    const rawBody = await req.text();

    if (!empresaIdFromRequest && !tokenFromQuery && !firmaHeader) {
      return NextResponse.json(
        {
          error: 'Credenciales faltantes. Usa firma Woo o ?empresa_id / ?token.',
        },
        { status: 401 }
      );
    }

    const empresa = await resolveEmpresa({
      empresaIdFromRequest,
      tokenFromQuery,
      firmaHeader,
      rawBody,
    });

    if (!empresa || !empresa.webhook_token) {
      return NextResponse.json(
        { error: 'Configuracion de empresa no encontrada o incompleta.' },
        { status: 403 }
      );
    }

    const estadoEmpresa = String(empresa.estado || '').toLowerCase().trim();
    const estadosPermitidos = new Set(['activo', 'activa', 'prueba']);

    if (!estadosPermitidos.has(estadoEmpresa)) {
      return NextResponse.json(
        { error: 'La empresa no se encuentra en estado activo.' },
        { status: 403 }
      );
    }

    if (firmaHeader) {
      const firmaValida = isValidHmacSignature(rawBody, empresa.webhook_token, firmaHeader);

      if (!firmaValida) {
        return NextResponse.json({ error: 'Firma de webhook invalida.' }, { status: 403 });
      }
    } else {
      if (!tokenFromQuery || tokenFromQuery !== empresa.webhook_token) {
        return NextResponse.json(
          { error: 'Falta firma de webhook y token invalido o ausente.' },
          { status: 401 }
        );
      }
    }

    const body = parseWebhookBody(rawBody);
    if (!body) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: 'invalid_payload_format',
        },
        { status: 200 }
      );
    }

    const orderIdRaw = body?.id ?? body?.order_id ?? body?.resource_id ?? body?.data?.id;
    if (!orderIdRaw) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: 'missing_order_id' },
        { status: 200 }
      );
    }

    const acceptedStatuses = getAcceptedStatuses();
    const status = String(body.status || body.order_status || 'processing').toLowerCase();
    const lineItems = getLineItems(body);

    // Compatibilidad: si el estado no está en la lista permitida, igual se procesa en fallback.
    const outOfScopeStatus = !acceptedStatuses.includes(status);

    const sucursal = await ensureSucursalActiva(empresa.id);
    const canal = await ensureCanalActivo(empresa.id);

    const itemsInternos: PedidoItemSimple[] = [];
    const itemWarnings: string[] = [];
    let needsDirectFallback = outOfScopeStatus || lineItems.length === 0;

    for (const item of lineItems) {
      const sku = String(item?.sku || '').trim();
      const nombreProducto = String(item?.name || '').trim();
      const qty = Number(item?.quantity ?? 0);

      if (!Number.isFinite(qty) || qty <= 0) {
        needsDirectFallback = true;
        itemWarnings.push(`Cantidad invalida para SKU ${sku || 'N/A'}.`);
        continue;
      }

      let producto = null;
      if (sku) {
        producto = await findProductoPorSku(empresa.id, sku);
      }

      if (!producto && nombreProducto) {
        producto = await findProductoPorNombre(empresa.id, nombreProducto);
      }

      if (!producto) {
        needsDirectFallback = true;
        itemWarnings.push(
          `Producto no mapeado (sku="${sku || 'N/A'}", nombre="${nombreProducto || 'N/A'}").`
        );
        continue;
      }

      const unitPrice = computeUnitPrice(item, qty, Number(producto.precio));

      itemsInternos.push({
        productoId: producto.id,
        sku_producto: sku,
        cantidad: qty,
        precioUnitario: unitPrice,
      });
    }

    const billing = body.billing || {};
    const shipping = body.shipping || {};
    const metaData = Array.isArray(body.meta_data) ? body.meta_data : [];
    const numeroConsecutivo = await getNextConsecutiveNumero(empresa.id);
    const nombreCliente = cleanHumanText(buildNombreCliente(body, metaData), 180);
    const telefonoCliente = cleanHumanText(
      billing.phone ||
        shipping.phone ||
        getMetaValue(metaData, ['billing_phone', 'phone', 'telefono', 'celular']),
      40
    );
    const emailCliente = cleanHumanText(
      billing.email || shipping.email || getMetaValue(metaData, ['billing_email', 'email']),
      180
    );
    const notaCliente = cleanHumanText(
      body.customer_note ||
        body.note ||
        body.customer_message ||
        getMetaValue(metaData, ['customer_note', 'note', 'observaciones']),
      600
    );
    const resumenItems = cleanText(buildItemsResumen(lineItems), 1200);
    const observaciones = cleanText(
      [notaCliente, resumenItems].filter(Boolean).join(' | '),
      1500
    );

    const payloadPedido = {
      empresaId: empresa.id,
      sucursalId: sucursal.id,
      canalId: canal.id,
      idExterno: String(orderIdRaw),
      numeroPedido: numeroConsecutivo,
      total: Number(body.total) || 0,
      idOrden: String(body.number || orderIdRaw),
      metodoPago: cleanHumanText(body.payment_method_title || body.payment_method || 'WooCommerce', 180) || 'WooCommerce',
      direccion: cleanText(shipping.address_1 || billing.address_1, 350) || '',
      distrito: cleanText(shipping.city || billing.city, 120) || '',
      provincia: cleanText(shipping.state || billing.state, 120) || '',
      nombreCliente,
      telefonoCliente,
      emailCliente,
      observaciones,
      dni:
        cleanHumanText(
          billing.dni ||
            billing.document ||
            billing.vat ||
            getMetaValue(metaData, [
              '_billing_dni',
              '_billing_document',
              'billing_dni',
              'billing_document',
              'billing_doc_number',
              'billing_vat',
              'dni',
              'documento',
            ]),
          40
        ) || '',
      fechaPedido: body.date_created || new Date().toISOString(),
      estado: mapWooStatusToPedidoEstado(status),
    };

    if (needsDirectFallback || itemsInternos.length === 0) {
      const fallback = await registrarPedidoFallback(payloadPedido);
      await persistPedidoExtras({
        pedidoId: fallback.pedidoId,
        nombreCliente: payloadPedido.nombreCliente,
        telefonoCliente: payloadPedido.telefonoCliente,
        emailCliente: payloadPedido.emailCliente,
        observaciones: payloadPedido.observaciones,
        direccionEnvio: payloadPedido.direccion,
        distrito: payloadPedido.distrito,
        provincia: payloadPedido.provincia,
      });
      await persistPedidoItemsIfMissing({
        pedidoId: fallback.pedidoId,
        empresaId: payloadPedido.empresaId,
        sucursalId: payloadPedido.sucursalId,
        itemsInternos,
      });
      return NextResponse.json(
        {
          ok: true,
          duplicado: fallback.duplicado,
          pedidoId: fallback.pedidoId,
          mode: 'fallback_unmapped_items',
          warnings: itemWarnings,
        },
        { status: 200 }
      );
    }

    try {
      const resultado = await procesarPedido({
        empresaId: payloadPedido.empresaId,
        sucursalId: payloadPedido.sucursalId,
        canalId: payloadPedido.canalId,
        idExterno: payloadPedido.idExterno,
        numeroPedido: payloadPedido.numeroPedido,
        total: payloadPedido.total,
        items: itemsInternos,
        usuarioSistemaId: null,
        id_orden: payloadPedido.idOrden,
        medio_pedido: 'web',
        cliente_id: null,
        metodo_pago: payloadPedido.metodoPago,
        direccion_cliente: payloadPedido.direccion,
        distrito_cliente: payloadPedido.distrito,
        provincia_cliente: payloadPedido.provincia,
        dni_cliente: payloadPedido.dni,
        fecha_pedido: payloadPedido.fechaPedido,
      });

      if (!resultado.success && !resultado.duplicado) {
        throw new Error(resultado.message || 'Error desconocido en procesarPedido');
      }

      if (resultado.pedidoId) {
        await persistPedidoExtras({
          pedidoId: resultado.pedidoId,
          nombreCliente: payloadPedido.nombreCliente,
          telefonoCliente: payloadPedido.telefonoCliente,
          emailCliente: payloadPedido.emailCliente,
          observaciones: payloadPedido.observaciones,
          direccionEnvio: payloadPedido.direccion,
          distrito: payloadPedido.distrito,
          provincia: payloadPedido.provincia,
        });
        await persistPedidoItemsIfMissing({
          pedidoId: resultado.pedidoId,
          empresaId: payloadPedido.empresaId,
          sucursalId: payloadPedido.sucursalId,
          itemsInternos,
        });
      }

      return NextResponse.json(
        {
          ok: true,
          duplicado: Boolean(resultado.duplicado),
          pedidoId: resultado.pedidoId || null,
          mode: 'full',
        },
        { status: 200 }
      );
    } catch (processingError: any) {
      console.error('[WC_WEBHOOK] procesarPedido fallo, activando fallback:', processingError?.message || processingError);

      const fallback = await registrarPedidoFallback(payloadPedido);
      await persistPedidoExtras({
        pedidoId: fallback.pedidoId,
        nombreCliente: payloadPedido.nombreCliente,
        telefonoCliente: payloadPedido.telefonoCliente,
        emailCliente: payloadPedido.emailCliente,
        observaciones: payloadPedido.observaciones,
        direccionEnvio: payloadPedido.direccion,
        distrito: payloadPedido.distrito,
        provincia: payloadPedido.provincia,
      });
      await persistPedidoItemsIfMissing({
        pedidoId: fallback.pedidoId,
        empresaId: payloadPedido.empresaId,
        sucursalId: payloadPedido.sucursalId,
        itemsInternos,
      });
      return NextResponse.json(
        {
          ok: true,
          duplicado: fallback.duplicado,
          pedidoId: fallback.pedidoId,
          mode: 'fallback',
        },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('[WC_WEBHOOK] Error critico:', error?.message || error);
    return NextResponse.json(
      {
        error: 'Error interno al procesar el webhook.',
        detail: error?.message || 'unknown_error',
      },
      { status: 500 }
    );
  }
}
