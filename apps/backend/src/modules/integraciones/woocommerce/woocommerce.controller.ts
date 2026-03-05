import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { Roles } from '../../../core/auth/roles.decorator';
import { type PerfilUsuario, RolesGuard } from '../../../core/auth/roles.guard';
import { SupabaseService } from '../../../shared/supabase/supabase.service';
import {
  WooCommerceClient,
  type WooCredenciales,
  type WooPedido,
} from './woocommerce.client';
import { WooCommerceScheduler } from './woocommerce.scheduler';
import { WooCommerceSyncService } from './woocommerce.sync.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
  rawBody?: string | Buffer;
};

type WooSyncJobData = {
  empresa_id: string;
};

type EstadoIntegracion = {
  activo: boolean;
  ultima_sync: string | null;
  productos_sync: number;
  errores_recientes: Array<{
    nivel: string;
    mensaje: string;
    fecha: string | null;
  }>;
};

@Controller('integraciones/woocommerce')
export class WooCommerceController {
  private readonly logger = new Logger(WooCommerceController.name);

  constructor(
    private readonly wooClient: WooCommerceClient,
    private readonly wooSyncService: WooCommerceSyncService,
    private readonly wooScheduler: WooCommerceScheduler,
    private readonly supabase: SupabaseService,
    @InjectQueue('woocommerce-sync')
    private readonly wooQueue: Queue<WooSyncJobData>,
  ) {}

  @Post('webhook/:empresa_id')
  @HttpCode(HttpStatus.OK)
  async recibirWebhook(
    @Param('empresa_id') empresa_id: string,
    @Body() body: unknown,
    @Headers('x-wc-webhook-topic') topicRaw: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Req() req: Request,
  ) {
    const webhookSecret = await this.obtenerWebhookSecret(empresa_id);
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret no configurado');
    }

    if (!this.verificarFirmaWebhook(signature, this.obtenerRawBody(req, body), webhookSecret)) {
      throw new UnauthorizedException('Firma de webhook invalida');
    }

    const topic = String(topicRaw ?? '').trim().toLowerCase();
    if (topic === 'order.created' || topic === 'order.updated') {
      const pedido = this.toWooPedido(body);
      if (pedido) {
        setImmediate(() => {
          this.wooSyncService.procesarWebhookPedido(empresa_id, pedido).catch((error: unknown) => {
            this.logger.error(
              `[webhook] Error procesando pedido Woo empresa=${empresa_id}: ${this.toErrorMessage(error)}`,
            );
          });
        });
      }
    }

