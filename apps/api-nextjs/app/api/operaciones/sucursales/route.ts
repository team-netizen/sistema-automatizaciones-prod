import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

export const GET = withModulo('OPERACIONES', async (_req, usuario) => {
  verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);

  const { data: sucursales, error } = await supabaseAdmin
    .from('sucursales')
    .select('id, empresa_id, nombre, tipo, direccion, activa, fecha_creacion, created_at')
    .eq('empresa_id', usuario.empresa_id)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('[operaciones/sucursales][GET]', error.message);
    return NextResponse.json({ error: 'Error al obtener sucursales.' }, { status: 500 });
  }

  return NextResponse.json({
    sucursales: sucursales ?? [],
    data: sucursales ?? [],
  });
});
