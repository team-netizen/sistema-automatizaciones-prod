import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../shared/supabase/supabase.service';

type ShopifyCredenciales = {
  shop_url: string;
  api_key: string;
  api_secret: string;
};

type ShopifyCallbackQuery = Record<string, string | undefined>;
type ShopifyRequestVerificationQuery = Record<string, string | undefined>;

type ShopifyIntegracionPayload = {
  empresa_id: string;
  canal_id: string;
  tipo_integracion: 'shopify';
  credenciales: Record<string, unknown>;
  activa: boolean;
  webhook_url: string;
  intervalo_sync_minutos: number;
};

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private static readonly SHOP_DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.myshopify\.com$/;
  private static readonly OAUTH_STATE_MAX_AGE_MS = 15 * 60 * 1000;

  constructor(private readonly supabase: SupabaseService) {}

  async getAuthUrl(empresaId: string, credenciales: ShopifyCredenciales) {
    const shop = this.normalizarShopUrl(credenciales?.shop_url);
    const apiKey = String(credenciales?.api_key ?? '').trim();
    const apiSecret = String(credenciales?.api_secret ?? '').trim();
    const backendUrl = this.obtenerBackendUrl();

    if (!shop || !apiKey || !apiSecret) {
      throw new BadRequestException('shop_url, api_key y api_secret son obligatorios');
    }

    const webhookUrl = `${backendUrl}/api/integraciones/shopify/webhook/${empresaId}`;
    const redirectUri = `${backendUrl}/api/integraciones/shopify/callback`;
    const canalId = await this.resolverCanalId(empresaId);
    const oauthState = this.generarOauthState(empresaId);

    const payload: ShopifyIntegracionPayload = {
      empresa_id: empresaId,
      canal_id: canalId,
      tipo_integracion: 'shopify',
      credenciales: {
        shop_url: shop,
        api_key: apiKey,
        api_secret: apiSecret,
        redirect_uri: redirectUri,
        oauth_state: oauthState,
        oauth_state_fecha: new Date().toISOString(),
        estado: 'pendiente',
      },
      activa: false,
      webhook_url: webhookUrl,
      intervalo_sync_minutos: 15,
    };

    await this.guardarIntegracion(payload);

    const scopes = [
      'read_products',
      'write_products',
      'read_orders',
      'write_orders',
      'read_inventory',
      'write_inventory',
      'read_locations',
    ].join(',');
    const authUrl = `https://${shop}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(apiKey)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(oauthState)}`;

    return {
      success: true,
      webhook_url: webhookUrl,
      auth_url: authUrl,
      mensaje: 'Credenciales guardadas. Autoriza la app en Shopify.',
    };
  }

  async guardarCredenciales(empresaId: string, credenciales: ShopifyCredenciales) {
    return this.getAuthUrl(empresaId, credenciales);
  }

  async handleCallback(
    code: string,
    shop: string,
    state: string,
    hmac: string,
    query: ShopifyCallbackQuery,
  ) {
    const oauthCode = String(code ?? '').trim();
    const shopNormalized = this.normalizarShopUrl(shop);
    const oauthState = String(state ?? '').trim();
    const empresa = this.obtenerEmpresaDesdeState(oauthState);
    const oauthHmac = String(hmac ?? '').trim();

    if (!oauthCode || !shopNormalized || !empresa || !oauthState || !oauthHmac) {
      throw new BadRequestException('code, shop, state y hmac son obligatorios');
    }

    const { data: integracion, error: integracionError } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('id, credenciales')
      .eq('empresa_id', empresa)
      .eq('tipo_integracion', 'shopify')
      .maybeSingle();

    if (integracionError || !integracion?.id) {
      throw new BadRequestException('Integracion Shopify no encontrada para esta empresa');
    }

    const credenciales = (integracion.credenciales ?? {}) as Record<string, unknown>;
    const apiKey = this.readString(credenciales.api_key);
    const apiSecret = this.readString(credenciales.api_secret);
    const shopGuardado = this.normalizarShopUrl(this.readString(credenciales.shop_url) ?? '');
    const stateGuardado = this.readString(credenciales.oauth_state);
    const stateFechaGuardado = this.readDate(credenciales.oauth_state_fecha);

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('Faltan api_key/api_secret en credenciales de Shopify');
    }
    if (!stateGuardado || !this.safeEqual(stateGuardado, oauthState)) {
      throw new BadRequestException('State invalido o expirado');
    }
    if (!stateFechaGuardado || this.isExpiredState(stateFechaGuardado)) {
      throw new BadRequestException('State invalido o expirado');
    }
    if (!this.verifyHmac(query, apiSecret, oauthHmac)) {
      throw new BadRequestException('HMAC invalido');
    }

    const tokenRes = await fetch(`https://${shopNormalized}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code: oauthCode,
      }),
    });

    const raw = await tokenRes.text();
    let tokenData: Record<string, unknown> = {};
    try {
      tokenData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      tokenData = {};
    }

    const accessToken = this.readString(tokenData.access_token);
    if (!tokenRes.ok || !accessToken) {
      this.logger.error(
        `[Shopify callback] Error obteniendo token: status=${tokenRes.status} has_access_token=${Boolean(accessToken)} response_length=${raw.length}`,
      );
      throw new BadRequestException('No se pudo obtener access_token de Shopify');
    }

    const nuevasCredenciales = {
      ...credenciales,
      shop_url: shopNormalized,
      access_token: accessToken,
      scope: this.readString(tokenData.scope),
      estado: 'conectado',
      oauth_code: oauthCode,
      oauth_code_fecha: new Date().toISOString(),
      oauth_state: null,
      oauth_state_fecha: null,
    };

    const { error: updateError } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .update({
        credenciales: nuevasCredenciales,
        activa: true,
        ultima_sincronizacion: new Date().toISOString(),
      })
      .eq('id', integracion.id);

    if (updateError) {
      throw new InternalServerErrorException(
        `No se pudo guardar access_token de Shopify: ${updateError.message}`,
      );
    }

    this.logger.log(`[Shopify] Token guardado para empresa ${empresa} OK`);
    return { success: true };
  }

  async getEstado(empresaId: string): Promise<{ conectado: boolean; shop_url?: string }> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('credenciales, activa')
      .eq('empresa_id', empresaId)
      .eq('tipo_integracion', 'shopify')
      .maybeSingle();

    if (error || !data || !data.activa) {
      return { conectado: false };
    }

    const credenciales = (data.credenciales ?? {}) as Record<string, unknown>;
    return {
      conectado: true,
      shop_url: this.readString(credenciales.shop_url) ?? undefined,
    };
  }

  validateSignedRequest(query: ShopifyRequestVerificationQuery, secret: string): boolean {
    const hmac = this.readString(query.hmac);
    if (!secret || !hmac) return false;
    return this.verifyHmac(query, secret, hmac);
  }

  private normalizarShopUrl(raw: unknown): string {
    const normalized = String(raw ?? '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase();

    if (!normalized || !ShopifyService.SHOP_DOMAIN_REGEX.test(normalized)) {
      throw new BadRequestException('shop_url invalido. Usa el dominio *.myshopify.com');
    }

    return normalized;
  }

  private obtenerBackendUrl(): string {
    const backendUrl = String(process.env.BACKEND_URL ?? '').trim().replace(/\/+$/, '');
    if (!backendUrl) {
      throw new InternalServerErrorException(
        'BACKEND_URL no esta configurado. Define BACKEND_URL para OAuth Shopify.',
      );
    }
    return backendUrl;
  }

  private async resolverCanalId(empresaId: string): Promise<string> {
    const nombreCanal = 'Shopify';
    const { data: canal, error: canalError } = await this.supabase
      .getAdminClient()
      .from('canales_venta')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('nombre', nombreCanal)
      .maybeSingle();

    if (canalError && canalError.code !== 'PGRST116') {
      throw new InternalServerErrorException(`No se pudo consultar canal Shopify: ${canalError.message}`);
    }

    const canalId = this.readId(canal);
    if (canalId) return canalId;

    const { data: nuevoCanal, error: insertError } = await this.supabase
      .getAdminClient()
      .from('canales_venta')
      .insert({ empresa_id: empresaId, nombre: nombreCanal })
      .select('id')
      .single();

    if (insertError) {
      throw new InternalServerErrorException(`No se pudo crear canal Shopify: ${insertError.message}`);
    }

    const nuevoCanalId = this.readId(nuevoCanal);
    if (!nuevoCanalId) {
      throw new InternalServerErrorException('No se pudo obtener canal_id de Shopify');
    }

    return nuevoCanalId;
  }

  private async guardarIntegracion(payload: ShopifyIntegracionPayload): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .upsert(payload, { onConflict: 'empresa_id,tipo_integracion' });

    if (!error) return;

    const { data: existente, error: existenteError } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('id')
      .eq('empresa_id', payload.empresa_id)
      .eq('tipo_integracion', 'shopify')
      .maybeSingle();

    if (existenteError && existenteError.code !== 'PGRST116') {
      throw new InternalServerErrorException(`No se pudo consultar integracion Shopify: ${existenteError.message}`);
    }

    const existenteId = this.readId(existente);
    if (!existenteId) {
      throw new InternalServerErrorException(`No se pudieron guardar credenciales Shopify: ${error.message}`);
    }

    const { error: updateError } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .update({
        canal_id: payload.canal_id,
        credenciales: payload.credenciales,
        activa: payload.activa,
        webhook_url: payload.webhook_url,
        intervalo_sync_minutos: payload.intervalo_sync_minutos,
      })
      .eq('id', existenteId);

    if (updateError) {
      throw new InternalServerErrorException(`No se pudieron guardar credenciales Shopify: ${updateError.message}`);
    }
  }

  private generarOauthState(empresaId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    return `${empresaId}:${nonce}`;
  }

  private obtenerEmpresaDesdeState(state: string): string {
    const [empresaId] = String(state ?? '').split(':');
    const empresa = String(empresaId ?? '').trim();
    if (!empresa) {
      throw new BadRequestException('State invalido');
    }
    return empresa;
  }

  private verifyHmac(query: ShopifyCallbackQuery, secret: string, hmac: string): boolean {
    const params = Object.keys(query)
      .filter((key) => key !== 'hmac' && key !== 'signature')
      .sort()
      .map((key) => `${key}=${query[key] ?? ''}`)
      .join('&');

    const digest = crypto.createHmac('sha256', secret).update(params, 'utf8').digest('hex');
    return this.safeEqual(digest, hmac);
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private isExpiredState(stateDate: Date): boolean {
    return Date.now() - stateDate.getTime() > ShopifyService.OAUTH_STATE_MAX_AGE_MS;
  }

  private readDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private readId(row: unknown): string | null {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const value = (row as Record<string, unknown>).id;
    return this.readString(value);
  }

  async syncManual(empresaId: string): Promise<{
    success: boolean;
    productos_actualizados: number;
    productos_sin_match: number;
    mensaje: string;
  }> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('credenciales')
      .eq('empresa_id', empresaId)
      .eq('tipo_integracion', 'shopify')
      .eq('activa', true)
      .maybeSingle();

    if (error || !data) {
      throw new BadRequestException('Shopify no esta conectado para esta empresa');
    }

    const credenciales = (data.credenciales ?? {}) as Record<string, unknown>;
    const accessToken = this.readString(credenciales.access_token);
    const shopUrl = this.readString(credenciales.shop_url);

    if (!accessToken || !shopUrl) {
      throw new BadRequestException('Faltan credenciales de Shopify. Reconecta la integracion.');
    }

    const shopifyProductosPorSku = await this.obtenerProductosShopifyPorSku(shopUrl, accessToken);
    const stockPorSku = await this.obtenerStockConsolidadoSisAutoPorSku(empresaId);
    const locationId = await this.obtenerLocationId(shopUrl, accessToken);

    let actualizados = 0;
    let sinMatch = 0;

    for (const [skuNormalizado, cantidadSisAuto] of stockPorSku.entries()) {
      const shopifyVariante = shopifyProductosPorSku.get(skuNormalizado);
      if (!shopifyVariante) {
        sinMatch += 1;
        continue;
      }

      let updated = false;

      if (locationId) {
        updated = await this.actualizarInventarioShopify(
          shopUrl,
          accessToken,
          shopifyVariante.inventory_item_id,
          locationId,
          cantidadSisAuto,
        );
      } else {
        updated = await this.actualizarStockVariante(
          shopUrl,
          accessToken,
          shopifyVariante.variant_id,
          cantidadSisAuto,
        );
      }

      if (updated) {
        actualizados += 1;
      }
    }

    await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .eq('tipo_integracion', 'shopify');

    this.logger.log(
      `[Shopify sync] empresa=${empresaId} actualizados=${actualizados} sin_match=${sinMatch}`,
    );

    return {
      success: true,
      productos_actualizados: actualizados,
      productos_sin_match: sinMatch,
      mensaje: `Sync completado: ${actualizados} productos actualizados en Shopify, ${sinMatch} sin match por SKU`,
    };
  }

  async descontarStockPorPedido(
    empresaId: string,
    lineItems: Array<{ sku?: string; quantity?: number; title?: string }>,
    orderId?: string,
  ): Promise<void> {
    if (!lineItems?.length) return;

    if (orderId) {
      const { data: existente } = await this.supabase
        .getAdminClient()
        .from('movimientos_stock')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('referencia_tipo', 'shopify_order')
        .eq('referencia_id', orderId)
        .limit(1)
        .maybeSingle();

      if (existente) {
        this.logger.log(`[Shopify webhook] Pedido ya procesado order_id=${orderId}`);
        return;
      }
    }

    const sucursalId = await this.obtenerSucursalPrincipalActiva(empresaId);
    if (!sucursalId) {
      this.logger.warn(`[Shopify webhook] No se encontro sucursal activa para empresa ${empresaId}`);
      return;
    }

    for (const item of lineItems) {
      const skuOriginal = this.readString(item?.sku) ?? '';
      const skuNormalizado = this.normalizarSku(skuOriginal);
      const cantidad = Math.max(0, Math.trunc(Number(item?.quantity || 0)));

      if (!skuNormalizado || cantidad <= 0) continue;

      const producto = await this.buscarProductoInternoPorSku(empresaId, skuOriginal);
      if (!producto) {
        this.logger.warn(`[Shopify webhook] SKU no encontrado en SisAuto: ${skuOriginal}`);
        continue;
      }

      const stockActual = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .select('id, cantidad')
        .eq('empresa_id', empresaId)
        .eq('producto_id', producto.id)
        .eq('sucursal_id', sucursalId)
        .maybeSingle();

      if (stockActual.error || !stockActual.data) {
        this.logger.warn(`[Shopify webhook] Stock no encontrado para SKU=${skuOriginal} sucursal=${sucursalId}`);
        continue;
      }

      const row = stockActual.data as Record<string, unknown>;
      const stockId = this.readString(row.id);
      const cantidadActual = this.readNumber(row.cantidad);
      if (!stockId) {
        this.logger.warn(`[Shopify webhook] Registro de stock sin id para SKU=${skuOriginal}`);
        continue;
      }

      const nuevaCantidad = Math.max(0, cantidadActual - cantidad);

      const { error: updateError } = await this.supabase
        .getAdminClient()
        .from('stock_por_sucursal')
        .update({
          cantidad: nuevaCantidad,
          ultima_actualizacion: new Date().toISOString(),
        })
        .eq('id', stockId)
        .eq('empresa_id', empresaId);

      if (updateError) {
        throw new InternalServerErrorException(`Error descontando stock Shopify: ${updateError.message}`);
      }

      const { error: movimientoError } = await this.supabase
        .getAdminClient()
        .from('movimientos_stock')
        .insert({
          empresa_id: empresaId,
          producto_id: producto.id,
          sucursal_id: sucursalId,
          tipo: 'salida',
          cantidad: -cantidad,
          motivo: `Venta Shopify (SKU: ${producto.sku})`,
          referencia_tipo: 'shopify_order',
          referencia_id: orderId ?? null,
          creado_por: null,
          fecha_creacion: new Date().toISOString(),
        });

      if (movimientoError) {
        throw new InternalServerErrorException(`Error registrando movimiento Shopify: ${movimientoError.message}`);
      }

      this.logger.log(
        `[Shopify webhook] Stock descontado SKU=${producto.sku} cantidad=${cantidad} sucursal=${sucursalId}`,
      );
    }
  }

  private async obtenerProductosShopifyPorSku(
    shopUrl: string,
    accessToken: string,
  ): Promise<Map<string, { inventory_item_id: string; variant_id: string }>> {
    const resultado = new Map<string, { inventory_item_id: string; variant_id: string }>();
    let pageInfo: string | null = null;
    let pagina = 0;

    do {
      pagina += 1;
      const url: string = pageInfo
        ? `https://${shopUrl}/admin/api/2024-01/products.json?limit=250&fields=id,variants&page_info=${pageInfo}`
        : `https://${shopUrl}/admin/api/2024-01/products.json?limit=250&fields=id,variants`;

      const res: Response = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      if (!res.ok) {
        throw new BadRequestException(`Error obteniendo productos de Shopify: ${res.status}`);
      }

      const json = await res.json() as { products: Array<Record<string, unknown>> };
      for (const producto of json.products || []) {
        const variants = Array.isArray(producto.variants) ? producto.variants as Array<Record<string, unknown>> : [];
        for (const variante of variants) {
          const skuOriginal = this.readString(variante.sku);
          const sku = this.normalizarSku(skuOriginal);
          const inventoryItemId = this.readString(variante.inventory_item_id);
          const variantId = this.readString(variante.id);
          if (!sku || !inventoryItemId || !variantId) continue;
          resultado.set(sku, {
            inventory_item_id: inventoryItemId,
            variant_id: variantId,
          });
        }
      }

      const linkHeader: string = res.headers.get('Link') || '';
      const nextMatch: RegExpMatchArray | null = linkHeader.match(/<[^>]*page_info=([^>&"]+)[^>]*>;\s*rel="next"/);
      pageInfo = nextMatch ? nextMatch[1] : null;
    } while (pageInfo && pagina < 20);

    return resultado;
  }

  private async obtenerLocationId(shopUrl: string, accessToken: string): Promise<string | null> {
    try {
      const res: Response = await fetch(`https://${shopUrl}/admin/api/2024-01/locations.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      if (!res.ok) {
        this.logger.warn(`[Shopify] No se pudo obtener locations (status=${res.status}). Se usara fallback por variante.`);
        return null;
      }

      const json = await res.json() as { locations: Array<Record<string, unknown>> };
      const locations = (json.locations || []).filter((location) => location.active !== false);
      if (locations.length === 0) {
        this.logger.warn('[Shopify] No hay locations activas. Se usara fallback por variante.');
        return null;
      }

      const locationId = this.readString(locations[0].id);
      if (!locationId) {
        this.logger.warn('[Shopify] Location invalida. Se usara fallback por variante.');
        return null;
      }

      return locationId;
    } catch {
      this.logger.warn('[Shopify] Error obteniendo locations. Se usara fallback por variante.');
      return null;
    }
  }

  private async actualizarInventarioShopify(
    shopUrl: string,
    accessToken: string,
    inventoryItemId: string,
    locationId: string,
    cantidad: number,
  ): Promise<boolean> {
    const res: Response = await fetch(
      `https://${shopUrl}/admin/api/2024-01/inventory_levels/set.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location_id: Number(locationId),
          inventory_item_id: Number(inventoryItemId),
          available: Math.max(0, Math.round(cantidad)),
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `[Shopify] Error actualizando inventory_item=${inventoryItemId}: ${res.status} ${text}`,
      );
      return false;
    }

    return true;
  }

  private async actualizarStockVariante(
    shopUrl: string,
    accessToken: string,
    variantId: string,
    cantidad: number,
  ): Promise<boolean> {
    const res: Response = await fetch(
      `https://${shopUrl}/admin/api/2024-01/variants/${variantId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant: {
            id: Number(variantId),
            inventory_quantity: Math.max(0, Math.round(cantidad)),
            inventory_management: 'shopify',
          },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `[Shopify] Error actualizando variante=${variantId}: ${res.status} ${text}`,
      );
      return false;
    }

    return true;
  }

  private async obtenerStockConsolidadoSisAutoPorSku(empresaId: string): Promise<Map<string, number>> {
    const productos = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku')
      .eq('empresa_id', empresaId)
      .not('sku', 'is', null);

    if (productos.error) {
      throw new InternalServerErrorException(`Error obteniendo productos por SKU: ${productos.error.message}`);
    }

    const skuByProducto = new Map<string, string>();
    for (const row of (productos.data ?? []) as Array<Record<string, unknown>>) {
      const id = this.readString(row.id);
      const skuOriginal = this.readString(row.sku);
      const sku = this.normalizarSku(skuOriginal);
      if (!id || !sku) continue;
      skuByProducto.set(id, sku);
    }

    const productoIds = Array.from(skuByProducto.keys());
    const out = new Map<string, number>();
    if (productoIds.length === 0) return out;

    const stock = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('producto_id, cantidad')
      .eq('empresa_id', empresaId)
      .in('producto_id', productoIds);

    if (stock.error) {
      throw new InternalServerErrorException(`Error obteniendo stock de SisAuto: ${stock.error.message}`);
    }

    for (const row of (stock.data ?? []) as Array<Record<string, unknown>>) {
      const productoId = this.readString(row.producto_id);
      if (!productoId) continue;
      const sku = skuByProducto.get(productoId);
      if (!sku) continue;
      out.set(sku, (out.get(sku) ?? 0) + this.readNumber(row.cantidad));
    }

    return out;
  }

  private async obtenerSucursalPrincipalActiva(empresaId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('sucursales')
      .select('id, activa')
      .eq('empresa_id', empresaId)
      .order('fecha_creacion', { ascending: true });

    if (error) {
      this.logger.warn(`[Shopify webhook] Error obteniendo sucursales: ${error.message}`);
      return null;
    }

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const id = this.readString(row.id);
      const activa = row.activa;
      if (!id) continue;
      if (activa === false) continue;
      return id;
    }

    return null;
  }

  private async buscarProductoInternoPorSku(empresaId: string, sku: string): Promise<{ id: string; sku: string } | null> {
    const clean = sku.trim();
    if (!clean) return null;

    const exact = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku')
      .eq('empresa_id', empresaId)
      .eq('sku', clean)
      .maybeSingle();

    if (!exact.error && exact.data) {
      const row = exact.data as Record<string, unknown>;
      const id = this.readString(row.id);
      const skuFound = this.readString(row.sku);
      if (id && skuFound) return { id, sku: skuFound };
    }

    const ci = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku')
      .eq('empresa_id', empresaId)
      .ilike('sku', clean)
      .limit(1)
      .maybeSingle();

    if (ci.error || !ci.data) return null;

    const row = ci.data as Record<string, unknown>;
    const id = this.readString(row.id);
    const skuFound = this.readString(row.sku);
    return id && skuFound ? { id, sku: skuFound } : null;
  }

  private normalizarSku(value: unknown): string | null {
    const sku = this.readString(value);
    return sku ? sku.toLowerCase() : null;
  }

  private readNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}



