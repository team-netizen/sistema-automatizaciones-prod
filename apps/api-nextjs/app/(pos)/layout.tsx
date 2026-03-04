import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getRolUsuario } from '@/lib/auth/getRolUsuario'

export const dynamic = 'force-dynamic'

type Rol = 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor'

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

type Props = {
  children: ReactNode
}

export default async function PosLayout({ children }: Props) {
  const perfil = await getRolUsuario()

  if (!perfil) {
    redirect('/login')
  }

  if (perfil.rol !== 'vendedor') {
    redirect(rutasPorRol[perfil.rol])
  }

  return <>{children}</>
}
