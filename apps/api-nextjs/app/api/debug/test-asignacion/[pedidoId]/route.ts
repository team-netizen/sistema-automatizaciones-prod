import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { testAsignarSucursalHibrido } from '@/services/testAsignacion';

function isValidDebugKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const debugKey = process.env.DEBUG_API_KEY?.trim() || '';
  const provided = req.headers.get('x-debug-key')?.trim() || '';

  // [SECURITY FIX] Endpoint de depuracion bloqueado por defecto sin credencial interna.
  if (process.env.NODE_ENV === 'production' && (!debugKey || !provided || !isValidDebugKey(provided, debugKey))) {
    return NextResponse.json({ error: 'Endpoint no disponible' }, { status: 403 });
  }

  if (!debugKey || !provided || !isValidDebugKey(provided, debugKey)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const { pedidoId } = await params;

    if (!pedidoId) {
      return NextResponse.json({ error: 'ID de pedido no proporcionado' }, { status: 400 });
    }

    const result = await testAsignarSucursalHibrido(pedidoId);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch {
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
