import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

type Rol = 'super_admin' | 'admin_empresa' | 'encargado_sucursal' | 'vendedor'

const rutasPorRol: Record<Rol, string> = {
  super_admin: '/super/dashboard',
  admin_empresa: '/dashboard',
  encargado_sucursal: '/sucursal/dashboard',
  vendedor: '/pos',
}

function esRolValido(rol: string): rol is Rol {
  return rol in rutasPorRol
}

function redirigir(request: NextRequest, destino: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = destino
  url.search = ''
  return NextResponse.redirect(url)
}

function esRutaPublicaSinAuth(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/auth')) return true
  if (pathname.startsWith('/api/webhooks')) return true
  return false
}

async function obtenerRolUsuario(request: NextRequest): Promise<{
  response: NextResponse
  userId: string | null
  rol: Rol | null
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: NextResponse.next({ request }),
      userId: null,
      rol: null,
    }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response, userId: null, rol: null }
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil || typeof perfil.rol !== 'string' || !esRolValido(perfil.rol)) {
    return { response, userId: user.id, rol: null }
  }

  return { response, userId: user.id, rol: perfil.rol }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname

  if (esRutaPublicaSinAuth(pathname)) {
    return NextResponse.next({ request })
  }

  const { response, userId, rol } = await obtenerRolUsuario(request)

  if (pathname === '/login') {
    if (!userId || !rol) {
      return response
    }
    return redirigir(request, rutasPorRol[rol])
  }

  if (!userId || !rol) {
    return redirigir(request, '/login')
  }

  if (pathname.startsWith('/super') && rol !== 'super_admin') {
    return redirigir(request, rutasPorRol[rol])
  }

  if (pathname.startsWith('/dashboard') && rol !== 'admin_empresa') {
    return redirigir(request, rutasPorRol[rol])
  }

  if (pathname.startsWith('/sucursal') && rol !== 'encargado_sucursal') {
    return redirigir(request, rutasPorRol[rol])
  }

  if (pathname.startsWith('/pos') && rol !== 'vendedor') {
    return redirigir(request, rutasPorRol[rol])
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
