import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function isValidDebugKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const debugKey = process.env.DEBUG_API_KEY?.trim() || '';
  const provided = req.headers.get('x-debug-key')?.trim() || '';

  // [SECURITY FIX] Bloquea endpoint sensible por defecto en produccion.
  if (process.env.NODE_ENV === 'production' && (!debugKey || !provided || !isValidDebugKey(provided, debugKey))) {
    return NextResponse.json({ error: 'Endpoint no disponible' }, { status: 403 });
  }

  if (!debugKey || !provided || !isValidDebugKey(provided, debugKey)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const { data: perfiles, error } = await supabaseAdmin
      .from('perfiles')
      .select('id, empresa_id, rol')
      .limit(50);

    if (error) {
      return NextResponse.json({ error: 'No se pudo consultar perfiles' }, { status: 500 });
    }

    return NextResponse.json({ perfiles: perfiles ?? [] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
