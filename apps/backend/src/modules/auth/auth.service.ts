import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import type { LoginDto, LoginResponse, PerfilAutenticado } from './auth.types';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private readonly supabase: SupabaseService) { }

    private async getMustChangePassword(userId: string): Promise<boolean> {
        try {
            const { data, error } = await this.supabase
                .getAdminClient()
                .auth.admin.getUserById(userId);

            if (error) {
                this.logger.warn(`[getMustChangePassword] ${error.message}`);
                return false;
            }

            return Boolean(data?.user?.user_metadata?.must_change_password);
        } catch (error) {
            this.logger.warn(`[getMustChangePassword] ${error}`);
            return false;
        }
    }

    async login(dto: LoginDto): Promise<LoginResponse> {
        const { data: authData, error: authError } = await this.supabase
            .getClient()
            .auth.signInWithPassword({
                email: dto.email,
                password: dto.password,
            });

        if (authError || !authData.session || !authData.user) {
            this.logger.warn(
                `Login fallido para ${dto.email}: ${authError?.message || 'Sin sesion'}`,
            );
            throw new UnauthorizedException('Credenciales invalidas');
        }

        const userId = authData.user.id;
        const session = authData.session;
        const mustChangePassword = Boolean(authData.user.user_metadata?.must_change_password);

        const { data: perfil, error: perfilError } = await this.supabase
            .getAdminClient()
            .from('perfiles')
            .select('empresa_id, rol')
            .eq('id', userId)
            .single();

        if (perfilError || !perfil) {
            this.logger.warn(`Login bloqueado para ${dto.email}: perfil no encontrado`);
            await this.registrarAuditoria(userId, null, 'login_sin_perfil', 'fallido');
            throw new ForbiddenException(
                'No se encontro un perfil asociado a este usuario. Contacte al administrador.',
            );
        }

        let empresaId: string | null = perfil.empresa_id ?? null;
        let empresaNombre = 'Sistema';
        let estadoEmpresa = 'activo';

        if (perfil.empresa_id) {
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

            empresaId = empresa.id;
            empresaNombre = empresa.nombre;
            estadoEmpresa = empresa.estado;

            if (perfil.rol !== 'super_admin') {
                if (empresa.estado === 'suspendido') {
                    throw new UnauthorizedException(
                        `La empresa "${empresa.nombre}" esta suspendida. Contacta al administrador.`,
                    );
                }

                if (empresa.estado === 'inactivo') {
                    throw new UnauthorizedException(
                        `La empresa "${empresa.nombre}" esta inactiva. Contacta al administrador.`,
                    );
                }

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
            }
        } else if (perfil.rol !== 'super_admin') {
            throw new ForbiddenException('Empresa no encontrada en el sistema');
        }

        const usuarioEnriquecido: PerfilAutenticado = {
            usuario_id: userId,
            email: dto.email,
            empresa_id: empresaId,
            empresa_nombre: empresaNombre,
            rol: perfil.rol,
            estado_empresa: estadoEmpresa,
            must_change_password: mustChangePassword,
        };

        await this.registrarAuditoria(
            userId,
            empresaId || null,
            'login_exitoso',
            'exitoso',
        );

        this.logger.log(
            `Login exitoso: ${dto.email} | Empresa: ${empresaNombre} | Rol: ${perfil.rol}`,
        );

        return {
            ok: true,
            mensaje: 'Inicio de sesion exitoso',
            sesion: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_in: session.expires_in,
            },
            usuario: usuarioEnriquecido,
        };
    }

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

        if (!perfil.empresa_id) {
            if (perfil.rol === 'super_admin') {
                return {
                    usuario_id: usuarioId,
                    email: '',
                    empresa_id: null,
                    empresa_nombre: 'Sistema',
                    rol: perfil.rol,
                    estado_empresa: 'activo',
                    must_change_password: await this.getMustChangePassword(usuarioId),
                };
            }
            throw new ForbiddenException('Empresa no encontrada');
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
            email: '',
            empresa_id: empresa.id,
            empresa_nombre: empresa.nombre,
            rol: perfil.rol,
            estado_empresa: empresa.estado,
            must_change_password: await this.getMustChangePassword(usuarioId),
        };
    }

    async cambiarPassword(userId: string, nuevaPassword: string) {
        if (!nuevaPassword || nuevaPassword.length < 6) {
            throw new BadRequestException('La contrasena debe tener minimo 6 caracteres');
        }

        const { data: currentUserData, error: currentUserError } = await this.supabase
            .getAdminClient()
            .auth.admin.getUserById(userId);

        if (currentUserError || !currentUserData?.user) {
            throw new InternalServerErrorException('No se pudo obtener el usuario actual');
        }

        const nextMetadata = {
            ...(currentUserData.user.user_metadata || {}),
            must_change_password: false,
        };

        const { error } = await this.supabase.getAdminClient().auth.admin.updateUserById(userId, {
            password: nuevaPassword,
            user_metadata: nextMetadata,
        });

        if (error) {
            throw new InternalServerErrorException('Error al cambiar contrasena');
        }

        return { success: true };
    }

    async recuperarPassword(email: string) {
        const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
        try {
            await this.supabase.getClient().auth.resetPasswordForEmail(email, {
                redirectTo: `${frontendUrl || 'http://localhost:5173'}/reset-password`,
            });
            return { success: true };
        } catch {
            return { success: true };
        }
    }

    private async registrarAuditoria(
        usuarioId: string,
        empresaId: string | null,
        accion: string,
        estado: 'exitoso' | 'fallido',
    ): Promise<void> {
        try {
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
            this.logger.error(`Error registrando auditoria: ${err}`);
        }
    }
}
