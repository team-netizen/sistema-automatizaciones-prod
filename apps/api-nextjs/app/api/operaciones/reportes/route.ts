import { NextResponse } from 'next/server';
import { withModulo } from '@/middlewares/withModulo';
import { supabaseAdmin } from '@/lib/supabaseClient';

async function getPedidosConfirmados(empresaId: string) {
  const firstTry = await supabaseAdmin
    .from('pedidos')
    .select('total, canal_id, fecha_creacion')
    .eq('empresa_id', empresaId)
    .eq('estado', 'confirmado');

  if (!firstTry.error) {
    return { data: firstTry.data || [], error: null };
  }

  const code = String(firstTry.error.code || '');
  const message = String(firstTry.error.message || '').toLowerCase();
  const canRetry = code === '42703' || code === 'PGRST204' || message.includes('column');

  if (!canRetry) {
    return { data: null, error: firstTry.error };
  }

  const secondTry = await supabaseAdmin
    .from('pedidos')
    .select('total, canal_id, created_at')
    .eq('empresa_id', empresaId)
    .eq('estado', 'confirmado');

  if (!secondTry.error) {
    return { data: secondTry.data || [], error: null };
  }

  return { data: null, error: secondTry.error };
}

export const GET = withModulo('OPERACIONES', async (_req, usuario) => {
  const { empresa_id } = usuario;

  const { data: pedidos, error: errorPedidos } = await getPedidosConfirmados(empresa_id);

  if (errorPedidos) {
    console.error('[reportes/GET] errorPedidos:', errorPedidos);
  }

  const totalVentas = pedidos?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0;
  const totalPedidos = pedidos?.length || 0;
  const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

  const { data: canales } = await supabaseAdmin
    .from('canales_venta')
    .select('id, nombre')
    .eq('empresa_id', empresa_id);

  const canalesDistribucion =
    canales?.map((c) => {
      const count = pedidos?.filter((p) => p.canal_id === c.id).length || 0;
      const porcentaje = totalPedidos > 0 ? (count / totalPedidos) * 100 : 0;
      return {
        nombre: c.nombre,
        porcentaje: Math.round(porcentaje),
        color: '#22C55E',
      };
    }) || [];

  return NextResponse.json({
    resumen: {
      ventas: totalVentas,
      pedidos: totalPedidos,
      ticket_promedio: ticketPromedio,
    },
    top_productos: [],
    canales: canalesDistribucion,
    proyeccion: [30, 45, 25, 60, 40, 70, 50, 35, 65, 55, 45, 60, 75],
  });
});
