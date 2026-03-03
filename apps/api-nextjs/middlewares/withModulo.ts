/**
 * ═══════════════════════════════════════════════════════════
 * MIDDLEWARE: withModulo
 * ═══════════════════════════════════════════════════════════
 *
 * HOC que envuelve withAuth y agrega:
 *   1. Verificación de empresa activa
 *   2. Verificación de módulo activo para la empresa
 *
 * Si la empresa está suspendida → 403
 * Si el módulo no está asignado → 403
 *
 * Uso:
 *   export const GET = withModulo('OPERACIONES', async (req, usuario) => {
 *     // usuario ya validado + empresa activa + módulo habilitado
 *     return NextResponse.json({ ok: true });
 *   });
 * ═══════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioActual, UsuarioActual, AuthError } from '@/lib/auth';
import {
    verificarModuloActivo,
    verificarEmpresaActiva,
    PermisoError,
} from '@/lib/permisos';

// ─── Tipo del handler protegido por módulo ───────────────
export type ModuloHandler = (
    request: NextRequest,
    usuario: UsuarioActual
) => Promise<NextResponse>;

// ─── Wrapper ─────────────────────────────────────────────
export function withModulo(codigoModulo: string, handler: ModuloHandler) {
    return async (request: NextRequest) => {
        try {
            // 1. Autenticar usuario
            const usuario = await getUsuarioActual();

            // 2. Verificar que la empresa esté activa
            await verificarEmpresaActiva(usuario.empresa_id);

            // 3. Verificar que el módulo esté activo para la empresa
            await verificarModuloActivo(codigoModulo, usuario);

            // 4. Ejecutar handler
            return await handler(request, usuario);
        } catch (error) {
            if (error instanceof AuthError) {
                return NextResponse.json(
                    { error: error.message },
                    { status: error.status }
                );
            }

            if (error instanceof PermisoError) {
                return NextResponse.json(
                    { error: error.message },
                    { status: error.status }
                );
            }

            console.error('[withModulo] Error inesperado:', error);
            return NextResponse.json(
                { error: 'Error interno del servidor.' },
                { status: 500 }
            );
        }
    };
}
