import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../shared/supabase/supabase.service';

type JwtPayload = {
  exp?: number;
  aud?: string | string[];
  iss?: string;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabase: SupabaseService) {}

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  // [SECURITY FIX] Verifica claims criticos antes de consultar recursos.
  private validateJwtClaims(token: string): void {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) {
      throw new UnauthorizedException('Token invalido');
    }

    let payload: JwtPayload | null = null;
    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Token invalido');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.exp !== 'number' || nowSeconds >= payload.exp) {
      throw new UnauthorizedException('Token expirado');
    }

    const validAudience =
      (typeof payload.aud === 'string' && payload.aud === 'authenticated') ||
      (Array.isArray(payload.aud) && payload.aud.includes('authenticated'));

    if (!validAudience) {
      throw new UnauthorizedException('Audience de token invalida');
    }

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '') ?? '';
    if (supabaseUrl) {
      const validIssuers = new Set([`${supabaseUrl}/auth/v1`, `${supabaseUrl}/auth/v1/`]);
      if (!payload.iss || !validIssuers.has(payload.iss)) {
        throw new UnauthorizedException('Issuer de token invalido');
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token de autenticacion requerido');
    }

    this.validateJwtClaims(token);

    const {
      data: { user },
      error: authError,
    } = await this.supabase.getClient().auth.getUser(token);

    if (authError || !user) {
      throw new UnauthorizedException('Token invalido o expirado');
    }

    const { data: perfil, error: perfilError } = await this.supabase
      .getAdminClient()
      .from('perfiles')
      .select('rol, empresa_id')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil) {
      throw new ForbiddenException('No se encontro perfil asociado a este usuario');
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

    const estadoEmpresa = String(empresa.estado ?? '').trim().toLowerCase();
    if (!['activo', 'activa'].includes(estadoEmpresa)) {
      throw new ForbiddenException(
        `Acceso bloqueado: la empresa se encuentra en estado "${empresa.estado}"`,
      );
    }

    (request as Request & {
      user?: {
        usuario_id: string;
        email: string | undefined;
        empresa_id: string;
        empresa_nombre: string;
        rol: string;
        estado_empresa: string;
      };
    }).user = {
      usuario_id: user.id,
      email: user.email,
      empresa_id: perfil.empresa_id,
      empresa_nombre: empresa.nombre,
      rol: perfil.rol,
      estado_empresa: empresa.estado,
    };

    return true;
  }
}
