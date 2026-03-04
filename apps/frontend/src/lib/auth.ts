import { createClient } from '@supabase/supabase-js';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type PerfilUsuario = {
  id: string;
  empresa_id: string;
  rol: 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor';
  sucursal_id: string | null;
};

type VerificacionSesion = {
  session: Session;
  perfil: PerfilUsuario;
};

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const ROLE_VALUES = new Set<PerfilUsuario['rol']>([
  'super_admin',
  'admin_empresa',
  'encargado_sucursal',
  'vendedor',
]);

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.error('[auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    return null;
  }

  supabaseClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
  return supabaseClient;
}

function isPerfilUsuario(value: unknown): value is PerfilUsuario {
  if (!value || typeof value !== 'object') return false;

  const row = value as Record<string, unknown>;
  const id = row.id;
  const empresaId = row.empresa_id;
  const rol = row.rol;
  const sucursalId = row.sucursal_id;

  if (typeof id !== 'string' || typeof empresaId !== 'string') return false;
  if (typeof rol !== 'string' || !ROLE_VALUES.has(rol as PerfilUsuario['rol'])) return false;
  if (typeof sucursalId !== 'string' && sucursalId !== null) return false;

  return true;
}

function getStoredTokens() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  return {
    accessToken: typeof accessToken === 'string' && accessToken.length > 0 ? accessToken : null,
    refreshToken: typeof refreshToken === 'string' && refreshToken.length > 0 ? refreshToken : null,
  };
}

async function ensureSession(client: SupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    console.error('[auth] getSession failed:', error.message);
    return null;
  }

  if (data.session) return data.session;

  const { accessToken, refreshToken } = getStoredTokens();
  if (!accessToken || !refreshToken) return null;

  const { data: restored, error: restoreError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (restoreError) {
    console.error('[auth] setSession failed:', restoreError.message);
    return null;
  }

  return restored.session ?? null;
}

export function safeParseJSON(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    localStorage.clear();
    return null;
  }
}

export async function getPerfilUsuario(): Promise<PerfilUsuario | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const session = await ensureSession(client);
  const userId = session?.user?.id;

  if (!userId) return null;

  const { data, error } = await client
    .from('perfiles')
    .select('id, empresa_id, rol, sucursal_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth] Could not fetch perfil:', error.message);
    return null;
  }

  if (!isPerfilUsuario(data)) return null;
  return data;
}

export async function verificarSesion(): Promise<VerificacionSesion | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const session = await ensureSession(client);
  if (!session) return null;

  const perfil = await getPerfilUsuario();
  if (!perfil) return null;

  return { session, perfil };
}

export async function cerrarSesion(): Promise<void> {
  const client = getSupabaseClient();

  if (client) {
    await client.auth.signOut();
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
