import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { type AxiosError, type AxiosInstance } from 'axios';

export type WooCredenciales = {
  url: string;
  consumer_key: string;
  consumer_secret: string;
};

export type WooProducto = {
  id: number;
  sku: string;
  name: string;
  stock_quantity: number;
  manage_stock: boolean;
};

export type WooPedido = {
  id: number;
  status: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  shipping: {
    address_1: string;
    city: string;
    state: string;
    postcode: string;
    latitude?: number;
    longitude?: number;
  };
  line_items: Array<{
    product_id: number;
    sku: string;
    quantity: number;
    price: string;
  }>;
  date_created: string;
  total: string;
};

@Injectable()
export class WooCommerceClient {
  private readonly logger = new Logger(WooCommerceClient.name);

  private getClient(credenciales: WooCredenciales): AxiosInstance {
    const baseUrl = `${this.normalizarUrl(credenciales.url)}/wp-json/wc/v3`;
    const token = Buffer.from(
      `${credenciales.consumer_key}:${credenciales.consumer_secret}`,
    ).toString('base64');

    return axios.create({
      baseURL: baseUrl,
      timeout: 15000,
      headers: {
        Authorization: `Basic ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async getProductoBySku(
    credenciales: WooCredenciales,
    sku: string,
  ): Promise<WooProducto | null> {
    try {
      const skuNormalizado = sku.trim();
      if (!skuNormalizado) return null;

      const client = this.getClient(credenciales);
      const { data } = await client.get<unknown[]>('/products', {
        params: { sku: skuNormalizado },
      });

      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      for (const raw of data) {
        const producto = this.toWooProducto(raw);
        if (producto) return producto;
      }

      return null;
    } catch (error) {
      this.manejarError('getProductoBySku', error);
    }
  }

  async actualizarStock(
    credenciales: WooCredenciales,
    productId: number,
    cantidad: number,
  ): Promise<void> {
    try {
      const client = this.getClient(credenciales);
      await client.put(`/products/${productId}`, {
        stock_quantity: Math.max(0, Math.trunc(cantidad)),
        manage_stock: true,
      });
    } catch (error) {
      this.manejarError('actualizarStock', error);
    }
  }

  async getPedidosNuevos(
    credenciales: WooCredenciales,
    desde: Date,
  ): Promise<WooPedido[]> {
    try {
      const client = this.getClient(credenciales);
      const pedidos: WooPedido[] = [];

      let page = 1;
      while (true) {
        const { data } = await client.get<unknown[]>('/orders', {
          params: {
            after: desde.toISOString(),
            status: 'processing,pending',
            per_page: 100,
            page,
          },
        });

        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        const pagePedidos = data
          .map((raw) => this.toWooPedido(raw))
          .filter((pedido): pedido is WooPedido => pedido !== null);
        pedidos.push(...pagePedidos);

        if (data.length < 100) {
          break;
        }
        page += 1;
      }

      return pedidos;
    } catch (error) {
      this.manejarError('getPedidosNuevos', error);
    }
  }

  async getProductos(credenciales: WooCredenciales, page: number): Promise<WooProducto[]> {
    try {
      const client = this.getClient(credenciales);
      const { data } = await client.get<unknown[]>('/products', {
        params: { per_page: 100, page },
      });

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data
        .map((raw) => this.toWooProducto(raw))
        .filter((producto): producto is WooProducto => producto !== null);
    } catch (error) {
      this.manejarError('getProductos', error);
    }
  }

  async registrarWebhook(
    credenciales: WooCredenciales,
    topic: string,
    deliveryUrl: string,
  ): Promise<void> {
    try {
      const secret = process.env.WOO_WEBHOOK_SECRET?.trim();
      if (!secret) {
        throw new InternalServerErrorException(
          'WOO_WEBHOOK_SECRET no configurado para registrar webhooks',
        );
      }

      const client = this.getClient(credenciales);
      await client.post('/webhooks', {
        name: `Sync ${topic}`,
        topic,
        delivery_url: deliveryUrl,
        secret,
        status: 'active',
      });
    } catch (error) {
      this.manejarError('registrarWebhook', error);
    }
  }

  private normalizarUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private toWooProducto(payload: unknown): WooProducto | null {
    const row = this.toRecord(payload);
    if (!row) return null;

    const id = this.toNumber(row.id);
    if (id === null) return null;

    return {
      id,
      sku: this.toString(row.sku) ?? '',
      name: this.toString(row.name) ?? '',
      stock_quantity: this.toNumber(row.stock_quantity) ?? 0,
      manage_stock: this.toBoolean(row.manage_stock),
    };
  }

  private toWooPedido(payload: unknown): WooPedido | null {
    const row = this.toRecord(payload);
    if (!row) return null;

    const id = this.toNumber(row.id);
    if (id === null) return null;

    const billing = this.toRecord(row.billing) ?? {};
    const shipping = this.toRecord(row.shipping) ?? {};
    const lineItemsRaw = Array.isArray(row.line_items) ? row.line_items : [];
    const geo = this.extraerGeolocalizacion(shipping, row.meta_data);

    const lineItems = lineItemsRaw
      .map((item) => this.toLineItem(item))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      id,
      status: this.toString(row.status) ?? 'pending',
      billing: {
        first_name: this.toString(billing.first_name) ?? '',
        last_name: this.toString(billing.last_name) ?? '',
        email: this.toString(billing.email) ?? '',
        phone: this.toString(billing.phone) ?? '',
      },
      shipping: {
        address_1: this.toString(shipping.address_1) ?? '',
        city: this.toString(shipping.city) ?? '',
        state: this.toString(shipping.state) ?? '',
        postcode: this.toString(shipping.postcode) ?? '',
        ...geo,
      },
      line_items: lineItems,
      date_created: this.toString(row.date_created) ?? '',
      total: this.toString(row.total) ?? '0',
    };
  }

  private toLineItem(
    payload: unknown,
  ): { product_id: number; sku: string; quantity: number; price: string } | null {
    const row = this.toRecord(payload);
    if (!row) return null;

    const productId = this.toNumber(row.product_id);
    if (productId === null) return null;

    return {
      product_id: productId,
      sku: this.toString(row.sku) ?? '',
      quantity: this.toNumber(row.quantity) ?? 0,
      price: this.toString(row.price) ?? this.toString(row.total) ?? '0',
    };
  }

  private extraerGeolocalizacion(
    shipping: Record<string, unknown>,
    metaData: unknown,
  ): { latitude?: number; longitude?: number } {
    const directLatitude = this.toNumber(shipping.latitude);
    const directLongitude = this.toNumber(shipping.longitude);
    if (directLatitude !== null && directLongitude !== null) {
      return { latitude: directLatitude, longitude: directLongitude };
    }

    const latKeys = new Set(['latitude', 'lat', '_shipping_latitude', 'shipping_latitude']);
    const lngKeys = new Set(['longitude', 'lng', 'lon', '_shipping_longitude', 'shipping_longitude']);

    const meta = Array.isArray(metaData) ? metaData : [];
    let latitude: number | null = null;
    let longitude: number | null = null;

    for (const item of meta) {
      const record = this.toRecord(item);
      if (!record) continue;

      const key = (this.toString(record.key) ?? '').toLowerCase();
      if (!key) continue;

      const value = this.toNumber(record.value);
      if (value === null) continue;

      if (latKeys.has(key)) latitude = value;
      if (lngKeys.has(key)) longitude = value;
    }

    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }

    return {};
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private toString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    return String(value);
  }

  private toNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return false;
  }

  private manejarError(contexto: string, error: unknown): never {
    if (error instanceof InternalServerErrorException) {
      throw error;
    }

    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError?.response?.status;
    const apiMessage = axiosError?.response?.data?.message;
    const message = apiMessage ?? axiosError?.message ?? 'Error desconocido';

    this.logger.error(`[${contexto}] status=${status ?? 'n/a'} message=${message}`);
    throw new InternalServerErrorException(`Error de WooCommerce en ${contexto}`);
  }
}
