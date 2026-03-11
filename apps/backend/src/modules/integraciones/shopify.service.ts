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
    if (shopGuardado && shopGuardado !== shopNormalized) {
      throw new BadRequestException('El shop del callback no coincide con la configuracion guardada');
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

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
