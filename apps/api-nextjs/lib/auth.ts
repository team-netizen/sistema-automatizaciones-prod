/**
 * ═══════════════════════════════════════════════════════════
 * AUTH — Autenticación y perfil del usuario actual
 * ═══════════════════════════════════════════════════════════
 *
 * getUsuarioActual():
 *   1. Lee la sesión desde cookies (auth.getUser)
 *   2. Busca el perfil en tabla `perfiles`
 *   3. Retorna { id, empresa_id, rol } o lanza error 401
 *
 * ⚠️  Siempre usar supabaseAdmin para la consulta de perfil
 *     porque el cliente con sesión podría no tener acceso
 *     si las RLS no lo permiten durante la carga inicial.
 * ═══════════════════════════════════════════════════════════
 */

import { createSupabaseServerClient, supabaseAdmin } from './supabaseClient';
import { headers } from 'next/headers';

// ─── Tipos ───────────────────────────────────────────────
export type Rol = 'super_admin' | 'owner' | 'admin' | 'empleado' | 'lector';

export interface UsuarioActual {
    id: string;
    empresa_id: string;
    rol: Rol;
}

// ─── Error de autenticación ──────────────────────────────
export class AuthError extends Error {
    status: number;

    constructor(message: string, status: number = 401) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
    }
}

// ─── Obtener usuario autenticado ─────────────────────────
export async function getUsuarioActual(): Promise<UsuarioActual> {
    const supabase = await createSupabaseServerClient();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    // Detectar tokens "basura" que el frontend podría enviar por error
    const bearerToken = (authHeader?.startsWith('Bearer ') && authHeader.length > 12)
        ? authHeader.substring(7)
        : null;

    console.log('[AUTH] authHeader:', authHeader ? 'Presente' : 'Ausente');
    if (bearerToken) {
        // Log truncado para seguridad
        console.log('[AUTH] bearerToken detectado:', `${bearerToken.substring(0, 10)}...`);
    }

    let user = null;

    // 1. Intentar autenticar con token Bearer
    if (bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined') {
        const { data, error } = await supabase.auth.getUser(bearerToken);
        if (error) {
            console.error('[AUTH] Error al validar token Bearer:', error.message);
        }
        user = data?.user;
    }

    // 2. Si no hay token, intentar con cookies
    if (!user) {
        const {
            data: { user: cookieUser },
            error: cookieError
        } = await supabase.auth.getUser();
        if (cookieError) {
            // Solo loggeamos si no es un error de "no session" típico
            if (!cookieError.message.includes('not found')) {
                console.error('[AUTH] Error al validar cookies:', cookieError.message);
            }
        }
        user = cookieUser;
    }

    if (!user) {
        console.warn('[AUTH] No se encontró usuario en token ni en cookies (401).');
        throw new AuthError('No autenticado. Inicia sesión para continuar.');
    }

    console.log('[AUTH] Usuario autenticado:', user.id, user.email);

    // 2. Buscar perfil en tabla perfiles (con supabaseAdmin para bypass RLS)
    const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('perfiles')
        .select('id, empresa_id, rol')
        .eq('id', user.id)
        .single();

    if (perfilError || !perfil) {
        throw new AuthError(
            'Perfil no encontrado. Contacta al administrador.',
            403
        );
    }

    // 3. Validar que el perfil tenga empresa asignada
    if (!perfil.empresa_id) {
        throw new AuthError(
            'Usuario sin empresa asignada. Contacta al administrador.',
            403
        );
    }

    return {
        id: perfil.id,
        empresa_id: perfil.empresa_id,
        rol: perfil.rol as Rol,
    };
}

// ─── Helper: ¿Es super admin? ───────────────────────────
export function esSuperAdmin(usuario: UsuarioActual): boolean {
    return usuario.rol === 'super_admin';
}
