import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SupabaseService } from '../../../shared/supabase/supabase.service';
import { type SyncResult, WooCommerceSyncService } from './woocommerce.sync.service';

type WooSyncJobData = {
  empresa_id: string;
  manual?: boolean;
  lookback_days?: number;
};

@Processor('woocommerce-sync')
@Injectable()
export class WooCommerceProcessor extends WorkerHost {
  private readonly logger = new Logger(WooCommerceProcessor.name);
  private readonly integracionIdCache = new Map<string, string>();

  constructor(
    private readonly wooSyncService: WooCommerceSyncService,
    private readonly supabase: SupabaseService,
  ) {
    super();
  }

  async process(job: Job<WooSyncJobData>): Promise<void> {
    console.log('[WOO PROCESSOR] Job recibido:', job.name, 'empresa:', job.data?.empresa_id);
    switch (job.name) {
      case 'sync-stock':
        await this.handleSyncStock(job);
        return;
      case 'sync-pedidos':
        await this.handleSyncPedidos(job);
        return;
      case 'sync-inicial':
        await this.handleSyncInicial(job);
        return;
      default:
        this.logger.warn(`Job desconocido en queue woocommerce-sync: ${job.name}`);
    }
  }

  async handleSyncStock(job: Job<WooSyncJobData>): Promise<void> {
    const { empresa_id } = job.data;
    const resultado = await this.wooSyncService.sincronizarStockHaciaWoo(empresa_id);
    await this.logResultado('sync-stock', empresa_id, resultado);
  }

  async handleSyncPedidos(job: Job<WooSyncJobData>): Promise<void> {
    const { empresa_id } = job.data;
    const resultado = await this.wooSyncService.sincronizarPedidosDesdeWoo(empresa_id, {
      manual: Boolean(job.data?.manual),
      lookbackDays: job.data?.lookback_days,
    });
    await this.logResultado('sync-pedidos', empresa_id, resultado);
  }

  async handleSyncInicial(job: Job<WooSyncJobData>): Promise<void> {
    const { empresa_id } = job.data;
    const resultado = await this.wooSyncService.syncInicial(empresa_id);
    await this.logResultado('sync-inicial', empresa_id, resultado);
  }

  private async logResultado(
    tipo: 'sync-stock' | 'sync-pedidos' | 'sync-inicial',
    empresa_id: string,
    resultado: SyncResult,
  ): Promise<void> {
    const integracion_id = await this.resolveIntegracionId(empresa_id);
    if (!integracion_id) {
      this.logger.warn(
        `[sync_log] No se pudo registrar ${tipo} para empresa ${empresa_id}: integración WooCommerce no encontrada`,
      );
      return;
    }

    const estado = resultado.fallidos > 0 ? 'parcial' : 'exitoso';
    const resumen = `${tipo} finalizado: exitosos=${resultado.exitosos}, fallidos=${resultado.fallidos}`;
    const detalle = resultado.errores.length > 0 ? `${resumen} | ${resultado.errores.join(' | ')}` : resumen;

    const payload = {
      empresa_id,
      integracion_id,
      producto_id: null,
      stock_enviado: null,
      estado,
      detalle_error: detalle.slice(0, 1000),
      fecha_sync: new Date().toISOString(),
    };

    const { error } = await this.supabase.getAdminClient().from('sync_log').insert(payload);
    if (!error) return;

    this.logger.warn(
      `[sync_log] No se pudo registrar ${tipo} para empresa ${empresa_id}: ${error.message}`,
    );
  }

  private async resolveIntegracionId(empresa_id: string): Promise<string | null> {
    const cached = this.integracionIdCache.get(empresa_id);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('tipo_integracion', 'woocommerce')
      .eq('activa', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const id = String((data as Record<string, unknown>).id ?? '').trim();
    if (!id) return null;
    this.integracionIdCache.set(empresa_id, id);
    return id;
  }
}
