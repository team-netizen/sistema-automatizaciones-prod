/**
 * ═══════════════════════════════════════════════════════════
 * SUPABASE CLIENT — Backend Only (Server-Side)
 * ═══════════════════════════════════════════════════════════
 *
 * Dos clientes disponibles:
 *
 * 1. supabaseAdmin  → service_role, bypassa RLS.
 *    Usar SOLO en operaciones donde el backend actúa
 *    como sistema (validaciones internas, cron, etc.)
 *
 * 2. createSupabaseServerClient(request) → usa cookies del
 *    request para autenticar al usuario final. Respeta RLS.
 *    Usar SIEMPRE en endpoints de API que atienden al usuario.
 *
 * ⚠️  Nunca importar este archivo desde el frontend.
 * ═══════════════════════════════════════════════════════════
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

// ─── Variables de entorno ────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        '[supabaseClient] Faltan variables de entorno SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY'
    );
}

// ─── Cliente Admin (service_role) — Bypassa RLS ──────────
// Solo para operaciones internas del sistema.
export const supabaseAdmin: SupabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// ─── Cliente Server con sesión del usuario — Respeta RLS ──
// Usar en API Routes para que las queries respeten RLS.
export async function createSupabaseServerClient() {
    const cookieStore = await cookies();
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // setAll puede fallar en Server Components (read-only).
                    // En Route Handlers funciona correctamente.
                }
            },
        },
        global: {
            headers: {
                Authorization: authHeader || '',
            },
        },
    });
}
