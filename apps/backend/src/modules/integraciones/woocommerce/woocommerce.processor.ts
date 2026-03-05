import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SupabaseService } from '../../../shared/supabase/supabase.service';
import { type SyncResult, WooCommerceSyncService } from './woocommerce.sync.service';

type WooSyncJobData = {
  empresa_id: string;
};

@Processor('woocommerce-sync')
@Injectable()
export class WooCommerceProcessor extends WorkerHost {
  private readonly logger = new Logger(WooCommerceProcessor.name);

  constructor(
    private readonly wooSyncService: WooCommerceSyncService,
    private readonly supabase: SupabaseService,
  ) {
    super();
  }

  async process(job: Job<WooSyncJobData>): Promise<void> {
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
    const resultado = await this.wooSyncService.sincronizarPedidosDesdeWoo(empresa_id);
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
    const nivel = resultado.fallidos > 0 ? 'warning' : 'info';
    const mensaje = `${tipo} finalizado: exitosos=${resultado.exitosos}, fallidos=${resultado.fallidos}`;

    const variantes: Array<Record<string, unknown>> = [
      {
        empresa_id,
        canal_nombre: 'woocommerce',
        tipo,
        nivel,
        mensaje,
        metadata: {
          ...resultado,
          fuente: 'woocommerce.processor',
        },
        fecha_sync: new Date().toISOString(),
      },
      {
        empresa_id,
        tipo_sync: tipo,
        estado: nivel,
        detalle: mensaje,
        data: {
          ...resultado,
          fuente: 'woocommerce.processor',
        },
      },
      {
        empresa_id,
        mensaje: `[${tipo}] ${mensaje}`,
      },
    ];

    let lastError: { message?: string } | null = null;
    for (const payload of variantes) {
      const { error } = await this.supabase.getAdminClient().from('sync_log').insert(payload);
      if (!error) return;
      lastError = error;
      if (this.isRecoverableColumnError(error)) continue;

      this.logger.warn(`[sync_log] Error no recuperable al insertar ${tipo}: ${error.message}`);
      return;
    }

    this.logger.warn(
      `[sync_log] No se pudo registrar ${tipo} para empresa ${empresa_id}: ${lastError?.message ?? 'error desconocido'}`,
    );
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
}
