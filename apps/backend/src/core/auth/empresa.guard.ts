import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { PerfilUsuario } from './roles.guard';

type RequestWithPerfil = Request & {
  perfil?: PerfilUsuario;
};

type TableName =
  | 'sucursales'
  | 'productos'
  | 'pedidos'
  | 'transferencias'
  | 'transferencias_stock'
  | 'movimientos_stock';

type ResourceCheck = {
  id: string;
  table: TableName;
  source: string;
};

function normalizeEmpresaId(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readValueFromBody(req: Request, key: string): string | null {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return null;
  }

  const raw = (req.body as Record<string, unknown>)[key];
  return normalizeEmpresaId(raw);
}

function readValueFromQuery(req: Request, key: string): string | null {
  const raw = req.query?.[key];
  if (Array.isArray(raw)) {
    return normalizeEmpresaId(raw[0]);
  }
  return normalizeEmpresaId(raw);
}

function readValueFromParams(req: Request, key: string): string | null {
  const raw = req.params?.[key];
  return normalizeEmpresaId(raw);
}

function getRoutePath(req: Request): string {
  const routePath = (req.route as { path?: string } | undefined)?.path;
  return typeof routePath === 'string' ? routePath : '';
}

function collectResourceChecks(req: Request): ResourceCheck[] {
  const checks: ResourceCheck[] = [];

  const map: Array<{ key: string; table: TableName }> = [
    { key: 'sucursal_id', table: 'sucursales' },
    { key: 'sucursal_origen_id', table: 'sucursales' },
    { key: 'sucursal_destino_id', table: 'sucursales' },
    { key: 'producto_id', table: 'productos' },
    { key: 'pedido_id', table: 'pedidos' },
    { key: 'movimiento_id', table: 'movimientos_stock' },
    { key: 'transferencia_id', table: 'transferencias' },
  ];

  for (const entry of map) {
    const fromQuery = readValueFromQuery(req, entry.key);
    const fromBody = readValueFromBody(req, entry.key);
    const fromParams = readValueFromParams(req, entry.key);

    if (fromQuery) checks.push({ id: fromQuery, table: entry.table, source: `query.${entry.key}` });
    if (fromBody) checks.push({ id: fromBody, table: entry.table, source: `body.${entry.key}` });
    if (fromParams) checks.push({ id: fromParams, table: entry.table, source: `params.${entry.key}` });
  }

  const routePath = getRoutePath(req);
  const pathId = readValueFromParams(req, 'id');
  if (pathId) {
    if (routePath.includes('transferencias')) {
      checks.push({ id: pathId, table: 'transferencias', source: 'params.id' });
    } else if (routePath.includes('productos')) {
      checks.push({ id: pathId, table: 'productos', source: 'params.id' });
    } else if (routePath.includes('sucursales')) {
      checks.push({ id: pathId, table: 'sucursales', source: 'params.id' });
    } else if (routePath.includes('pedidos')) {
      checks.push({ id: pathId, table: 'pedidos', source: 'params.id' });
    }
  }

  const dedup = new Map<string, ResourceCheck>();
  for (const check of checks) {
    dedup.set(`${check.table}:${check.id}:${check.source}`, check);
  }

  return [...dedup.values()];
}

@Injectable()
export class EmpresaGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithPerfil>();
    const perfil = req.perfil;

    if (!perfil) {
      throw new UnauthorizedException('Perfil no disponible en request');
    }

    if (perfil.rol === 'super_admin') {
      return true;
    }

    const empresaPerfil = normalizeEmpresaId(perfil.empresa_id);
    if (!empresaPerfil) {
      throw new ForbiddenException('Empresa de perfil invalida');
    }

    const empresaQuery = readValueFromQuery(req, 'empresa_id');
    const empresaBody = readValueFromBody(req, 'empresa_id');

    if (empresaQuery && empresaQuery !== empresaPerfil) {
      // [SECURITY FIX] Evita override de tenant desde query.
      throw new ForbiddenException('empresa_id de query no autorizado');
    }

    if (empresaBody && empresaBody !== empresaPerfil) {
      // [SECURITY FIX] Evita override de tenant desde body.
      throw new ForbiddenException('empresa_id de body no autorizado');
    }

    // [SECURITY FIX] BOLA/IDOR: valida pertenencia tenant para IDs de recursos referenciados.
    const resourceChecks = collectResourceChecks(req);

    for (const check of resourceChecks) {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .from(check.table)
        .select('id')
        .eq('id', check.id)
        .eq('empresa_id', empresaPerfil)
        .maybeSingle();

      if (error || !data) {
        throw new ForbiddenException(
          `El recurso ${check.source} no pertenece a la empresa autenticada`,
        );
      }
    }

    return true;
  }
}
