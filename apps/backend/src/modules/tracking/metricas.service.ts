import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Injectable()
export class MetricasService {
    private readonly logger = new Logger(MetricasService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * Incrementa los contadores de métricas diarias para una empresa.
     * Se usa 'upsert' con lógica de incremento para evitar colisiones.
     */
    async registrarActividad(params: {
        empresa_id: string;
        tokens?: number;
        ejecucion?: boolean;
        error?: boolean;
        costo?: number;
    }) {
        const { empresa_id, tokens = 0, ejecucion = false, error = false, costo = 0 } = params;
        const fecha = new Date().toISOString().split('T')[0];

        try {
            // Nota: En un sistema de alto tráfico, esto se haría mediante una función RPC en Postgres
            // para asegurar atomicidad y reducir latencia. Por ahora usamos la lógica de negocio.

            // Intentamos obtener la métrica del día
            const { data: existente } = await this.supabase
                .getAdminClient()
                .from('metricas_diarias')
                .select('*')
                .eq('empresa_id', empresa_id)
                .eq('fecha', fecha)
                .single();

            if (existente) {
                await this.supabase
                    .getAdminClient()
                    .from('metricas_diarias')
                    .update({
                        total_ejecuciones: existente.total_ejecuciones + (ejecucion ? 1 : 0),
                        tokens_usados: existente.tokens_usados + tokens,
                        errores: existente.errores + (error ? 1 : 0),
                        costo_estimado: Number(existente.costo_estimado) + costo,
                    })
                    .eq('id', existente.id);
            } else {
                await this.supabase
                    .getAdminClient()
                    .from('metricas_diarias')
                    .insert({
                        empresa_id,
                        fecha,
                        total_ejecuciones: ejecucion ? 1 : 0,
                        tokens_usados: tokens,
                        errores: error ? 1 : 0,
                        costo_estimado: costo,
                    });
            }
        } catch (err) {
            this.logger.error(`Error actualizando métricas para empresa ${empresa_id}: ${err.message}`);
        }
    }

    /**
     * Obtiene métricas históricas para el dashboard.
     */
    async obtenerResumen(empresa_id: string, dias = 7) {
        const { data, error } = await this.supabase
            .getClient()
            .from('metricas_diarias')
            .select('*')
            .eq('empresa_id', empresa_id)
            .order('fecha', { ascending: false })
            .limit(dias);

        if (error) throw error;
        return data;
    }
}
