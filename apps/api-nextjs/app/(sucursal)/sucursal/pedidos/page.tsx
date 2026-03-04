import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolUsuario, type PerfilUsuario } from '@/lib/auth/getRolUsuario'

type Rol = PerfilUsuario['rol']

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

type PedidoRow = {
  id: string
  id_orden: string | null
  estado: string | null
  total: number | null
  nombre_cliente: string | null
  medio_pedido: string | null
  fecha_creacion: string | null
}

export default async function SucursalPedidosPage() {
  const perfil = await getRolUsuario()

  if (!perfil) {
    redirect('/login')
  }

  if (perfil.rol !== 'encargado_sucursal') {
    redirect(rutasPorRol[perfil.rol])
  }

  if (!perfil.sucursal_id) {
    redirect('/login')
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('pedidos')
    .select('id, id_orden, estado, total, nombre_cliente, medio_pedido, fecha_creacion')
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_asignada_id', perfil.sucursal_id)
    .order('fecha_creacion', { ascending: false })
    .limit(50)

  const pedidos = (data ?? []) as PedidoRow[]

  return (
    <main className="min-h-screen bg-[#080c0e] text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Pedidos de Sucursal</h1>
        <p className="text-sm text-zinc-400">Sucursal: {perfil.sucursal_id}</p>
      </header>

      <section className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Últimos pedidos</h2>
        <div className="space-y-2">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-[#163225] bg-[#0b1215] px-3 py-2 text-sm md:grid-cols-6"
            >
              <span className="text-zinc-300">{pedido.id_orden ?? pedido.id}</span>
              <span className="text-zinc-400">{pedido.nombre_cliente ?? 'Sin cliente'}</span>
              <span className="text-zinc-400">{pedido.estado ?? 'sin estado'}</span>
              <span className="text-zinc-400">{pedido.medio_pedido ?? 'sin canal'}</span>
              <span className="text-[#00e87b]">
                ${typeof pedido.total === 'number' ? pedido.total.toFixed(2) : '0.00'}
              </span>
              <span className="text-zinc-500">{pedido.fecha_creacion ?? '-'}</span>
            </div>
          ))}
          {pedidos.length === 0 ? <p className="text-sm text-zinc-500">No hay pedidos para esta sucursal.</p> : null}
        </div>
      </section>
    </main>
  )
}
