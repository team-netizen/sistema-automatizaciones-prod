import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { procesarPedido, PedidoItemSimple } from '@/services/procesarPedido';

const DEFAULT_ACCEPTED_STATUSES = ['processing', 'completed', 'on-hold', 'pending'];

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

  const { data, error } = await supabaseAdmin
    .from('pedidos')
    .insert({
      empresa_id: params.empresaId,
      sucursal_id: params.sucursalId,
      canal_id: params.canalId,
      numero: params.numeroPedido,
      total: params.total,
      estado: null,
      id_externo: params.idExterno,
      id_orden: params.idOrden,
      medio_pedido: 'web',
      id_cliente: null,
      metodo_pago: params.metodoPago,
      direccion_cliente: params.direccion,
      distrito_cliente: params.distrito,
      provincia_cliente: params.provincia,
      dni_cliente: params.dni,
      fecha_pedido: params.fechaPedido,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`fallback_insert_failed: ${error.message}`);
  }

  return { pedidoId: data.id, duplicado: false };
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = req.headers.get('x-empresa-id') || searchParams.get('empresa_id');
    const firmaHeader = req.headers.get('x-wc-webhook-signature');

    if (!empresaId || !firmaHeader) {
      return NextResponse.json(
        {
          error:
            'Credenciales faltantes. Usa query ?empresa_id=UUID y header x-wc-webhook-signature.',
        },
        { status: 401 }
      );
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .select('id, webhook_token, estado')
      .eq('id', empresaId)
      .single();

    if (empresaError || !empresa || !empresa.webhook_token) {
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

    const rawBody = await req.text();

    const firmaGenerada = crypto
      .createHmac('sha256', empresa.webhook_token)
      .update(rawBody)
      .digest('base64');

    const firmaValida =
      firmaHeader.length === firmaGenerada.length &&
      crypto.timingSafeEqual(Buffer.from(firmaHeader), Buffer.from(firmaGenerada));

    if (!firmaValida) {
      return NextResponse.json({ error: 'Firma de webhook invalida.' }, { status: 403 });
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
      // Responder 200 evita reintentos de Woo para eventos que decidimos ignorar.
      return NextResponse.json({ ok: true, skipped: true, statusRecibido: status }, { status: 200 });
    }

    const { data: sucursal } = await supabaseAdmin
      .from('sucursales')
      .select('id')
      .eq('empresa_id', empresaId)
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
        .eq('empresa_id', empresaId)
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
          .eq('empresa_id', empresaId)
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

    for (const item of body.line_items) {
      const sku = String(item?.sku || '').trim();
      const qty = Number(item?.quantity ?? 0);

      if (!sku) {
        return NextResponse.json(
          {
            error: `Linea sin SKU en WooCommerce (item id: ${item?.id ?? 'N/A'}).`,
          },
          { status: 400 }
        );
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json(
          {
            error: `Cantidad invalida para SKU ${sku}.`,
          },
          { status: 400 }
        );
      }

      const producto = await findProductoPorSku(empresaId, sku);

      if (!producto) {
        return NextResponse.json(
          {
            error: `Producto con SKU ${sku} no registrado en el sistema.`,
          },
          { status: 400 }
        );
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
      empresaId,
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
    };

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
