'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PerfilUsuario = {
  id: string
  empresa_id: string
  rol: 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor'
  sucursal_id: string | null
}

type PerfilRow = {
  id: string
  empresa_id: string
  rol: string
  sucursal_id: string | null
}

type Rol = PerfilUsuario['rol']

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

function esRolValido(rol: string): rol is Rol {
  return rol in rutasPorRol
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !data.user) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    const { data: perfilDataRaw, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, empresa_id, rol, sucursal_id')
      .eq('id', data.user.id)
      .single()

    if (perfilError || !perfilDataRaw) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    const perfilData = perfilDataRaw as PerfilRow

    if (!esRolValido(perfilData.rol)) {
      setError('Credenciales incorrectas')
      setLoading(false)
      return
    }

    router.push(rutasPorRol[perfilData.rol])
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#080c0e] text-white flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-[#0f2018] bg-[#090d0f] p-8 shadow-[0_0_0_1px_rgba(0,232,123,0.08)]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl tracking-wide text-[#00e87b]" style={{ fontFamily: 'Syne, sans-serif' }}>
            SISAUTO
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-[#1e3a2a] bg-[#0a0f11] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00e87b]"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-zinc-300">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-[#1e3a2a] bg-[#0a0f11] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00e87b]"
            />
          </div>

          {error ? <p className="text-sm text-[#ef4444]">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00e87b] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}
