/**
 * ═══════════════════════════════════════════════════════════
 * MIDDLEWARE: withAuth
 * ═══════════════════════════════════════════════════════════
 *
 * HOC para API Route Handlers de Next.js App Router.
 *
 * Flujo:
 *   1. Ejecuta getUsuarioActual() para autenticar.
 *   2. Si falla → responde 401/403 con JSON.
 *   3. Si ok → pasa el usuario al handler.
 *
 * Uso:
 *   export const GET = withAuth(async (req, usuario) => {
 *     // usuario.id, usuario.empresa_id, usuario.rol
 *     return NextResponse.json({ ok: true });
 *   });
 * ═══════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioActual, UsuarioActual, AuthError } from '@/lib/auth';

// ─── Tipo del handler autenticado ────────────────────────
export type AuthenticatedHandler = (
    request: NextRequest,
    usuario: UsuarioActual,
    context?: any
) => Promise<NextResponse>;

// ─── Wrapper ─────────────────────────────────────────────
export function withAuth(handler: AuthenticatedHandler) {
    return async (request: NextRequest, context?: any) => {
        try {
            const usuario = await getUsuarioActual();
            return await handler(request, usuario, context);
        } catch (error) {
            if (error instanceof AuthError) {
                return NextResponse.json(
                    { error: error.message },
                    { status: error.status }
                );
            }

            console.error('[withAuth] Error inesperado:', error);
            return NextResponse.json(
                { error: 'Error interno de autenticación.' },
                { status: 500 }
            );
        }
    };
}
