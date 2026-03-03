import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class AlertasEngine {
    private readonly logger = new Logger(AlertasEngine.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly notificaciones: NotificacionesService
    ) { }

    /**
     * Motor de evaluación de alertas.
     * En producción, esto sería invocado por un cron job (ej: cada hora o tras cada ejecución pesada).
     */
    async evaluarAlertasPorEmpresa(empresa_id: string) {
        this.logger.log(`Iniciando evaluación de alertas para empresa: ${empresa_id}`);

        try {
            // 1. Obtener configuraciones de alerta activas para la empresa
            const { data: configs } = await this.supabase
                .getAdminClient()
                .from('alertas_configuracion')
                .select('*')
                .eq('empresa_id', empresa_id)
                .eq('activa', true);

            if (!configs || configs.length === 0) return;

            // 2. Obtener datos de uso actual (Unión de plan + uso_actual)
            const { data: uso } = await this.supabase
                .getAdminClient()
                .from('uso_empresa')
                .select('*, empresas(nombre), planes_suscripcion(*)')
                .eq('empresa_id', empresa_id)
                .single();

            if (!uso) return;

            // 3. Evaluar cada configuración
            for (const config of configs) {
                await this.procesarReglaAlerta(config, uso);
            }

        } catch (err) {
            this.logger.error(`Error en AlertasEngine para ${empresa_id}: ${err.message}`);
        }
    }

    private async procesarReglaAlerta(config: any, uso: any) {
        const { tipo_alerta, umbral_valor } = config;
        let disparar = false;
        let mensaje = '';
        let nivel: 'informativa' | 'advertencia' | 'critica' = 'informativa';

        switch (tipo_alerta) {
            case 'limite_tokens':
                const porcentajeTokens = (uso.tokens_usados / uso.planes_suscripcion.limite_tokens_mensual) * 100;
                if (porcentajeTokens >= umbral_valor) {
                    disparar = true;
                    nivel = umbral_valor >= 90 ? 'critica' : 'advertencia';
                    mensaje = `Has consumido el ${porcentajeTokens.toFixed(1)}% de tus tokens mensuales.`;
                }
                break;

            case 'ejecuciones_altas':
                const porcentajeEjs = (uso.cantidad_ejecuciones / uso.planes_suscripcion.limite_ejecuciones_mensual) * 100;
                if (porcentajeEjs >= umbral_valor) {
                    disparar = true;
                    nivel = umbral_valor >= 90 ? 'critica' : 'advertencia';
                    mensaje = `Has alcanzado el ${porcentajeEjs.toFixed(1)}% del límite de ejecuciones de tu plan.`;
                }
                break;

            // Aquí se pueden agregar más casos (tasa_error, etc.)
        }

        if (disparar) {
            await this.registrarAlerta(config, mensaje, nivel);
        }
    }

    private async registrarAlerta(config: any, mensaje: string, nivel: any) {
        // Evitar duplicados recientes (ej: no alertar 10 veces el mismo día por lo mismo si ya existe una no leída)
        const { data: existe } = await this.supabase
            .getAdminClient()
            .from('alertas_generadas')
            .select('id')
            .eq('empresa_id', config.empresa_id)
            .eq('alerta_config_id', config.id)
            .eq('leida', false)
            .limit(1);

        if (existe && existe.length > 0) return;

        // 1. Guardar en log de alertas
        const { data: alerta } = await this.supabase
            .getAdminClient()
            .from('alertas_generadas')
            .insert({
                empresa_id: config.empresa_id,
                alerta_config_id: config.id,
                mensaje,
                nivel
            })
            .select()
            .single();

        // 2. Crear notificación interna para la UI
        if (config.notificar_interna) {
            await this.notificaciones.crear({
                empresa_id: config.empresa_id,
                titulo: `Alerta: ${config.tipo_alerta.replace('_', ' ').toUpperCase()}`,
                mensaje,
                tipo: 'alerta'
            });
        }

        this.logger.warn(`Alerta disparada para empresa ${config.empresa_id}: ${mensaje}`);
    }
}
