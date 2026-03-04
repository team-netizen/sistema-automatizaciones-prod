import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getUsuarioActual, type UsuarioActual } from '@/lib/auth';
import { PermisoError, verificarEmpresaActiva, verificarModuloActivo } from '@/lib/permisos';

export type ModuloHandler = (
  request: NextRequest,
  usuario: UsuarioActual,
) => Promise<NextResponse>;

export function withModulo(codigoModulo: string, handler: ModuloHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const usuario = await getUsuarioActual();
      await verificarEmpresaActiva(usuario.empresa_id);
      await verificarModuloActivo(codigoModulo, usuario);
      return await handler(request, usuario);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      if (error instanceof PermisoError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      const message = error instanceof Error ? error.message : 'unknown_error';
      // [SECURITY FIX] Evitar logs con payloads completos.
      console.error('[withModulo] Error inesperado:', message);
      return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
  };
}
