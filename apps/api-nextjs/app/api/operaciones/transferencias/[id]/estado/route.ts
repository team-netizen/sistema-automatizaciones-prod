import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verificarRol } from '@/lib/permisos';

const VALID_ESTADOS = new Set(['en_transito', 'recibido', 'cancelado']);

export const PATCH = withModulo('OPERACIONES', async (req, usuario) => {
  verificarRol(usuario, ['admin_empresa', 'encargado_sucursal']);

  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const idx = segments.findIndex((segment) => segment === 'transferencias');
  const transferenciaId = idx >= 0 ? segments[idx + 1] : null;

  if (!transferenciaId) {
    return NextResponse.json({ error: 'ID de transferencia invalido.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const estado = String(body?.estado ?? '');

  if (!VALID_ESTADOS.has(estado)) {
    return NextResponse.json(
      { error: 'Estado invalido. Valores permitidos: en_transito, recibido, cancelado.' },
      { status: 400 },
    );
  }

  const { data: transferencia, error: fetchError } = await supabaseAdmin
    .from('transferencias_stock')
    .select('id, empresa_id, sucursal_origen_id, sucursal_destino_id')
    .eq('id', transferenciaId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle();

  if (fetchError || !transferencia) {
    return NextResponse.json({ error: 'Transferencia no encontrada.' }, { status: 404 });
  }

  if (usuario.rol === 'encargado_sucursal' && usuario.sucursal_id) {
    const participaSucursal =
      transferencia.sucursal_origen_id === usuario.sucursal_id ||
      transferencia.sucursal_destino_id === usuario.sucursal_id;

    if (!participaSucursal) {
      return NextResponse.json(
        { error: 'No puedes modificar transferencias de otra sucursal.' },
        { status: 403 },
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('transferencias_stock')
    .update({ estado })
    .eq('id', transferenciaId)
    .eq('empresa_id', usuario.empresa_id)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[operaciones/transferencias/:id/estado][PATCH]', error?.message ?? 'unknown_error');
    return NextResponse.json(
      { error: 'No se pudo actualizar el estado de la transferencia.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
});
