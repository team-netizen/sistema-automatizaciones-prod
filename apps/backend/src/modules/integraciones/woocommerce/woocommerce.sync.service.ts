import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../shared/supabase/supabase.service';
import {
  WooCommerceClient,
  type WooCredenciales,
  type WooPedido,
  type WooProducto,
} from './woocommerce.client';

export type SyncResult = {
  exitosos: number;
  fallidos: number;
  errores: string[];
  duracion_ms: number;
};

type IntegracionWoo = {
  id: string;
  canal_id: string | null;
  ultima_sync: string | null;
  credenciales: WooCredenciales;
};

type PedidoItemInterno = {
  producto_id: string;
  sku_producto: string;
  cantidad: number;
  precio_unitario: number;
};

type ResultadoPedido = {
  exitoso: boolean;
  duplicado?: boolean;
  mensaje?: string;
};

@Injectable()
export class WooCommerceSyncService {
  private readonly logger = new Logger(WooCommerceSyncService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly wooClient: WooCommerceClient,
  ) {}

  async sincronizarStockHaciaWoo(empresa_id: string): Promise<SyncResult> {
    const started = Date.now();
    const result: SyncResult = { exitosos: 0, fallidos: 0, errores: [], duracion_ms: 0 };

    try {
      const integracion = await this.getIntegracionWooActiva(empresa_id);
      const stock = await this.obtenerStockConsolidadoPorSku(empresa_id);

      const settled = await Promise.allSettled(
        stock.map(([sku, cantidad]) =>
          this.syncSkuStock(empresa_id, integracion.credenciales, sku, cantidad),
        ),
      );

      for (const item of settled) {
        if (item.status === 'fulfilled') {
          if (item.value.exitoso) {
            result.exitosos += 1;
          } else {
            result.fallidos += 1;
            if (item.value.mensaje) result.errores.push(item.value.mensaje);
          }
          continue;
        }

        result.fallidos += 1;
        result.errores.push(this.toErrorMessage(item.reason, 'Error actualizando stock en WooCommerce'));
      }

      await this.actualizarUltimaSync(integracion.id);
      result.duracion_ms = Date.now() - started;

      await this.registrarSyncLog(empresa_id, 'sync-stock', result.fallidos > 0 ? 'warning' : 'info', {
        exitosos: result.exitosos,
        fallidos: result.fallidos,
        errores: result.errores,
        duracion_ms: result.duracion_ms,
      });

      return result;
    } catch (error) {
      result.fallidos += 1;
      result.errores.push(this.toErrorMessage(error, 'Fallo general en sync de stock'));
      result.duracion_ms = Date.now() - started;

      await this.registrarSyncLog(empresa_id, 'sync-stock', 'error', {
        errores: result.errores,
        duracion_ms: result.duracion_ms,
      });

      return result;
    }
  }

  async sincronizarPedidosDesdeWoo(empresa_id: string): Promise<SyncResult> {
    const started = Date.now();
    const result: SyncResult = { exitosos: 0, fallidos: 0, errores: [], duracion_ms: 0 };

    try {
      const integracion = await this.getIntegracionWooActiva(empresa_id);
      const desde = this.parseUltimaSync(integracion.ultima_sync);
      const pedidos = await this.wooClient.getPedidosNuevos(integracion.credenciales, desde);

      for (const pedido of pedidos) {
        const procesado = await this.procesarPedidoInterno({ empresa_id, integracion, wooPedido: pedido });

        if (procesado.exitoso || procesado.duplicado) {
          result.exitosos += 1;
        } else {
          result.fallidos += 1;
          if (procesado.mensaje) result.errores.push(procesado.mensaje);
        }
      }

      await this.actualizarUltimaSync(integracion.id);
      result.duracion_ms = Date.now() - started;

      await this.registrarSyncLog(empresa_id, 'sync-pedidos', result.fallidos > 0 ? 'warning' : 'info', {
        pedidos: pedidos.length,
        exitosos: result.exitosos,
        fallidos: result.fallidos,
        errores: result.errores,
        duracion_ms: result.duracion_ms,
      });

      return result;
    } catch (error) {
      result.fallidos += 1;
      result.errores.push(this.toErrorMessage(error, 'Fallo general en sync de pedidos'));
      result.duracion_ms = Date.now() - started;

      await this.registrarSyncLog(empresa_id, 'sync-pedidos', 'error', {
        errores: result.errores,
        duracion_ms: result.duracion_ms,
      });

      return result;
    }
  }

