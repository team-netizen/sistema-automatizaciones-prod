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

type StockRow = {
  cantidad: number | null
}

type PedidoRow = {
  id: string
  estado: string | null
  total: number | null
  fecha_creacion: string | null
}

function toNumber(value: number | null): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return value
}

export default async function SucursalDashboardPage() {
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

  const [stockRes, pedidosRes] = await Promise.all([
    supabase
      .from('stock_por_sucursal')
      .select('cantidad')
      .eq('empresa_id', perfil.empresa_id)
      .eq('sucursal_id', perfil.sucursal_id),
    supabase
      .from('pedidos')
      .select('id, estado, total, fecha_creacion')
      .eq('empresa_id', perfil.empresa_id)
      .eq('sucursal_asignada_id', perfil.sucursal_id)
      .order('fecha_creacion', { ascending: false })
      .limit(10),
  ])

  const stock = (stockRes.data ?? []) as StockRow[]
  const pedidos = (pedidosRes.data ?? []) as PedidoRow[]

  const stockTotal = stock.reduce((acc, row) => acc + toNumber(row.cantidad), 0)
  const pedidosActivos = pedidos.filter((row) => row.estado !== 'cancelado').length
  const ventas = pedidos.reduce((acc, row) => acc + toNumber(row.total), 0)

  return (
    <main className="min-h-screen bg-[#080c0e] text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard de Sucursal</h1>
        <p className="text-sm text-zinc-400">Sucursal asignada: {perfil.sucursal_id}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3 mb-6">
        <article className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
          <p className="text-xs text-zinc-400">Stock Total</p>
          <p className="text-2xl font-bold text-[#00e87b]">{stockTotal}</p>
        </article>
        <article className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
          <p className="text-xs text-zinc-400">Pedidos Activos</p>
          <p className="text-2xl font-bold text-[#00e87b]">{pedidosActivos}</p>
        </article>
        <article className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
          <p className="text-xs text-zinc-400">Ventas Recientes</p>
          <p className="text-2xl font-bold text-[#00e87b]">${ventas.toFixed(2)}</p>
        </article>
      </section>

      <section className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Pedidos recientes</h2>
        <div className="space-y-2">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="flex items-center justify-between rounded-lg border border-[#163225] bg-[#0b1215] px-3 py-2 text-sm"
            >
              <span className="text-zinc-300">{pedido.id}</span>
              <span className="text-zinc-400">{pedido.estado ?? 'sin estado'}</span>
              <span className="text-[#00e87b]">${toNumber(pedido.total).toFixed(2)}</span>
            </div>
          ))}
          {pedidos.length === 0 ? <p className="text-sm text-zinc-500">Sin pedidos recientes.</p> : null}
        </div>
      </section>
    </main>
  )
}
