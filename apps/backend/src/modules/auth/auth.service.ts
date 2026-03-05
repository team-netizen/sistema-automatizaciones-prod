import {
    Injectable,
    UnauthorizedException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import type { LoginDto, LoginResponse, PerfilAutenticado } from './auth.types';

/**
 * AuthService — Lógica de negocio de autenticación.
 *
 * Responsabilidades:
 * 1. Autenticar credenciales con Supabase Auth.
 * 2. Verificar existencia de perfil en tabla `perfiles`.
 * 3. Verificar estado de empresa en tabla `empresas` (debe ser 'activo').
 * 4. Construir y devolver la sesión enriquecida.
 * 5. Registrar auditoría del intento de login.
 */
@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * Login completo multi-tenant.
     * Flujo: Credenciales → Supabase Auth → Perfil → Empresa → Sesión enriquecida.
     */
    async login(dto: LoginDto): Promise<LoginResponse> {
        // ── 1. Autenticar con Supabase Auth ──
        const { data: authData, error: authError } = await this.supabase
            .getClient()
            .auth.signInWithPassword({
                email: dto.email,
                password: dto.password,
            });

        if (authError || !authData.session || !authData.user) {
            this.logger.warn(
                `Login fallido para ${dto.email}: ${authError?.message || 'Sin sesión'}`,
            );
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const userId = authData.user.id;
        const session = authData.session;

        // ── 2. Consultar perfil del usuario ──
        const { data: perfil, error: perfilError } = await this.supabase
            .getAdminClient()
            .from('perfiles')
            .select('empresa_id, rol')
            .eq('id', userId)
            .single();

        if (perfilError || !perfil) {
            this.logger.warn(
                `Login bloqueado para ${dto.email}: perfil no encontrado`,
            );
            // Registrar intento fallido en auditoría
            await this.registrarAuditoria(userId, null, 'login_sin_perfil', 'fallido');
            throw new ForbiddenException(
                'No se encontró un perfil asociado a este usuario. Contacte al administrador.',
            );
        }

        // ── 3. Consultar estado de la empresa ──
        const { data: empresa, error: empresaError } = await this.supabase
            .getAdminClient()
            .from('empresas')
            .select('id, nombre, estado')
            .eq('id', perfil.empresa_id)
            .single();

        if (empresaError || !empresa) {
            this.logger.error(
                `Login bloqueado para ${dto.email}: empresa ${perfil.empresa_id} no existe`,
            );
            await this.registrarAuditoria(
                userId,
                perfil.empresa_id,
                'login_empresa_inexistente',
                'fallido',
            );
            throw new ForbiddenException('Empresa no encontrada en el sistema');
        }

        // ── 4. Validar estado de empresa ──
        if (!['activo', 'activa'].includes(empresa.estado)) {
            this.logger.warn(
                `Login bloqueado para ${dto.email}: empresa "${empresa.nombre}" en estado "${empresa.estado}"`,
            );
            await this.registrarAuditoria(
                userId,
                empresa.id,
                'login_empresa_inactiva',
                'fallido',
            );
            throw new ForbiddenException(
                `Acceso denegado: su empresa se encuentra en estado "${empresa.estado}". Contacte al soporte.`,
            );
        }

        // ── 5. Login exitoso: construir respuesta ──
        const usuarioEnriquecido: PerfilAutenticado = {
            usuario_id: userId,
            email: dto.email,
            empresa_id: empresa.id,
            empresa_nombre: empresa.nombre,
            rol: perfil.rol,
            estado_empresa: empresa.estado,
        };

        // Registrar login exitoso
        await this.registrarAuditoria(userId, empresa.id, 'login_exitoso', 'exitoso');

        this.logger.log(
            `Login exitoso: ${dto.email} | Empresa: ${empresa.nombre} | Rol: ${perfil.rol}`,
        );

        return {
            ok: true,
            mensaje: 'Inicio de sesión exitoso',
            sesion: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_in: session.expires_in,
            },
            usuario: usuarioEnriquecido,
        };
    }

    /**
     * Obtener perfil del usuario autenticado actual.
     * (Para usar después del login con el token)
     */
    async obtenerPerfil(usuarioId: string): Promise<PerfilAutenticado> {
        const { data: perfil, error: perfilError } = await this.supabase
            .getAdminClient()
            .from('perfiles')
            .select('empresa_id, rol')
            .eq('id', usuarioId)
            .single();

        if (perfilError || !perfil) {
            throw new ForbiddenException('Perfil no encontrado');
        }

        const { data: empresa, error: empresaError } = await this.supabase
            .getAdminClient()
            .from('empresas')
            .select('id, nombre, estado')
            .eq('id', perfil.empresa_id)
            .single();

        if (empresaError || !empresa) {
            throw new ForbiddenException('Empresa no encontrada');
        }

        return {
            usuario_id: usuarioId,
            email: '', // Se rellena en el controller desde request.user
            empresa_id: empresa.id,
            empresa_nombre: empresa.nombre,
            rol: perfil.rol,
            estado_empresa: empresa.estado,
        };
    }

    /**
     * Registra un evento de auditoría de login.
     * No lanza excepción si falla (best-effort logging).
     */
    private async registrarAuditoria(
        usuarioId: string,
        empresaId: string | null,
        accion: string,
        estado: 'exitoso' | 'fallido',
    ): Promise<void> {
        try {
            // Solo registrar si tenemos empresa_id (para cumplir FK)
            if (!empresaId) return;

            await this.supabase
                .getAdminClient()
                .from('registros_auditoria')
                .insert({
                    empresa_id: empresaId,
                    usuario_id: usuarioId,
                    tipo_accion: accion,
                    estado,
                    metadatos: { timestamp: new Date().toISOString() },
                });
        } catch (err) {
            this.logger.error(`Error registrando auditoría: ${err}`);
            // No propagar — auditoría es best-effort
        }
    }
}
