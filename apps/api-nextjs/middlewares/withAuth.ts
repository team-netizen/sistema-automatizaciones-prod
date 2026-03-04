import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getUsuarioActual, type UsuarioActual } from '@/lib/auth';

export type AuthenticatedHandler = (
  request: NextRequest,
  usuario: UsuarioActual,
  context?: any,
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      const usuario = await getUsuarioActual();
      return await handler(request, usuario, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      const message = error instanceof Error ? error.message : 'unknown_error';
      // [SECURITY FIX] No registrar objetos completos que puedan contener datos sensibles.
      console.error('[withAuth] Error inesperado:', message);
      return NextResponse.json({ error: 'Error interno de autenticacion.' }, { status: 500 });
    }
  };
}