  async procesarWebhookPedido(empresa_id: string, wooPedido: WooPedido): Promise<void> {
    const integracion = await this.getIntegracionWooActiva(empresa_id);
    const procesado = await this.procesarPedidoInterno({ empresa_id, integracion, wooPedido });

    if (!procesado.exitoso && !procesado.duplicado) {
      throw new InternalServerErrorException(
        procesado.mensaje ?? `No se pudo procesar el pedido Woo ${wooPedido.id}`,
      );
    }

    await this.actualizarUltimaSync(integracion.id);
  }

  async syncInicial(empresa_id: string): Promise<SyncResult> {
    const started = Date.now();
    const result: SyncResult = { exitosos: 0, fallidos: 0, errores: [], duracion_ms: 0 };

    try {
      const integracion = await this.getIntegracionWooActiva(empresa_id);
      const productosWoo = await this.obtenerTodosLosProductos(integracion.credenciales);

      const settled = await Promise.allSettled(
        productosWoo
          .filter((item) => item.sku.trim().length > 0)
          .map(async (productoWoo) => {
            const interno = await this.buscarProductoInternoPorSku(empresa_id, productoWoo.sku);
            if (!interno) {
              const mensaje = `SKU ${productoWoo.sku} no encontrado internamente`;
              await this.registrarSyncLog(empresa_id, 'sync-inicial', 'warning', {
                mensaje,
                sku: productoWoo.sku,
                woo_product_id: productoWoo.id,
              });
              return { exitoso: false, mensaje };
            }

            const stock = await this.obtenerStockConsolidadoParaSkus(empresa_id, [interno.sku]);
            await this.wooClient.actualizarStock(
              integracion.credenciales,
              productoWoo.id,
              stock.get(interno.sku) ?? 0,
            );
            return { exitoso: true };
          }),
      );

      for (const item of settled) {
        if (item.status === 'fulfilled') {
          if (item.value.exitoso) {
            result.exitosos += 1;
          } else {
            result.fallidos += 1;
            if (item.value.mensaje) result.errores.push(item.value.mensaje);
          }
          continue;
        }

        result.fallidos += 1;
        result.errores.push(this.toErrorMessage(item.reason, 'Error en sync inicial'));
      }

      const backendUrl = String(process.env.BACKEND_URL ?? '').trim().replace(/\/+$/, '');
      if (!backendUrl) {
        result.fallidos += 1;
        result.errores.push('BACKEND_URL no configurado para webhooks');
      } else {
        const webhookUrl = `${backendUrl}/api/integraciones/woocommerce/webhook/${empresa_id}`;
        const hooks = await Promise.allSettled([
          this.wooClient.registrarWebhook(integracion.credenciales, 'order.created', webhookUrl),
          this.wooClient.registrarWebhook(integracion.credenciales, 'order.updated', webhookUrl),
        ]);

        for (const hook of hooks) {
          if (hook.status === 'rejected') {
            result.fallidos += 1;
            result.errores.push(this.toErrorMessage(hook.reason, 'Error registrando webhook'));
          }
        }
      }

      await this.actualizarUltimaSync(integracion.id);
      result.duracion_ms = Date.now() - started;

      await this.registrarSyncLog(empresa_id, 'sync-inicial', result.fallidos > 0 ? 'warning' : 'info', {
        productos_woo: productosWoo.length,
        exitosos: result.exitosos,
        fallidos: result.fallidos,
        errores: result.errores,
        duracion_ms: result.duracion_ms,
      });

      return result;
    } catch (error) {
      result.fallidos += 1;
      result.errores.push(this.toErrorMessage(error, 'Fallo general en sync inicial'));
      result.duracion_ms = Date.now() - started;

      await this.registrarSyncLog(empresa_id, 'sync-inicial', 'error', {
        errores: result.errores,
        duracion_ms: result.duracion_ms,
      });

      return result;
    }
  }

