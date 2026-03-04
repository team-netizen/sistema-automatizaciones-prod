import { redirect } from 'next/navigation'
import { getRolUsuario, type PerfilUsuario } from '@/lib/auth/getRolUsuario'

type Rol = PerfilUsuario['rol']

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

export default async function PosPage() {
  const perfil = await getRolUsuario()

  if (!perfil) {
    redirect('/login')
  }

  if (perfil.rol !== 'vendedor') {
    redirect(rutasPorRol[perfil.rol])
  }

  return (
    <main className="min-h-screen bg-[#080c0e] text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Punto de Venta</h1>
        <p className="text-sm text-zinc-400">Usuario: {perfil.id}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">Venta rápida</h2>
          <p className="text-sm text-zinc-400">
            Aquí puedes conectar tu componente de caja para registrar ventas en tiempo real.
          </p>
        </article>

        <article className="rounded-xl border border-[#1e3a2a] bg-[#0a0f11] p-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">Sucursal asignada</h2>
          <p className="text-sm text-zinc-400">{perfil.sucursal_id ?? 'Sin sucursal asignada'}</p>
        </article>
      </section>
    </main>
  )
}
