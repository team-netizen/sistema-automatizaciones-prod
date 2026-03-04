import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

function isRecoverableColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? '').toLowerCase();

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

export const GET = withModulo('OPERACIONES', async (_req, usuario) => {
  verificarRol(usuario, ['admin_empresa']);

  let response = await supabaseAdmin
    .from('integraciones_canal')
    .select('*')
    .eq('empresa_id', usuario.empresa_id)
    .order('fecha_creacion', { ascending: false });

  if (response.error && isRecoverableColumnError(response.error)) {
    response = await supabaseAdmin
      .from('integraciones_canal')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .order('created_at', { ascending: false });
  }

  if (response.error) {
    console.error('[operaciones/integraciones][GET]', response.error.message);
    return NextResponse.json({ error: 'Error al obtener integraciones.' }, { status: 500 });
  }

  const integraciones = (response.data ?? []) as Array<Record<string, unknown>>;
  const canalIds = [
    ...new Set(
      integraciones
        .map((row) => row.canal_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const canalMap = new Map<string, string>();
  if (canalIds.length > 0) {
    const { data: canales, error: canalesError } = await supabaseAdmin
      .from('canales_venta')
      .select('id, nombre')
      .eq('empresa_id', usuario.empresa_id)
      .in('id', canalIds);

    if (canalesError) {
      console.error('[operaciones/integraciones][GET] canales error:', canalesError.message);
      return NextResponse.json(
        { error: 'Error al resolver los canales de venta.' },
        { status: 500 },
      );
    }

    for (const canal of canales ?? []) {
      const id = typeof canal.id === 'string' ? canal.id : null;
      const nombre = typeof canal.nombre === 'string' ? canal.nombre : null;
      if (id && nombre) canalMap.set(id, nombre);
    }
  }

  const mapped = integraciones.map((row) => {
    const canalId = typeof row.canal_id === 'string' ? row.canal_id : null;
    return {
      ...row,
      canal: canalId ? canalMap.get(canalId) ?? null : null,
    };
  });

  return NextResponse.json({
    integraciones: mapped,
    data: mapped,
  });
});
