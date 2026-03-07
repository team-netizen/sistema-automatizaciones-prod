import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly maxListItems = 50;

  constructor(private readonly supabase: SupabaseService) {}

  private validateUuid(value: string, field: string): string {
    const normalized = String(value || '').trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        normalized,
      );
    if (!isUuid) {
      // [SECURITY FIX] Evita inyeccion en expresiones OR de PostgREST.
      throw new BadRequestException(`${field} invalido`);
    }
    return normalized;
  }

  private normalizeText(value: unknown, field: string, maxLength: number): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException(`${field} requerido`);
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException(`${field} excede el maximo permitido`);
    }
    return normalized;
  }

  private normalizeOptionalText(value: unknown, maxLength: number): string | null {
    if (value === undefined || value === null) return null;

    const normalized = String(value).trim();
    if (!normalized) return null;

    if (normalized.length > maxLength) {
      throw new BadRequestException('valor excede el maximo permitido');
    }

    return normalized;
  }

  private sanitizeTipo(value?: string): 'sistema' | 'alerta' | 'informativa' {
    const allowed = new Set(['sistema', 'alerta', 'informativa']);
    const normalized = String(value ?? 'sistema').trim().toLowerCase();
    return allowed.has(normalized)
      ? (normalized as 'sistema' | 'alerta' | 'informativa')
      : 'sistema';
  }

  /**
   * Crea una nueva notificacion.
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
      const titulo = this.normalizeText(params.titulo, 'titulo', 160);
      const mensaje = this.normalizeText(params.mensaje, 'mensaje', 5000);
      const tipo = this.sanitizeTipo(params.tipo);
      const canal = this.normalizeOptionalText(params.canal, 80) || 'interna';

      const { data, error } = await this.supabase
        .getAdminClient()
        .from('notificaciones')
        .insert({
          empresa_id: params.empresa_id,
          usuario_id: params.usuario_id || null,
          titulo,
          mensaje,
          tipo,
          canal,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error creando notificacion: ${message}`);
      return null;
    }
  }

  /**
   * Listar notificaciones del usuario actual.
   */
  async listarParaUsuario(empresa_id: string, usuario_id: string) {
    const safeUsuarioId = this.validateUuid(usuario_id, 'usuario_id');
    const { data, error } = await this.supabase
      .getAdminClient()
      .from('notificaciones')
      .select('*')
      .eq('empresa_id', empresa_id)
      .or(`usuario_id.eq.${safeUsuarioId},usuario_id.is.null`)
      .order('fecha_creacion', { ascending: false })
      .limit(this.maxListItems);

    if (error) throw error;
    return data;
  }

  /**
   * Marcar como leida.
   */
  async marcarLeida(id: string, empresa_id: string, usuario_id: string) {
    const safeId = this.validateUuid(id, 'id');
    const safeUsuarioId = this.validateUuid(usuario_id, 'usuario_id');

    const { data, error } = await this.supabase
      .getAdminClient()
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', safeId)
      .eq('empresa_id', empresa_id)
      .or(`usuario_id.eq.${safeUsuarioId},usuario_id.is.null`)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new NotFoundException('Notificacion no encontrada');
    }

    return { success: true };
  }

  /**
   * Contar no leidas.
   */
  async contarNoLeidas(empresa_id: string, usuario_id: string) {
    const safeUsuarioId = this.validateUuid(usuario_id, 'usuario_id');
    const { count, error } = await this.supabase
      .getAdminClient()
      .from('notificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id)
      .or(`usuario_id.eq.${safeUsuarioId},usuario_id.is.null`)
      .eq('leida', false);

    if (error) throw error;
    return { total: count || 0 };
  }
}
