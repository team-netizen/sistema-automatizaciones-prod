import { headers } from 'next/headers';
import { createSupabaseServerClient, supabaseAdmin } from './supabaseClient';

export type Rol = 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor';

export interface UsuarioActual {
  id: string;
  empresa_id: string;
  rol: Rol;
  sucursal_id?: string | null;
}

const ROLES_VALIDOS: ReadonlySet<Rol> = new Set([
  'super_admin',
  'admin_empresa',
  'encargado_sucursal',
  'vendedor',
]);

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function normalizeRol(rol: unknown): Rol | null {
  if (typeof rol !== 'string') return null;
  return ROLES_VALIDOS.has(rol as Rol) ? (rol as Rol) : null;
}

export async function getUsuarioActual(): Promise<UsuarioActual> {
  const supabase = await createSupabaseServerClient();
  const headersList = await headers();
  const authHeader = headersList.get('Authorization');
  const bearerToken = parseBearerToken(authHeader);

  let userId: string | null = null;

  if (bearerToken) {
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (!error && data?.user?.id) {
      userId = data.user.id;
    }
  }

  if (!userId) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
      throw new AuthError('No autenticado. Inicia sesion para continuar.', 401);
    }

    userId = user.id;
  }

  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from('perfiles')
    .select('id, empresa_id, rol, sucursal_id')
    .eq('id', userId)
    .single();

  if (perfilError || !perfil) {
    throw new AuthError('Perfil no encontrado. Contacta al administrador.', 403);
  }

  const rol = normalizeRol(perfil.rol);
  if (!rol) {
    throw new AuthError('Rol de usuario invalido.', 403);
  }

  if (!perfil.empresa_id || typeof perfil.empresa_id !== 'string') {
    throw new AuthError('Usuario sin empresa asignada.', 403);
  }

  return {
    id: String(perfil.id),
    empresa_id: String(perfil.empresa_id),
    rol,
    sucursal_id:
      typeof perfil.sucursal_id === 'string' && perfil.sucursal_id.length > 0
        ? perfil.sucursal_id
        : null,
  };
}

export function esSuperAdmin(usuario: UsuarioActual): boolean {
  return usuario.rol === 'super_admin';
}
