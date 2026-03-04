import { createClient } from '@/lib/supabase/server'

export type PerfilUsuario = {
  id: string
  empresa_id: string
  rol: 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor'
  sucursal_id: string | null
}

const ROLES_VALIDOS: ReadonlyArray<PerfilUsuario['rol']> = [
  'super_admin',
  'admin_empresa',
  'encargado_sucursal',
  'vendedor',
]

type PerfilRow = {
  id: string
  empresa_id: string
  rol: string
  sucursal_id: string | null
}

function esRolValido(rol: string): rol is PerfilUsuario['rol'] {
  return ROLES_VALIDOS.includes(rol as PerfilUsuario['rol'])
}

export async function getRolUsuario(): Promise<PerfilUsuario | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, empresa_id, rol, sucursal_id')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const perfil = data as PerfilRow

  if (!esRolValido(perfil.rol)) {
    return null
  }

  if (
    (perfil.rol === 'encargado_sucursal' || perfil.rol === 'vendedor') &&
    !perfil.sucursal_id
  ) {
    return null
  }

  return {
    id: perfil.id,
    empresa_id: perfil.empresa_id,
    rol: perfil.rol,
    sucursal_id: perfil.sucursal_id,
  }
}
