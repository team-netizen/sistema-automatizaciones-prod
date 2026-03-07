import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SupabaseService } from '../../../shared/supabase/supabase.service';

type WooSyncJobData = {
  empresa_id: string;
};

const TEN_MINUTES_MS = 10 * 60 * 1000;

@Injectable()
export class WooCommerceScheduler implements OnModuleInit {
  private readonly logger = new Logger(WooCommerceScheduler.name);

  constructor(
    @InjectQueue('woocommerce-sync')
    private readonly woocommerceQueue: Queue<WooSyncJobData>,
    private readonly supabase: SupabaseService,
  ) {
    console.log('[WOO SCHEDULER] constructor ejecutado');
  }

  async onModuleInit(): Promise<void> {
    try {
      console.log('[WOO SCHEDULER] onModuleInit iniciado');
      await this.registrarJobsActivos();
      console.log('[WOO SCHEDULER] onModuleInit completado');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[WOO SCHEDULER ERROR]', error.message, error.stack);
    }
  }

  async registrarJobsActivos(): Promise<void> {
    const empresas = await this.obtenerEmpresasWooActivas();
    const settled = await Promise.allSettled(
      empresas.map((empresa_id) => this.registrarJobsParaEmpresa(empresa_id)),
    );

    for (const item of settled) {
      if (item.status === 'rejected') {
        this.logger.error(`No se pudo registrar job repetitivo: ${this.toErrorMessage(item.reason)}`);
      }
    }
  }

  async registrarJobsParaEmpresa(empresa_id: string): Promise<void> {
    await this.woocommerceQueue.add(
      'sync-stock',
      { empresa_id },
      {
        jobId: `woocommerce-${empresa_id}-sync-stock`,
        repeat: { every: TEN_MINUTES_MS },
        removeOnComplete: true,
      },
    );

    await this.woocommerceQueue.add(
      'sync-pedidos',
      { empresa_id },
      {
        jobId: `woocommerce-${empresa_id}-sync-pedidos`,
        repeat: { every: TEN_MINUTES_MS },
        removeOnComplete: true,
      },
    );
  }

  async eliminarJobsParaEmpresa(empresa_id: string): Promise<void> {
    const repeatables = await this.woocommerceQueue.getRepeatableJobs();

    for (const job of repeatables) {
      const jobId = String(job.id ?? '');
      if (!jobId.includes(`woocommerce-${empresa_id}-`)) continue;
      await this.woocommerceQueue.removeRepeatableByKey(job.key);
    }
  }

  private async obtenerEmpresasWooActivas(): Promise<string[]> {
    const query = await this.supabase
      .getAdminClient()
      .from('integraciones_canal')
      .select('empresa_id, canal_id, credenciales, activa, tipo_integracion')
      .eq('activa', true)
      .eq('tipo_integracion', 'woocommerce');

    if (query.error) {
      throw new Error(`Error consultando integraciones activas: ${query.error.message}`);
    }

    const rows = (query.data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];

    const canalIds = rows
      .map((row) => this.readString(row.canal_id))
      .filter((id): id is string => Boolean(id));

    let canalesMap = new Map<string, string>();
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

          const nombre = this.readString(row.nombre) ?? '';
          const codigo = this.readString(row.codigo) ?? '';
          canalesMap.set(id, `${nombre} ${codigo}`.toLowerCase());
        }
      }
    }

    const empresasWoo = rows
      .filter((row) => {
        const canalId = this.readString(row.canal_id);
        if (canalId && (canalesMap.get(canalId) ?? '').includes('woo')) return true;

        const cred = row.credenciales;
        if (!cred || typeof cred !== 'object' || Array.isArray(cred)) return false;
        const rec = cred as Record<string, unknown>;

        const hasUrl = Boolean(this.readString(rec.url));
        const hasKey = Boolean(this.readString(rec.consumer_key));
        const hasSecret = Boolean(this.readString(rec.consumer_secret));
        return hasUrl && hasKey && hasSecret;
      })
      .map((row) => this.readString(row.empresa_id))
      .filter((id): id is string => Boolean(id));

    return [...new Set(empresasWoo)];
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
}
