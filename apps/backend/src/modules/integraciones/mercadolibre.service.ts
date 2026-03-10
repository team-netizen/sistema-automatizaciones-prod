import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

type IntegracionMl = {
  id: string;
  credenciales: Record<string, unknown>;
};

type ProductoMl = {
  id: string;
  sku: string;
  nombre: string;
};

type PublicacionMl = Record<string, unknown>;

@Injectable()
export class MercadoLibreService {
  private readonly logger = new Logger(MercadoLibreService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async syncManual(empresaId: string) {
    this.logger.log(`[ML] Iniciando sync manual empresa=${empresaId}`);

    const integracion = await this.obtenerIntegracionActiva(empresaId);
    const credenciales = await this.asegurarAccessToken(integracion);
    const accessToken = this.readString(credenciales.access_token);

    if (!accessToken) {
      this.logger.warn(`[ML] No hay access token configurado para empresa ${empresaId}`);
      return { success: false, mensaje: 'No hay token de Mercado Libre configurado' };
    }

    const productos = await this.obtenerProductosActivos(empresaId);
    if (productos.length === 0) {
      await this.actualizarUltimaSync(integracion.id);
      this.logger.log(`[ML] No hay productos activos con SKU en empresa ${empresaId}`);
      return { success: true, actualizados: 0, omitidos: 0, errores: 0 };
    }

    const stockPorProducto = await this.obtenerStockTotalPorProducto(
      empresaId,
      productos.map((p) => p.id),
    );

    const accessTokenVigente = await this.asegurarTokenVigente(
      integracion.id,
      credenciales,
      accessToken,
    );

    const userId = await this.getMLUserId(accessTokenVigente);
    if (!userId) {
      this.logger.warn(`[ML] No se pudo obtener user id para empresa ${empresaId}`);
      return { success: false, mensaje: 'No se pudo obtener usuario de Mercado Libre' };
    }

    const publicaciones = await this.getPublicacionesML(userId, accessTokenVigente);
    const productosPorSku = new Map<string, ProductoMl>();
    for (const producto of productos) {
      productosPorSku.set(producto.sku.toLowerCase(), producto);
    }

    let actualizados = 0;
    let omitidos = 0;
    let errores = 0;

    for (const publicacion of publicaciones) {
      const itemId = this.readString(publicacion.id);
      const skuPublicacion = this.resolverSellerSku(publicacion);
      if (!itemId || !skuPublicacion) {
        omitidos += 1;
        continue;
      }

      const producto = productosPorSku.get(skuPublicacion.toLowerCase());
      if (!producto) {
        omitidos += 1;
        continue;
      }

      const nuevoStock = stockPorProducto.get(producto.id) ?? 0;
      const ok = await this.actualizarStockML(itemId, nuevoStock, accessTokenVigente);
      if (ok) {
        actualizados += 1;
      } else {
        errores += 1;
      }
    }

    await this.actualizarUltimaSync(integracion.id);
    this.logger.log(
      `[ML] Sync manual completado empresa=${empresaId} actualizados=${actualizados} omitidos=${omitidos} errores=${errores}`,
    );

    return {
      success: errores === 0,
      actualizados,
      omitidos,
      errores,
      total_publicaciones: publicaciones.length,
      total_productos: productos.length,
    };
  }

  private async obtenerIntegracionActiva(empresaId: string): Promise<IntegracionMl> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('id, activa, credenciales')
      .eq('empresa_id', empresaId)
      .eq('tipo_integracion', 'mercadolibre')
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        `Error consultando integracion de Mercado Libre: ${error.message}`,
      );
    }

    if (!data?.id || !data.activa) {
      throw new BadRequestException('Mercado Libre no esta conectado para esta empresa');
    }

    const credenciales = this.toRecord(data.credenciales) ?? {};
    return {
      id: String(data.id),
      credenciales,
    };
  }

  private async asegurarAccessToken(integracion: IntegracionMl): Promise<Record<string, unknown>> {
    const accessToken = this.readString(integracion.credenciales.access_token);
    if (accessToken) {
      return integracion.credenciales;
    }

    const appId = this.readString(integracion.credenciales.app_id);
    const clientSecret = this.readString(integracion.credenciales.client_secret);
    const redirectUri = this.readString(integracion.credenciales.redirect_uri);
    const oauthCode = this.readString(integracion.credenciales.oauth_code);

    if (!appId || !clientSecret || !redirectUri || !oauthCode) {
      return integracion.credenciales;
    }

    try {
      const response = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: appId,
          client_secret: clientSecret,
          code: oauthCode,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        this.logger.warn(
          `[ML] No se pudo canjear oauth_code en integracion ${integracion.id}: ${response.status} ${raw}`,
        );
        return integracion.credenciales;
      }

      const tokenData = (await response.json()) as Record<string, unknown>;
      const nuevasCredenciales = {
        ...integracion.credenciales,
        access_token: this.readString(tokenData.access_token),
        refresh_token: this.readString(tokenData.refresh_token),
        token_type: this.readString(tokenData.token_type) ?? 'Bearer',
        expires_in: this.toNumber(tokenData.expires_in) ?? null,
        token_obtenido_en: new Date().toISOString(),
      };

      await this.actualizarCredenciales(integracion.id, nuevasCredenciales);
      return nuevasCredenciales;
    } catch (error) {
      this.logger.warn(
        `[ML] Error canjeando oauth_code integracion=${integracion.id}: ${this.toErrorMessage(error)}`,
      );
      return integracion.credenciales;
    }
  }

  private async asegurarTokenVigente(
    integracionId: string,
    credenciales: Record<string, unknown>,
    accessToken: string,
  ): Promise<string> {
    try {
      const probe = await fetch('https://api.mercadolibre.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (probe.ok) {
        return accessToken;
      }

      if (probe.status !== 401) {
        return accessToken;
      }
    } catch {
      return accessToken;
    }

    const refreshToken = this.readString(credenciales.refresh_token);
    const appId = this.readString(credenciales.app_id);
    const clientSecret = this.readString(credenciales.client_secret);
    if (!refreshToken || !appId || !clientSecret) {
      return accessToken;
    }

    try {
      const response = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: appId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        this.logger.warn(
          `[ML] No se pudo refrescar token integracion=${integracionId}: ${response.status} ${raw}`,
        );
        return accessToken;
      }

      const tokenData = (await response.json()) as Record<string, unknown>;
      const nuevoAccessToken = this.readString(tokenData.access_token);
      if (!nuevoAccessToken) {
        return accessToken;
      }

      const nuevasCredenciales = {
        ...credenciales,
        access_token: nuevoAccessToken,
        refresh_token: this.readString(tokenData.refresh_token) ?? refreshToken,
        token_type: this.readString(tokenData.token_type) ?? 'Bearer',
        expires_in: this.toNumber(tokenData.expires_in) ?? null,
        token_obtenido_en: new Date().toISOString(),
      };

      await this.actualizarCredenciales(integracionId, nuevasCredenciales);
      return nuevoAccessToken;
    } catch (error) {
      this.logger.warn(
        `[ML] Error refrescando token integracion=${integracionId}: ${this.toErrorMessage(error)}`,
      );
      return accessToken;
    }
  }

  private async actualizarCredenciales(
    integracionId: string,
    credenciales: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .update({ credenciales })
      .eq('id', integracionId);

    if (error) {
      this.logger.warn(
        `[ML] No se pudieron actualizar credenciales de integracion ${integracionId}: ${error.message}`,
      );
    }
  }

  private async actualizarUltimaSync(integracionId: string): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq('id', integracionId);

    if (error) {
      this.logger.warn(
        `[ML] No se pudo actualizar ultima_sincronizacion para ${integracionId}: ${error.message}`,
      );
    }
  }

  private async obtenerProductosActivos(empresaId: string): Promise<ProductoMl[]> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku, nombre')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .not('sku', 'is', null);

    if (error) {
      throw new InternalServerErrorException(`Error obteniendo productos: ${error.message}`);
    }

    return ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const id = this.readString(row.id);
        const sku = this.readString(row.sku);
        if (!id || !sku) return null;
        return {
          id,
          sku,
          nombre: this.readString(row.nombre) ?? 'Producto',
        };
      })
      .filter((row): row is ProductoMl => row !== null);
  }

  private async obtenerStockTotalPorProducto(
    empresaId: string,
    productoIds: string[],
  ): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    if (productoIds.length === 0) return totals;

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('producto_id, cantidad')
      .eq('empresa_id', empresaId)
      .in('producto_id', productoIds);

    if (error) {
      throw new InternalServerErrorException(`Error obteniendo stock por sucursal: ${error.message}`);
    }

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const productoId = this.readString(row.producto_id);
      if (!productoId) continue;
      const cantidad = this.toNumber(row.cantidad) ?? 0;
      totals.set(productoId, (totals.get(productoId) ?? 0) + cantidad);
    }

    return totals;
  }

  private async getMLUserId(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.mercadolibre.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as Record<string, unknown>;
      return this.readString(data.id);
    } catch {
      return null;
    }
  }

  private async getPublicacionesML(
    userId: string,
    accessToken: string,
  ): Promise<PublicacionMl[]> {
    try {
      const searchRes = await fetch(
        `https://api.mercadolibre.com/users/${userId}/items/search?limit=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!searchRes.ok) {
        const raw = await searchRes.text();
        this.logger.warn(
          `[ML] Error obteniendo publicaciones de ${userId}: ${searchRes.status} ${raw}`,
        );
        return [];
      }

      const searchData = (await searchRes.json()) as { results?: unknown[] };
      const itemIds = Array.isArray(searchData.results)
        ? searchData.results
            .map((itemId) => this.readString(itemId))
            .filter((itemId): itemId is string => Boolean(itemId))
        : [];

      if (itemIds.length === 0) return [];

      const detalles = await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const detailRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!detailRes.ok) return null;
            const detail = (await detailRes.json()) as Record<string, unknown>;
            return detail;
          } catch {
            return null;
          }
        }),
      );

      return detalles.filter((row): row is PublicacionMl => row !== null);
    } catch {
      return [];
    }
  }

  private resolverSellerSku(publicacion: PublicacionMl): string | null {
    const direct = this.readString(publicacion.seller_custom_field);
    if (direct) return direct;

    const attributes = Array.isArray(publicacion.attributes)
      ? (publicacion.attributes as Array<Record<string, unknown>>)
      : [];
    const sellerSkuAttribute = attributes.find(
      (attribute) => this.readString(attribute.id)?.toUpperCase() === 'SELLER_SKU',
    );

    return (
      this.readString(sellerSkuAttribute?.value_name) ??
      this.readString(sellerSkuAttribute?.value_id) ??
      null
    );
  }

  private async actualizarStockML(
    itemId: string,
    cantidad: number,
    accessToken: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ available_quantity: cantidad }),
      });

      if (!response.ok) {
        const raw = await response.text();
        this.logger.error(
          `[ML] Error actualizando stock item=${itemId}: ${response.status} ${raw}`,
        );
        return false;
      }

      this.logger.log(`[ML] Stock actualizado item=${itemId} cantidad=${cantidad}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[ML] Error actualizando stock ${itemId}: ${this.toErrorMessage(error)}`,
      );
      return false;
    }
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    if (error && typeof error === 'object') {
      const row = error as Record<string, unknown>;
      const message = this.readString(row.message);
      if (message) return message;
    }
    return 'error desconocido';
  }
}