  private async procesarPedidoInterno(params: {
    empresa_id: string;
    integracion: IntegracionWoo;
    wooPedido: WooPedido;
  }): Promise<ResultadoPedido> {
    const { empresa_id, integracion, wooPedido } = params;
    const wooOrderId = String(wooPedido.id).trim();

    try {
      const duplicado = await this.buscarPedidoDuplicado(empresa_id, wooOrderId);
      if (duplicado) return { exitoso: true, duplicado: true, mensaje: `Pedido Woo ${wooOrderId} duplicado` };

      const sucursalId = await this.getSucursalParaPedido(empresa_id, wooPedido);
      const canalId = await this.resolverCanalId(empresa_id, integracion.canal_id);
      const items = await this.mapearItemsPedido(empresa_id, wooPedido);

      if (items.length === 0) {
        return { exitoso: false, mensaje: `Pedido Woo ${wooOrderId} sin items válidos` };
      }

      const pedidoId = await this.crearPedido(empresa_id, sucursalId, canalId, wooPedido);
      await this.insertarPedidoItems(pedidoId, empresa_id, sucursalId, items);

      const stockSettled = await Promise.allSettled(
        items.map((item) =>
          this.descontarStockSucursal(empresa_id, sucursalId, item.producto_id, item.cantidad),
        ),
      );

      const errores: string[] = [];
      for (const item of stockSettled) {
        if (item.status === 'rejected') {
          errores.push(this.toErrorMessage(item.reason, 'Error descontando stock por sucursal'));
        }
      }

      const skus = [...new Set(items.map((item) => item.sku_producto))];
      const syncErrores = await this.syncSkusConsolidados(empresa_id, integracion.credenciales, skus);
      errores.push(...syncErrores);

      if (errores.length > 0) {
        await this.registrarSyncLog(empresa_id, 'pedido-woo', 'warning', {
          woo_order_id: wooOrderId,
          pedido_id: pedidoId,
          errores,
        });
      }

      return { exitoso: true };
    } catch (error) {
      const mensaje = this.toErrorMessage(error, `Error procesando pedido Woo ${wooOrderId}`);
      await this.registrarSyncLog(empresa_id, 'pedido-woo', 'error', {
        woo_order_id: wooOrderId,
        mensaje,
      });
      return { exitoso: false, mensaje };
    }
  }

  private async syncSkuStock(
    empresa_id: string,
    credenciales: WooCredenciales,
    sku: string,
    cantidad: number,
  ): Promise<{ exitoso: boolean; mensaje?: string }> {
    const wooProducto = await this.wooClient.getProductoBySku(credenciales, sku);
    if (!wooProducto) {
      const mensaje = `SKU ${sku} no existe en WooCommerce`;
      await this.registrarSyncLog(empresa_id, 'sync-stock', 'warning', { sku, mensaje });
      return { exitoso: false, mensaje };
    }

    await this.wooClient.actualizarStock(credenciales, wooProducto.id, Math.max(0, cantidad));
    return { exitoso: true };
  }

