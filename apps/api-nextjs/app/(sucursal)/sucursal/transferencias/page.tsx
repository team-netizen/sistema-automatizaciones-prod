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

type TransferenciaRow = {
  id: string
  numero_guia: string | null
  estado: string | null
  fecha_creacion: string | null
  sucursal_origen_id: string
  sucursal_destino_id: string
}

export default async function SucursalTransferenciasPage() {
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

  const [origenRes, destinoRes] = await Promise.all([
    supabase
      .from('transferencias_stock')
      .select('id, numero_guia, estado, fecha_creacion, sucursal_origen_id, sucursal_destino_id')
      .eq('empresa_id', perfil.empresa_id)
      .eq('sucursal_origen_id', perfil.sucursal_id)
      .order('fecha_creacion', { ascending: false })
      .limit(50),
    supabase
      .from('transferencias_stock')
      .select('id, numero_guia, estado, fecha_creacion, sucursal_origen_id, sucursal_destino_id')
      .eq('empresa_id', perfil.empresa_id)
      .eq('sucursal_destino_id', perfil.sucursal_id)
      .order('fecha_creacion', { ascending: false })
      .limit(50),
  ])

  const map = new Map<string, TransferenciaRow>()
  for (const row of (origenRes.data ?? []) as TransferenciaRow[]) {
    map.set(row.id, row)
  }
  for (const row of (destinoRes.data ?? []) as TransferenciaRow[]) {
    map.set(row.id, row)
  }

  const transferencias = [...map.values()].sort((a, b) => {
    const fa = a.fecha_creacion ?? ''
    const fb = b.fecha_creacion ?? ''
    if (fa > fb) return -1
    if (fa < fb) return 1
    return 0
  })

  return (
    <main className="min-h-screen bg-[#080c0e] text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Transferencias de Sucursal</h1>
        <p className="text-sm text-zinc-400">Sucursal: {perfil.sucursal_id}</p>
      </header>

      <section className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Movimientos recientes</h2>
        <div className="space-y-2">
          {transferencias.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-[#163225] bg-[#0b1215] px-3 py-2 text-sm md:grid-cols-5"
            >
              <span className="text-zinc-300">{item.numero_guia ?? item.id}</span>
              <span className="text-zinc-400">{item.estado ?? 'sin estado'}</span>
              <span className="text-zinc-400">Origen: {item.sucursal_origen_id}</span>
              <span className="text-zinc-400">Destino: {item.sucursal_destino_id}</span>
              <span className="text-zinc-500">{item.fecha_creacion ?? '-'}</span>
            </div>
          ))}
          {transferencias.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay transferencias para esta sucursal.</p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
