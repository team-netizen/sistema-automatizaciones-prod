import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { ROLES_KEY } from './roles.decorator';

export type PerfilUsuario = {
  id: string;
  empresa_id: string;
  rol: 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor';
  sucursal_id: string | null;
};

type AuthenticatedRequest = Request & {
  perfil?: PerfilUsuario;
};

const ROLES_VALIDOS = new Set<PerfilUsuario['rol']>([
  'super_admin',
  'admin_empresa',
  'encargado_sucursal',
  'vendedor',
]);

type JwtPayload = {
  exp?: number;
  aud?: string | string[];
  iss?: string;
};

function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function parseJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as JwtPayload;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function isAudienceAllowed(aud: JwtPayload['aud']): boolean {
  if (typeof aud === 'string') return aud === 'authenticated';
  if (Array.isArray(aud)) return aud.includes('authenticated');
  return false;
}

function validateJwtClaims(token: string): void {
  const payload = parseJwtPayload(token);
  if (!payload) {
    throw new UnauthorizedException('Token invalido');
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || nowInSeconds >= payload.exp) {
    // [SECURITY FIX] Rechaza tokens expirados antes de consultar recursos.
    throw new UnauthorizedException('Token expirado');
  }

  if (!isAudienceAllowed(payload.aud)) {
    // [SECURITY FIX] Fuerza audience esperada de Supabase Auth.
    throw new UnauthorizedException('Audience de token invalida');
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '') ?? '';
  if (supabaseUrl) {
    const expectedIssuers = new Set([`${supabaseUrl}/auth/v1`, `${supabaseUrl}/auth/v1/`]);
    if (!payload.iss || !expectedIssuers.has(payload.iss)) {
      // [SECURITY FIX] Rechaza tokens con issuer distinto al proyecto Supabase configurado.
      throw new UnauthorizedException('Issuer de token invalido');
    }
  }
}

function toPerfilUsuario(data: unknown): PerfilUsuario | null {
  if (!data || typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;
  const id = row.id;
  const empresaId = row.empresa_id;
  const rol = row.rol;
  const sucursalId = row.sucursal_id;

  if (typeof id !== 'string') return null;
  if (typeof empresaId !== 'string') return null;
  if (typeof rol !== 'string' || !ROLES_VALIDOS.has(rol as PerfilUsuario['rol'])) return null;
  if (typeof sucursalId !== 'string' && sucursalId !== null) return null;

  return {
    id,
    empresa_id: empresaId,
    rol: rol as PerfilUsuario['rol'],
    sucursal_id: sucursalId,
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requiredRoles =
      this.reflector.getAllAndOverride<PerfilUsuario['rol'][]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Token de autenticacion requerido');
    }

    // [SECURITY FIX] Validacion explicita de claims criticos del JWT.
    validateJwtClaims(token);

    const {
      data: { user },
      error: authError,
    } = await this.supabaseService.getAdminClient().auth.getUser(token);

    if (authError || !user) {
      throw new UnauthorizedException('Token invalido o expirado');
    }

    const { data: perfilRaw, error: perfilError } = await this.supabaseService
      .getAdminClient()
      .from('perfiles')
      .select('id, empresa_id, rol, sucursal_id')
      .eq('id', user.id)
      .maybeSingle();

    if (perfilError || !perfilRaw) {
      throw new ForbiddenException('Perfil no encontrado');
    }

    const perfil = toPerfilUsuario(perfilRaw);
    if (!perfil) {
      throw new ForbiddenException('Perfil invalido');
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(perfil.rol)) {
      throw new ForbiddenException('No tienes permisos para este recurso');
    }

    request.perfil = perfil;
    return true;
  }
}
