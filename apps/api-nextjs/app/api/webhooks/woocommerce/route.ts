import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { procesarPedido, PedidoItemSimple } from "@/services/procesarPedido";

/**
 * ═══════════════════════════════════════════════════════════
 * POST /api/webhooks/woocommerce
 * ═══════════════════════════════════════════════════════════
 * Recibe webhooks de pedidos desde WooCommerce.
 * Valida la autenticidad mediante HMAC SHA256.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Obtener credenciales y firma desde Headers o Query Params
    const { searchParams } = new URL(req.url);
    const empresaId = req.headers.get("x-empresa-id") || searchParams.get("empresa_id");
    const firmaHeader = req.headers.get("x-wc-webhook-signature");

    if (!empresaId || !firmaHeader) {
      return NextResponse.json(
        {
          error:
            "Credenciales de seguridad faltantes (headers x-empresa-id o x-wc-webhook-signature).",
        },
        { status: 401 },
      );
    }

    // 2. Validar Empresa y obtener su secreto (webhook_token)
    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("id, webhook_token, estado")
      .eq("id", empresaId)
      .single();

    if (empresaError || !empresa || !empresa.webhook_token) {
      return NextResponse.json(
        { error: "Configuración de empresa no encontrada o incompleta." },
        { status: 403 },
      );
    }

    if (empresa.estado !== "activa" && empresa.estado !== "prueba") {
      return NextResponse.json(
        { error: "La empresa no se encuentra en un estado activo." },
        { status: 403 },
      );
    }

    // 3. Leer body como texto crudo para validación HMAC
    const rawBody = await req.text();

    // 4. Validar Firma HMAC SHA256
    const firmaGenerada = crypto
      .createHmac("sha256", empresa.webhook_token)
      .update(rawBody)
      .digest("base64");

    // Comparación segura contra ataques de tiempo (Timing Attacks)
    const firmaValida =
      firmaHeader.length === firmaGenerada.length &&
      crypto.timingSafeEqual(
        Buffer.from(firmaHeader),
        Buffer.from(firmaGenerada),
      );

    if (!firmaValida) {
      console.error(`[WC_SEC] Firma HMAC inválida para empresa ${empresaId}.`);
      return NextResponse.json(
        { error: "Firma de webhook inválida. Acceso denegado." },
        { status: 403 },
      );
    }

    // 5. Parsear Body a JSON después de validar la firma
    const body = JSON.parse(rawBody);

    // 4. Validaciones críticas de WooCommerce
    const statusesValidos = ["processing", "completed"];
    if (
      !body.id ||
      !body.line_items ||
      !Array.isArray(body.line_items) ||
      !statusesValidos.includes(body.status)
    ) {
      return NextResponse.json(
        {
          error: "Payload inválido o estado de pedido no procesable.",
          statusRecibido: body.status,
        },
        { status: 400 },
      );
    }

    // 5. Obtener sucursal y canal por defecto para la empresa validada
    const [{ data: sucursal }, { data: canal }] = await Promise.all([
      supabaseAdmin
        .from("sucursales")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("activa", true)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("canales_venta")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!sucursal) {
      return NextResponse.json(
        { error: "No se encontró una sucursal activa para la empresa." },
        { status: 500 },
      );
    }
    if (!canal) {
      return NextResponse.json(
        { error: "No se encontró un canal de venta activo para la empresa." },
        { status: 500 },
      );
    }

    // 6. Mapear Items (Búsqueda de productoId por SKU)
    const itemsInternos: PedidoItemSimple[] = [];
    for (const item of body.line_items) {
      const { data: producto } = await supabaseAdmin
        .from("productos")
        .select("id, precio")
        .eq("empresa_id", empresaId)
        .eq("sku", item.sku)
        .maybeSingle();

      if (!producto) {
        console.warn(
          `[WC_WEBHOOK] Producto no encontrado para SKU: ${item.sku} en empresa ${empresaId}`,
        );
        return NextResponse.json(
          {
            error: `Producto con SKU ${item.sku} no registrado en el sistema.`,
          },
          { status: 400 },
        );
      }

      itemsInternos.push({
        productoId: producto.id,
        sku_producto: item.sku || "",
        cantidad: item.quantity,
        precioUnitario: Number(item.price) || Number(producto.precio),
      });
    }

    // 7. Preparar datos adicionales del cliente y pedido
    const billing = body.billing || {};
    const shipping = body.shipping || {};

    // 8. Ejecutar el servicio de procesamiento de pedido
    const resultado = await procesarPedido({
      empresaId,
      sucursalId: sucursal.id,
      canalId: canal.id,
      idExterno: body.id.toString(),
      numeroPedido: body.number?.toString() || body.id.toString(),
      total: Number(body.total) || 0,
      items: itemsInternos,
      usuarioSistemaId: null,

      // Nuevos campos
      id_orden: body.number || body.id.toString(),
      medio_pedido: "web",
      metodo_pago: body.payment_method_title || "Unknown",
      direccion_cliente: shipping.address_1 || billing.address_1 || "",
      distrito_cliente: shipping.city || billing.city || "",
      provincia_cliente: shipping.state || billing.state || "",
      dni_cliente: body.meta_data?.find((m: any) => m.key === "_billing_dni")?.value || "",
      fecha_pedido: body.date_created || new Date().toISOString(),
    });

    if (!resultado.success && !resultado.duplicado) {
      throw new Error(
        resultado.message || "Error desconocido en procesarPedido",
      );
    }

    // 8. Respuesta exitosa
    return NextResponse.json(
      { ok: true, detail: resultado.message },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[WC_WEBHOOK] Error crítico:", error.message);
    return NextResponse.json(
      { error: "Error interno al procesar el webhook.", detail: error.message },
      { status: 500 },
    );
  }
}
