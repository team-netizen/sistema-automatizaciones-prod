'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type PerfilUsuario = {
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

type UsePerfilUsuarioReturn = {
  perfil: PerfilUsuario | null
  loading: boolean
  error: string | null
  recargarPerfil: () => Promise<void>
}

const ROLES_VALIDOS: ReadonlyArray<PerfilUsuario['rol']> = [
  'super_admin',
  'admin_empresa',
  'encargado_sucursal',
  'vendedor',
]

function esRolValido(rol: string): rol is PerfilUsuario['rol'] {
  return ROLES_VALIDOS.includes(rol as PerfilUsuario['rol'])
}

export function usePerfilUsuario(): UsePerfilUsuarioReturn {
  const supabase = useMemo(() => createClient(), [])
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const recargarPerfil = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setPerfil(null)
      setLoading(false)
      return
    }

    const { data, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, empresa_id, rol, sucursal_id')
      .eq('id', user.id)
      .maybeSingle()

    if (perfilError || !data) {
      setPerfil(null)
      setError('No se pudo obtener el perfil del usuario')
      setLoading(false)
      return
    }

    const perfilRow = data as PerfilRow

    if (!esRolValido(perfilRow.rol)) {
      setPerfil(null)
      setError('Rol de usuario inválido')
      setLoading(false)
      return
    }

    if (
      (perfilRow.rol === 'encargado_sucursal' || perfilRow.rol === 'vendedor') &&
      !perfilRow.sucursal_id
    ) {
      setPerfil(null)
      setError('El usuario requiere una sucursal asignada')
      setLoading(false)
      return
    }

    setPerfil({
      id: perfilRow.id,
      empresa_id: perfilRow.empresa_id,
      rol: perfilRow.rol,
      sucursal_id: perfilRow.sucursal_id,
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void recargarPerfil()
  }, [recargarPerfil])

  return {
    perfil,
    loading,
    error,
    recargarPerfil,
  }
}