    return { ok: true };
  }

  @Post('conectar')
  @UseGuards(RolesGuard)
  @Roles('admin_empresa', 'super_admin')
  async conectar(
    @Req() req: AuthenticatedRequest,
    @Body() body: { url: string; consumer_key: string; consumer_secret: string },
  ) {
    const empresa_id = this.requireEmpresaId(req);
    const credenciales = this.validarCredencialesEntrada(body);

    try {
      await this.wooClient.getProductos(credenciales, 1);
      await this.guardarIntegracionWoo(empresa_id, credenciales);

      await this.wooQueue.add(
        'sync-inicial',
        { empresa_id },
        {
          jobId: `woocommerce-${empresa_id}-sync-inicial-${Date.now()}`,
          removeOnComplete: true,
        },
      );

      await this.wooScheduler.registrarJobsParaEmpresa(empresa_id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isRedisError(error)) {
        this.logger.error(
          `[conectar] Redis/BullMQ no disponible empresa=${empresa_id}: ${this.toErrorMessage(error)}`,
        );
        throw new ServiceUnavailableException(
          'Redis/BullMQ no disponible. Revisa REDIS_URL en Render e intenta nuevamente.',
        );
      }

      this.logger.error(
        `[conectar] Error conectando WooCommerce empresa=${empresa_id}: ${this.toErrorMessage(error)}`,
      );
      throw new InternalServerErrorException('No se pudo completar la conexión con WooCommerce');
    }

    return {
      ok: true,
      empresa_id,
      activo: true,
      mensaje: 'WooCommerce conectado y sync inicial encolada',
    };
  }

  @Post('desconectar')
  @UseGuards(RolesGuard)
  @Roles('admin_empresa', 'super_admin')
  async desconectar(@Req() req: AuthenticatedRequest) {
    const empresa_id = this.requireEmpresaId(req);
    const integracion = await this.obtenerIntegracionWoo(empresa_id);

    if (integracion?.id) {
      const { error } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .update({ activa: false })
        .eq('id', integracion.id);

      if (error) {
        throw new InternalServerErrorException(
          `Error al desactivar integración WooCommerce: ${error.message}`,
        );
      }
    }

    await this.wooScheduler.eliminarJobsParaEmpresa(empresa_id);
    return { ok: true, empresa_id, activo: false };
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Roles('admin_empresa', 'super_admin')
  async forzarSync(@Req() req: AuthenticatedRequest) {
    const empresa_id = this.requireEmpresaId(req);

    const jobs = await Promise.all([
      this.wooQueue.add(
        'sync-stock',
        { empresa_id },
        {
          jobId: `woocommerce-${empresa_id}-sync-stock-manual-${Date.now()}`,
          removeOnComplete: true,
        },
      ),
      this.wooQueue.add(
        'sync-pedidos',
        { empresa_id },
        {
          jobId: `woocommerce-${empresa_id}-sync-pedidos-manual-${Date.now()}`,
          removeOnComplete: true,
        },
      ),
    ]);

    return {
      ok: true,
      empresa_id,
      jobs: jobs.map((job: Job<WooSyncJobData>) => ({ id: job.id, name: job.name })),
    };
  }

  @Get('estado')
  @UseGuards(RolesGuard)
  @Roles('admin_empresa', 'super_admin')
  async getEstado(@Req() req: AuthenticatedRequest): Promise<EstadoIntegracion> {
    const empresa_id = this.requireEmpresaId(req);
    const [integracion, productos_sync, errores_recientes] = await Promise.all([
      this.obtenerIntegracionWoo(empresa_id),
      this.contarProductosConSku(empresa_id),
      this.obtenerErroresRecientes(empresa_id),
    ]);

    return {
      activo: Boolean(integracion?.activa),
      ultima_sync: integracion?.ultima_sincronizacion ?? null,
      productos_sync,
      errores_recientes,
    };
  }

  private requireEmpresaId(req: AuthenticatedRequest): string {
    const empresaId = req?.perfil?.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return empresaId;
  }

  private validarCredencialesEntrada(body: {
    url: string;
    consumer_key: string;
    consumer_secret: string;
  }): WooCredenciales {
    const url = String(body?.url ?? '').trim().replace(/\/+$/, '');
    const consumerKey = String(body?.consumer_key ?? '').trim();
    const consumerSecret = String(body?.consumer_secret ?? '').trim();

    if (!url || !consumerKey || !consumerSecret) {
      throw new BadRequestException(
        'Debes enviar url, consumer_key y consumer_secret de WooCommerce',
      );
    }

    return {
      url,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    };
  }

  private async guardarIntegracionWoo(
    empresa_id: string,
    credenciales: WooCredenciales,
  ): Promise<void> {
    const existente = await this.obtenerIntegracionWoo(empresa_id);
    const canalId = await this.resolverCanalWooId(empresa_id);

    if (existente?.id) {
      const { error } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .update({
          credenciales,
          activa: true,
          tipo_integracion: 'woocommerce',
          canal_id: canalId ?? existente.canal_id ?? null,
        })
        .eq('id', existente.id);

      if (error) {
        throw new InternalServerErrorException(
          `Error actualizando integración WooCommerce: ${error.message}`,
        );
      }
      return;
    }

    const payloads: Array<Record<string, unknown>> = [
      {
        empresa_id,
        tipo_integracion: 'woocommerce',
        canal_id: canalId,
        credenciales,
        activa: true,
        ultima_sincronizacion: null,
      },
      {
        empresa_id,
        tipo_integracion: 'woocommerce',
        canal_id: canalId,
        credenciales,
        activa: true,
        ultima_sincronizacion: null,
      },
      {
        empresa_id,
        tipo_integracion: 'woocommerce',
        credenciales,
        activa: true,
        ultima_sincronizacion: null,
      },
    ];

    let lastError: { message?: string } | null = null;
    for (const payload of payloads) {
      const { error } = await this.supabase
        .getAdminClient()
        .from('integraciones_canal')
        .insert(payload);

      if (!error) {
        return;
      }

      if (this.isRecoverableColumnError(error)) {
        lastError = error;
        continue;
      }

      throw new InternalServerErrorException(
        `Error insertando integración WooCommerce: ${error.message}`,
      );
    }

    throw new InternalServerErrorException(
      `No se pudo guardar integración WooCommerce: ${lastError?.message ?? 'schema incompatible'}`,
    );
  }

  private async resolverCanalWooId(empresa_id: string): Promise<string | null> {
    const existing = await this.supabase
      .getAdminClient()
      .from('canales_venta')
      .select('id')
      .eq('empresa_id', empresa_id)
      .ilike('nombre', '%woo%')
      .limit(1)
      .maybeSingle();

    if (!existing.error && existing.data) {
      return this.readString((existing.data as Record<string, unknown>).id);
    }

    return null;
  }

  private async obtenerIntegracionWoo(empresa_id: string): Promise<{
    id: string;
    canal_id: string | null;
    activa: boolean;
    ultima_sincronizacion: string | null;
    credenciales?: WooCredenciales | null;
  } | null> {
    const direct = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select(
        'id, empresa_id, canal_id, tipo_integracion, activa, ultima_sincronizacion, credenciales',
      )
      .eq('empresa_id', empresa_id)
      .eq('tipo_integracion', 'woocommerce')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!direct.error && direct.data) {
      return this.toIntegracion(direct.data as Record<string, unknown>);
    }

    const all = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('id, empresa_id, canal_id, activa, ultima_sincronizacion, credenciales')
      .eq('empresa_id', empresa_id);

    if (all.error) {
      throw new InternalServerErrorException(
        `Error consultando integraciones_canal: ${all.error.message}`,
      );
    }

    const rows = (all.data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;

    const canalIds = rows
      .map((row) => this.readString(row.canal_id))
      .filter((id): id is string => Boolean(id));

    const canalMap = new Map<string, string>();
    if (canalIds.length > 0) {
      const canales = await this.supabase
        .getAdminClient()
        .from('canales_venta')
        .select('id, nombre, codigo')
        .in('id', canalIds);

      if (!canales.error) {
        for (const row of (canales.data ?? []) as Array<Record<string, unknown>>) {
          const id = this.readString(row.id);
          if (!id) continue;
          const label = `${this.readString(row.nombre) ?? ''} ${this.readString(row.codigo) ?? ''}`
            .trim()
            .toLowerCase();
          canalMap.set(id, label);
        }
      }
    }

    const candidato = rows.find((row) => {
      const canalId = this.readString(row.canal_id);
      if (canalId && (canalMap.get(canalId) ?? '').includes('woo')) return true;

      const cred = row.credenciales;
      if (!cred || typeof cred !== 'object' || Array.isArray(cred)) return false;

      const data = cred as Record<string, unknown>;
      return Boolean(
        this.readString(data.url) &&
          this.readString(data.consumer_key) &&
          this.readString(data.consumer_secret),
      );
    });

    if (!candidato) return null;
    return this.toIntegracion(candidato);
  }

  private toIntegracion(row: Record<string, unknown>): {
    id: string;
    canal_id: string | null;
    activa: boolean;
    ultima_sincronizacion: string | null;
    credenciales?: WooCredenciales | null;
  } | null {
    const id = this.readString(row.id);
    if (!id) return null;

    let credenciales: WooCredenciales | null = null;
    if (row.credenciales && typeof row.credenciales === 'object' && !Array.isArray(row.credenciales)) {
      const cred = row.credenciales as Record<string, unknown>;
      const url = this.readString(cred.url);
      const consumer_key = this.readString(cred.consumer_key);
      const consumer_secret = this.readString(cred.consumer_secret);
      if (url && consumer_key && consumer_secret) {
        credenciales = { url, consumer_key, consumer_secret };
      }
    }

    return {
      id,
      canal_id: this.readString(row.canal_id),
      activa: Boolean(row.activa),
      ultima_sincronizacion: this.readString(row.ultima_sincronizacion),
      credenciales,
    };
  }

  private async obtenerWebhookSecret(empresa_id: string): Promise<string | null> {
    const globalSecret = String(process.env.WOO_WEBHOOK_SECRET ?? '').trim();
    if (globalSecret) return globalSecret;

    const integracion = await this.obtenerIntegracionWoo(empresa_id);
    const secret = integracion?.credenciales
      ? null
      : null;

    return secret;
  }

  private verificarFirmaWebhook(signature: string, rawBody: string, secret: string): boolean {
    const firmaRecibida = String(signature ?? '').trim();
    if (!firmaRecibida) return false;

    const calculada = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (calculada.length !== firmaRecibida.length) return false;

    return crypto.timingSafeEqual(Buffer.from(calculada), Buffer.from(firmaRecibida));
  }

  private obtenerRawBody(req: Request, body: unknown): string {
    const maybeRaw = req as Request & { rawBody?: string | Buffer };
    if (typeof maybeRaw.rawBody === 'string') return maybeRaw.rawBody;
    if (Buffer.isBuffer(maybeRaw.rawBody)) return maybeRaw.rawBody.toString('utf8');
    if (typeof body === 'string') return body;

    try {
      return JSON.stringify(body ?? {});
    } catch {
      return '';
    }
  }

  private toWooPedido(payload: unknown): WooPedido | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const row = payload as Record<string, unknown>;

    const id = this.toNumber(row.id);
    if (id === null) return null;

    const billing = this.toRecord(row.billing) ?? {};
    const shipping = this.toRecord(row.shipping) ?? {};
    const lineItems = Array.isArray(row.line_items) ? row.line_items : [];

    return {
      id,
      status: this.readString(row.status) ?? 'pending',
      billing: {
        first_name: this.readString(billing.first_name) ?? '',
        last_name: this.readString(billing.last_name) ?? '',
        email: this.readString(billing.email) ?? '',
        phone: this.readString(billing.phone) ?? '',
      },
      shipping: {
        address_1: this.readString(shipping.address_1) ?? '',
        city: this.readString(shipping.city) ?? '',
        state: this.readString(shipping.state) ?? '',
        postcode: this.readString(shipping.postcode) ?? '',
        latitude: this.toNumber(shipping.latitude) ?? undefined,
        longitude: this.toNumber(shipping.longitude) ?? undefined,
      },
      line_items: lineItems
        .map((item) => this.toPedidoLineItem(item))
        .filter(
          (
            item,
          ): item is {
            product_id: number;
            sku: string;
            quantity: number;
            price: string;
          } => item !== null,
        ),
      date_created: this.readString(row.date_created) ?? new Date().toISOString(),
      total: this.readString(row.total) ?? '0',
    };
  }

  private toPedidoLineItem(payload: unknown): {
    product_id: number;
    sku: string;
    quantity: number;
    price: string;
  } | null {
    const row = this.toRecord(payload);
    if (!row) return null;

    const productId = this.toNumber(row.product_id);
    if (productId === null) return null;

    return {
      product_id: productId,
      sku: this.readString(row.sku) ?? '',
      quantity: this.toNumber(row.quantity) ?? 0,
      price: this.readString(row.price) ?? this.readString(row.total) ?? '0',
    };
  }

  private async contarProductosConSku(empresa_id: string): Promise<number> {
    const { count, error } = await this.supabase
      .getAdminClient()
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id)
      .not('sku', 'is', null);

    if (error) return 0;
    return count ?? 0;
  }

  private async obtenerErroresRecientes(
    empresa_id: string,
  ): Promise<Array<{ nivel: string; mensaje: string; fecha: string | null }>> {
    const table = this.supabase.getAdminClient().from('sync_log');
    const attempts = [
      table
        .select('*')
        .eq('empresa_id', empresa_id)
        .order('fecha_sync', { ascending: false })
        .limit(15),
      table
        .select('*')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .limit(15),
      table.select('*').eq('empresa_id', empresa_id).limit(15),
    ];

    let rows: Array<Record<string, unknown>> = [];
    for (const attempt of attempts) {
      const { data, error } = await attempt;
      if (error) {
        if (this.isRecoverableColumnError(error)) continue;
        return [];
      }

      rows = (data ?? []) as Array<Record<string, unknown>>;
      break;
    }

    return rows
      .map((row) => ({
        nivel: this.readString(row.nivel) ?? this.readString(row.estado) ?? 'info',
        mensaje:
          this.readString(row.mensaje) ?? this.readString(row.detalle) ?? 'Evento de sincronización',
        fecha: this.readString(row.fecha_sync) ?? this.readString(row.created_at) ?? null,
      }))
      .filter((row) => row.nivel === 'error' || row.nivel === 'warning')
      .slice(0, 10);
  }

  private isRecoverableColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
    const code = String(error?.code ?? '');
    const message = String(error?.message ?? '').toLowerCase();
    return (
      code === '42703' ||
      code === 'PGRST204' ||
      message.includes('column') ||
      message.includes('schema cache') ||
      message.includes('does not exist')
    );
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private toNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
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

  private isRedisError(error: unknown): boolean {
    const message = this.toErrorMessage(error).toLowerCase();
    return (
      message.includes('redis') ||
      message.includes('ioredis') ||
      message.includes('econnrefused') ||
      message.includes('connection is closed') ||
      message.includes('max retries per request') ||
      message.includes('timed out')
    );
  }
}
