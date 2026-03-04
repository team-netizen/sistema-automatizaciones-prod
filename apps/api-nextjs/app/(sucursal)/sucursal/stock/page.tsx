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

type StockItemRow = {
  producto_id: string
  cantidad: number | null
  cantidad_reservada: number | null
}

export default async function SucursalStockPage() {
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
    .from('stock_por_sucursal')
    .select('producto_id, cantidad, cantidad_reservada')
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_id', perfil.sucursal_id)
    .order('producto_id', { ascending: true })
    .limit(200)

  const items = (data ?? []) as StockItemRow[]

  return (
    <main className="min-h-screen bg-[#080c0e] text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Stock de Sucursal</h1>
        <p className="text-sm text-zinc-400">Sucursal: {perfil.sucursal_id}</p>
      </header>

      <section className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Inventario</h2>
        <div className="space-y-2">
          {items.map((item) => {
            const cantidad = typeof item.cantidad === 'number' ? item.cantidad : 0
            const reservada = typeof item.cantidad_reservada === 'number' ? item.cantidad_reservada : 0
            const disponible = cantidad - reservada

            return (
              <div
                key={item.producto_id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-[#163225] bg-[#0b1215] px-3 py-2 text-sm md:grid-cols-4"
              >
                <span className="text-zinc-300">{item.producto_id}</span>
                <span className="text-zinc-400">Total: {cantidad}</span>
                <span className="text-zinc-400">Reservado: {reservada}</span>
                <span className="text-[#00e87b]">Disponible: {disponible}</span>
              </div>
            )
          })}
          {items.length === 0 ? <p className="text-sm text-zinc-500">No hay stock registrado.</p> : null}
        </div>
      </section>
    </main>
  )
}