  private async syncSkusConsolidados(
    empresa_id: string,
    credenciales: WooCredenciales,
    skus: string[],
  ): Promise<string[]> {
    if (skus.length === 0) return [];

    const totals = await this.obtenerStockConsolidadoParaSkus(empresa_id, skus);

    const settled = await Promise.allSettled(
      skus.map(async (sku) => {
        const productoWoo = await this.wooClient.getProductoBySku(credenciales, sku);
        if (!productoWoo) {
          const msg = `SKU ${sku} no existe en WooCommerce`;
          await this.registrarSyncLog(empresa_id, 'sync-pedidos', 'warning', { sku, mensaje: msg });
          return msg;
        }

        await this.wooClient.actualizarStock(
          credenciales,
          productoWoo.id,
          Math.max(0, totals.get(sku) ?? 0),
        );

        return null;
      }),
    );

    const errores: string[] = [];
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        if (item.value) errores.push(item.value);
      } else {
        errores.push(this.toErrorMessage(item.reason, 'Error actualizando SKU en WooCommerce'));
      }
    }

    return errores;
  }

  private async getIntegracionWooActiva(empresa_id: string): Promise<IntegracionWoo> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('id, empresa_id, canal_id, credenciales, activo, ultima_sync')
      .eq('empresa_id', empresa_id)
      .eq('activo', true);

    if (error) {
      throw new InternalServerErrorException(`Error obteniendo integración Woo: ${error.message}`);
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      throw new InternalServerErrorException('No existe integración WooCommerce activa');
    }

    const parsed = rows
      .map((row) => {
        const id = this.readString(row.id);
        const cred = this.parseCredenciales(row.credenciales);
        if (!id || !cred) return null;

        return {
          id,
          canal_id: this.readString(row.canal_id),
          ultima_sync: this.readString(row.ultima_sync),
          credenciales: cred,
        } as IntegracionWoo;
      })
      .filter((item): item is IntegracionWoo => item !== null);

    if (parsed.length === 0) {
      throw new InternalServerErrorException('Credenciales Woo inválidas en integración activa');
    }

    if (parsed.length === 1) return parsed[0];

    const canalIds = parsed.map((item) => item.canal_id).filter((id): id is string => Boolean(id));
    if (canalIds.length > 0) {
      const canales = await this.supabase
        .getAdminClient()
        .from('canales_venta')
        .select('id, nombre, codigo')
        .in('id', canalIds);

      if (!canales.error) {
        const map = new Map<string, string>();
        for (const row of (canales.data ?? []) as Array<Record<string, unknown>>) {
          const id = this.readString(row.id);
          const nombre = this.readString(row.nombre);
          const codigo = this.readString(row.codigo);
          if (id) map.set(id, `${nombre ?? ''} ${codigo ?? ''}`.toLowerCase());
        }

        const wooByCanal = parsed.find((item) => {
          if (!item.canal_id) return false;
          return (map.get(item.canal_id) ?? '').includes('woo');
        });

        if (wooByCanal) return wooByCanal;
      }
    }

    return parsed[0];
  }

  private parseCredenciales(raw: unknown): WooCredenciales | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const row = raw as Record<string, unknown>;
    const url = this.readString(row.url);
    const consumer_key = this.readString(row.consumer_key);
    const consumer_secret = this.readString(row.consumer_secret);

    if (!url || !consumer_key || !consumer_secret) return null;
    return { url, consumer_key, consumer_secret };
  }

  private async obtenerTodosLosProductos(credenciales: WooCredenciales): Promise<WooProducto[]> {
    const out: WooProducto[] = [];
    let page = 1;

    while (true) {
      const batch = await this.wooClient.getProductos(credenciales, page);
      if (batch.length === 0) break;
      out.push(...batch);
      if (batch.length < 100) break;
      page += 1;
    }

    return out;
  }

  private async obtenerStockConsolidadoPorSku(empresa_id: string): Promise<Array<[string, number]>> {
    const productosResp = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku')
      .eq('empresa_id', empresa_id)
      .not('sku', 'is', null);

    if (productosResp.error) {
      throw new InternalServerErrorException(
        `Error consultando productos para stock consolidado: ${productosResp.error.message}`,
      );
    }

    const skuByProducto = new Map<string, string>();
    const totals = new Map<string, number>();
    for (const row of (productosResp.data ?? []) as Array<Record<string, unknown>>) {
      const id = this.readString(row.id);
      const sku = this.readString(row.sku);
      if (!id || !sku) continue;
      skuByProducto.set(id, sku);
      totals.set(sku, 0);
    }

    const stockResp = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('producto_id, cantidad')
      .eq('empresa_id', empresa_id);

    if (stockResp.error) {
      throw new InternalServerErrorException(`Error consultando stock_por_sucursal: ${stockResp.error.message}`);
    }

    for (const row of (stockResp.data ?? []) as Array<Record<string, unknown>>) {
      const productoId = this.readString(row.producto_id);
      if (!productoId) continue;

      const sku = skuByProducto.get(productoId);
      if (!sku) continue;

      totals.set(sku, (totals.get(sku) ?? 0) + this.readNumber(row.cantidad));
    }

    return Array.from(totals.entries());
  }

  private async obtenerStockConsolidadoParaSkus(
    empresa_id: string,
    skus: string[],
  ): Promise<Map<string, number>> {
    const wanted = [...new Set(skus.map((s) => s.trim()).filter(Boolean))];
    const out = new Map<string, number>();
    for (const sku of wanted) out.set(sku, 0);
    if (wanted.length === 0) return out;

    const productos = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku')
      .eq('empresa_id', empresa_id)
      .not('sku', 'is', null);

    if (productos.error) {
      throw new InternalServerErrorException(`Error obteniendo productos por SKU: ${productos.error.message}`);
    }

    const wantedLower = new Set(wanted.map((sku) => sku.toLowerCase()));
    const skuByProducto = new Map<string, string>();
    for (const row of (productos.data ?? []) as Array<Record<string, unknown>>) {
      const id = this.readString(row.id);
      const sku = this.readString(row.sku);
      if (!id || !sku) continue;
      if (wantedLower.has(sku.toLowerCase())) {
        skuByProducto.set(id, sku);
      }
    }

    const productoIds = Array.from(skuByProducto.keys());
    if (productoIds.length === 0) return out;

    const stock = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('producto_id, cantidad')
      .eq('empresa_id', empresa_id)
      .in('producto_id', productoIds);

    if (stock.error) {
      throw new InternalServerErrorException(`Error obteniendo stock de SKU: ${stock.error.message}`);
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

  private async buscarProductoInternoPorSku(
    empresa_id: string,
    sku: string,
  ): Promise<{ id: string; sku: string } | null> {
    const clean = sku.trim();
    if (!clean) return null;

    const exact = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('id, sku')
      .eq('empresa_id', empresa_id)
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
      .eq('empresa_id', empresa_id)
      .ilike('sku', clean)
      .limit(1)
      .maybeSingle();

    if (ci.error || !ci.data) return null;

    const row = ci.data as Record<string, unknown>;
    const id = this.readString(row.id);
    const skuFound = this.readString(row.sku);
    return id && skuFound ? { id, sku: skuFound } : null;
  }

  private async mapearItemsPedido(empresa_id: string, wooPedido: WooPedido): Promise<PedidoItemInterno[]> {
    const items: PedidoItemInterno[] = [];

    for (const line of wooPedido.line_items ?? []) {
      const sku = String(line.sku ?? '').trim();
      const cantidad = Math.max(0, Math.trunc(Number(line.quantity) || 0));
      if (!sku || cantidad <= 0) continue;

      const producto = await this.buscarProductoInternoPorSku(empresa_id, sku);
      if (!producto) {
        await this.registrarSyncLog(empresa_id, 'sync-pedidos', 'warning', {
          woo_order_id: wooPedido.id,
          sku,
          mensaje: `SKU ${sku} no existe internamente`,
        });
        continue;
      }

      const precio = Number(line.price);
      items.push({
        producto_id: producto.id,
        sku_producto: producto.sku,
        cantidad,
        precio_unitario: Number.isFinite(precio) && precio >= 0 ? precio : 0,
      });
    }

    return items;
  }

  private async buscarPedidoDuplicado(empresa_id: string, wooOrderId: string): Promise<string | null> {
    const byCanal = await this.supabase
      .getAdminClient()
      .from('pedidos')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('canal_order_id', wooOrderId)
      .eq('canal_nombre', 'woocommerce')
      .limit(1)
      .maybeSingle();

    if (!byCanal.error && byCanal.data) {
      return this.readString((byCanal.data as Record<string, unknown>).id);
    }

    const byExterno = await this.supabase
      .getAdminClient()
      .from('pedidos')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('id_externo', wooOrderId)
      .limit(1)
      .maybeSingle();

    if (byExterno.error || !byExterno.data) return null;
    return this.readString((byExterno.data as Record<string, unknown>).id);
  }

  private async crearPedido(
    empresa_id: string,
    sucursal_id: string,
    canal_id: string | null,
    wooPedido: WooPedido,
  ): Promise<string> {
    const wooOrderId = String(wooPedido.id).trim().slice(0, 120);
    const payload: Record<string, unknown> = {
      empresa_id,
      sucursal_id,
      sucursal_asignada_id: sucursal_id,
      canal_id,
      numero: wooOrderId,
      total: Number.isFinite(Number(wooPedido.total)) ? Number(wooPedido.total) : 0,
      estado: this.mapEstadoWoo(wooPedido.status),
      canal_order_id: wooOrderId,
      canal_nombre: 'woocommerce',
      id_externo: wooOrderId,
      id_orden: wooOrderId,
      medio_pedido: 'web',
      fecha_pedido: wooPedido.date_created || new Date().toISOString(),
      nombre_cliente: `${wooPedido.billing.first_name ?? ''} ${wooPedido.billing.last_name ?? ''}`.trim() || null,
      telefono_cliente: String(wooPedido.billing.phone ?? '').trim() || null,
      email_cliente: String(wooPedido.billing.email ?? '').trim() || null,
      direccion_cliente: String(wooPedido.shipping.address_1 ?? '').trim() || null,
      distrito_cliente: String(wooPedido.shipping.city ?? '').trim() || null,
      provincia_cliente: String(wooPedido.shipping.state ?? '').trim() || null,
    };

    const primary = await this.supabase
      .getAdminClient()
      .from('pedidos')
      .insert(payload)
      .select('id')
      .single();

    if (!primary.error && primary.data) {
      const id = this.readString((primary.data as Record<string, unknown>).id);
      if (id) return id;
    }

    if (primary.error?.code === '23505') {
      const dup = await this.buscarPedidoDuplicado(empresa_id, wooOrderId);
      if (dup) return dup;
    }

    const fallback = await this.supabase
      .getAdminClient()
      .from('pedidos')
      .insert({
        empresa_id,
        sucursal_id,
        canal_id,
        numero: wooOrderId,
        total: Number.isFinite(Number(wooPedido.total)) ? Number(wooPedido.total) : 0,
        estado: this.mapEstadoWoo(wooPedido.status),
        id_externo: wooOrderId,
        medio_pedido: 'web',
      })
      .select('id')
      .single();

    if (fallback.error || !fallback.data) {
      throw new InternalServerErrorException(
        `Error creando pedido Woo ${wooOrderId}: ${fallback.error?.message ?? primary.error?.message ?? 'desconocido'}`,
      );
    }

    const id = this.readString((fallback.data as Record<string, unknown>).id);
    if (!id) {
      throw new InternalServerErrorException(`No se pudo recuperar id del pedido Woo ${wooOrderId}`);
    }

    return id;
  }

  private async insertarPedidoItems(
    pedido_id: string,
    empresa_id: string,
    sucursal_id: string,
    items: PedidoItemInterno[],
  ): Promise<void> {
    if (items.length === 0) return;

    const full = await this.supabase.getAdminClient().from('pedido_items').insert(
      items.map((item) => ({
        pedido_id,
        empresa_id,
        sucursal_id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        sku_producto: item.sku_producto,
      })),
    );

    if (!full.error) return;

    const compact = await this.supabase.getAdminClient().from('pedido_items').insert(
      items.map((item) => ({
        pedido_id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      })),
    );

    if (compact.error) {
      throw new InternalServerErrorException(`Error insertando pedido_items: ${compact.error.message}`);
    }
  }

  private async descontarStockSucursal(
    empresa_id: string,
    sucursal_id: string,
    producto_id: string,
    cantidad: number,
  ): Promise<void> {
    const qty = Math.max(0, Math.trunc(cantidad));
    if (qty <= 0) return;

    const stock = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .select('id, cantidad')
      .eq('empresa_id', empresa_id)
      .eq('sucursal_id', sucursal_id)
      .eq('producto_id', producto_id)
      .maybeSingle();

    if (stock.error || !stock.data) {
      throw new InternalServerErrorException(
        `Stock no encontrado para producto ${producto_id} en sucursal ${sucursal_id}`,
      );
    }

    const row = stock.data as Record<string, unknown>;
    const id = this.readString(row.id);
    const actual = this.readNumber(row.cantidad);
    if (!id) throw new InternalServerErrorException('Registro de stock sin id');

    const { error } = await this.supabase
      .getAdminClient()
      .from('stock_por_sucursal')
      .update({ cantidad: Math.max(0, actual - qty) })
      .eq('id', id)
      .eq('empresa_id', empresa_id);

    if (error) {
      throw new InternalServerErrorException(`Error descontando stock: ${error.message}`);
    }
  }

  private async getSucursalParaPedido(empresa_id: string, wooPedido: WooPedido): Promise<string> {
    const lat = this.readFinite(wooPedido.shipping.latitude);
    const lng = this.readFinite(wooPedido.shipping.longitude);

    if (lat !== null && lng !== null) {
      const signatures: Array<Record<string, unknown>> = [
        { p_empresa_id: empresa_id, p_latitud: lat, p_longitud: lng },
        { empresa_id, latitud: lat, longitud: lng },
        { p_empresa_id: empresa_id, p_lat: lat, p_lng: lng },
        { empresa_id, lat, lng },
      ];

      for (const args of signatures) {
        const rpc = await this.supabase.getAdminClient().rpc('get_sucursal_para_pedido', args);
        if (rpc.error) continue;

        const id = this.extractSucursalId(rpc.data);
        if (id) return id;
      }
    }

    const activa = await this.supabase
      .getAdminClient()
      .from('sucursales')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('activa', true)
      .limit(1)
      .maybeSingle();

    if (!activa.error && activa.data) {
      const id = this.readString((activa.data as Record<string, unknown>).id);
      if (id) return id;
    }

    const fallback = await this.supabase
      .getAdminClient()
      .from('sucursales')
      .select('id')
      .eq('empresa_id', empresa_id)
      .limit(1)
      .maybeSingle();

    const sucursalId = fallback.data
      ? this.readString((fallback.data as Record<string, unknown>).id)
      : null;

    if (!sucursalId) {
      throw new InternalServerErrorException(`No hay sucursales disponibles para empresa ${empresa_id}`);
    }

    return sucursalId;
  }

  private extractSucursalId(raw: unknown): string | null {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);

    if (Array.isArray(raw) && raw.length > 0) return this.extractSucursalId(raw[0]);
    if (!raw || typeof raw !== 'object') return null;

    const row = raw as Record<string, unknown>;
    return this.readString(row.sucursal_id) || this.readString(row.id) || null;
  }

  private async resolverCanalId(empresa_id: string, canal_id: string | null): Promise<string | null> {
    if (canal_id) return canal_id;

    const woo = await this.supabase
      .getAdminClient()
      .from('canales_venta')
      .select('id')
      .eq('empresa_id', empresa_id)
      .ilike('nombre', '%woo%')
      .limit(1)
      .maybeSingle();

    if (woo.error || !woo.data) return null;
    return this.readString((woo.data as Record<string, unknown>).id);
  }

  private mapEstadoWoo(status: string): string {
    const value = String(status ?? '').toLowerCase().trim();
    if (value === 'processing' || value === 'completed') return 'confirmado';
    if (value === 'cancelled' || value === 'canceled' || value === 'failed' || value === 'refunded') {
      return 'cancelado';
    }
    return 'pendiente';
  }

  private async actualizarUltimaSync(integracion_id: string): Promise<void> {
    const { error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .update({ ultima_sync: new Date().toISOString() })
      .eq('id', integracion_id);

    if (error) {
      this.logger.warn(`[actualizarUltimaSync] ${error.message}`);
    }
  }

  private parseUltimaSync(raw: string | null): Date {
    if (!raw) return new Date(Date.now() - 5 * 60 * 1000);
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date(Date.now() - 5 * 60 * 1000) : d;
  }

  private async registrarSyncLog(
    empresa_id: string,
    tipo: string,
    nivel: 'info' | 'warning' | 'error',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const mensaje = String(metadata.mensaje ?? `${tipo} (${nivel})`);
    const variants: Array<Record<string, unknown>> = [
      {
        empresa_id,
        tipo,
        nivel,
        mensaje,
        metadata,
        canal_nombre: 'woocommerce',
        fecha_sync: new Date().toISOString(),
      },
      {
        empresa_id,
        tipo_sync: tipo,
        estado: nivel,
        detalle: mensaje,
        data: metadata,
      },
      {
        empresa_id,
        mensaje: `[${tipo}] ${mensaje}`,
      },
    ];

    for (const payload of variants) {
      const { error } = await this.supabase.getAdminClient().from('sync_log').insert(payload);
      if (!error) return;
    }

    this.logger.warn(`[sync_log] No se pudo registrar ${tipo} para empresa ${empresa_id}`);
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) return error.message;

    if (error && typeof error === 'object') {
      const row = error as Record<string, unknown>;
      const message = this.readString(row.message);
      if (message) return message;
    }

    return fallback;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text.length > 0 ? text : null;
  }

  private readNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private readFinite(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}
