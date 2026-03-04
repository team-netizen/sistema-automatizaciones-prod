import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Injectable()
export class NotificacionesService {
    private readonly logger = new Logger(NotificacionesService.name);

    constructor(private readonly supabase: SupabaseService) { }

    private validateUuid(value: string, field: string): string {
        const normalized = String(value || '').trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
        if (!isUuid) {
            // [SECURITY FIX] Evita inyeccion en expresiones OR de PostgREST.
            throw new BadRequestException(`${field} invalido`);
        }
        return normalized;
    }

    /**
     * Crea una nueva notificación.
     */
    async crear(params: {
        empresa_id: string;
        usuario_id?: string;
        titulo: string;
        mensaje: string;
        tipo?: 'sistema' | 'alerta' | 'informativa';
        canal?: string;
    }) {
        try {
            const { data, error } = await this.supabase
                .getAdminClient()
                .from('notificaciones')
                .insert({
                    empresa_id: params.empresa_id,
                    usuario_id: params.usuario_id || null,
                    titulo: params.titulo,
                    mensaje: params.mensaje,
                    tipo: params.tipo || 'sistema',
                    canal: params.canal || 'interna',
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            this.logger.error(`Error creando notificación: ${err.message}`);
        }
    }

    /**
     * Listar notificaciones del usuario actual.
     */
    async listarParaUsuario(empresa_id: string, usuario_id: string) {
        const safeUsuarioId = this.validateUuid(usuario_id, 'usuario_id');
        const { data, error } = await this.supabase
            .getClient()
            .from('notificaciones')
            .select('*')
            .eq('empresa_id', empresa_id)
            .or(`usuario_id.eq.${safeUsuarioId},usuario_id.is.null`)
            .order('fecha_creacion', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data;
    }

    /**
     * Marcar como leída.
     */
    async marcarLeida(id: string, empresa_id: string) {
        const { error } = await this.supabase
            .getClient()
            .from('notificaciones')
            .update({ leida: true })
            .eq('id', id)
            .eq('empresa_id', empresa_id);

        if (error) throw error;
        return { success: true };
    }

    /**
     * Contar no leídas.
     */
    async contarNoLeidas(empresa_id: string, usuario_id: string) {
        const safeUsuarioId = this.validateUuid(usuario_id, 'usuario_id');
        const { count, error } = await this.supabase
            .getClient()
            .from('notificaciones')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', empresa_id)
            .or(`usuario_id.eq.${safeUsuarioId},usuario_id.is.null`)
            .eq('leida', false);

        if (error) throw error;
        return { total: count || 0 };
    }
}
