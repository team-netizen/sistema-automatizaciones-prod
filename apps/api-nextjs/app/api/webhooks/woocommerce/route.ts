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

async function registrarPedidoFallback(params: {
  empresaId: string;
  sucursalId: string;
  canalId: string;
  idExterno: string;
  numeroPedido: string;
  total: number;
  idOrden: string;
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
      id_cliente: null,
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

    const body = JSON.parse(rawBody);

    if (!body?.id || !Array.isArray(body?.line_items)) {
      return NextResponse.json(
        { error: 'Payload invalido. Se requiere id y line_items.' },
        { status: 400 }
      );
    }

    const acceptedStatuses = getAcceptedStatuses();
    const status = String(body.status || '').toLowerCase();

    if (!acceptedStatuses.includes(status)) {
      return NextResponse.json({ ok: true, skipped: true, statusRecibido: status }, { status: 200 });
    }

    const { data: sucursal } = await supabaseAdmin
      .from('sucursales')
      .select('id')
      .eq('empresa_id', empresa.id)
      .eq('activa', true)
      .limit(1)
      .maybeSingle();

    if (!sucursal) {
      return NextResponse.json(
        { error: 'No se encontro una sucursal activa para la empresa.' },
        { status: 500 }
      );
    }

    let canal = (
      await supabaseAdmin
        .from('canales_venta')
        .select('id')
        .eq('empresa_id', empresa.id)
        .eq('activo', true)
        .ilike('nombre', '%woo%')
        .limit(1)
        .maybeSingle()
    ).data;

    if (!canal) {
      canal = (
        await supabaseAdmin
          .from('canales_venta')
          .select('id')
          .eq('empresa_id', empresa.id)
          .eq('activo', true)
          .limit(1)
          .maybeSingle()
      ).data;
    }

    if (!canal) {
      return NextResponse.json(
        { error: 'No se encontro un canal de venta activo para la empresa.' },
        { status: 500 }
      );
    }

    const itemsInternos: PedidoItemSimple[] = [];
    const itemWarnings: string[] = [];
    let needsDirectFallback = false;

    for (const item of body.line_items) {
      const sku = String(item?.sku || '').trim();
      const nombreProducto = String(item?.name || '').trim();
      const qty = Number(item?.quantity ?? 0);

      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          {
            error: `Cantidad invalida para SKU ${sku}.`,
          },
          { status: 400 }
        );
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

    const payloadPedido = {
      empresaId: empresa.id,
      sucursalId: sucursal.id,
      canalId: canal.id,
      idExterno: String(body.id),
      numeroPedido: String(body.number || body.id),
      total: Number(body.total) || 0,
      idOrden: String(body.number || body.id),
      metodoPago: body.payment_method_title || 'WooCommerce',
      direccion: shipping.address_1 || billing.address_1 || '',
      distrito: shipping.city || billing.city || '',
      provincia: shipping.state || billing.state || '',
      dni:
        body.meta_data?.find((m: any) => m?.key === '_billing_dni')?.value ||
        body.meta_data?.find((m: any) => m?.key === '_billing_document')?.value ||
        '',
      fechaPedido: body.date_created || new Date().toISOString(),
      estado: mapWooStatusToPedidoEstado(status),
    };

    if (needsDirectFallback || itemsInternos.length === 0) {
      const fallback = await registrarPedidoFallback(payloadPedido);
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
