import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { Request } from 'express';

/**
 * SupabaseAuthGuard — Middleware de seguridad principal.
 *
 * Flujo ejecutado en CADA request protegida:
 * 1. Extrae Bearer token del header Authorization.
 * 2. Valida el JWT contra Supabase Auth.
 * 3. Consulta la tabla `perfiles` para obtener empresa_id y rol.
 * 4. Consulta la tabla `empresas` para validar estado = 'activo'.
 * 5. Inyecta usuario enriquecido (usuario_id, empresa_id, rol, estado_empresa) en request.
 *
 * Si falla cualquier paso → 401/403 sin detalle interno.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(private supabase: SupabaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('Token de autenticación requerido');
        }

        // ── Paso 1: Validar JWT con Supabase Auth ──
        const {
            data: { user },
            error: authError,
        } = await this.supabase.getClient().auth.getUser(token);

        if (authError || !user) {
            throw new UnauthorizedException('Token inválido o expirado');
        }

        // ── Paso 2: Consultar perfil del usuario (tabla perfiles) ──
        const { data: perfil, error: perfilError } = await this.supabase
            .getAdminClient()
            .from('perfiles')
            .select('rol, empresa_id')
            .eq('id', user.id)
            .single();

        if (perfilError || !perfil) {
            throw new ForbiddenException(
                'No se encontró perfil asociado a este usuario',
            );
        }

        // ── Paso 3: Consultar estado de la empresa ──
        const { data: empresa, error: empresaError } = await this.supabase
            .getAdminClient()
            .from('empresas')
            .select('id, nombre, estado')
            .eq('id', perfil.empresa_id)
            .single();

        if (empresaError || !empresa) {
            throw new ForbiddenException('Empresa no encontrada');
        }

        // ── Paso 4: Validar que la empresa esté activa ──
        if (empresa.estado !== 'activo') {
            throw new ForbiddenException(
                `Acceso bloqueado: la empresa se encuentra en estado "${empresa.estado}"`,
            );
        }

        // ── Paso 5: Inyectar usuario enriquecido en la request ──
        (request as any).user = {
            usuario_id: user.id,
            email: user.email,
            empresa_id: perfil.empresa_id,
            empresa_nombre: empresa.nombre,
            rol: perfil.rol,
            estado_empresa: empresa.estado,
        };

        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
