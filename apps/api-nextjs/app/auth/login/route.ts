import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGIN,
  ...(process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()) ?? []),
  'https://sistema-automatizaciones-prod.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter((value): value is string => Boolean(value))

type LoginBody = {
  email?: string
  password?: string
}

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

function withCors(response: NextResponse, origin: string | null): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Vary', 'Origin')
  }

  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  return response
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const origin = resolveAllowedOrigin(request)
  if (!origin && request.headers.get('origin')) {
    return NextResponse.json({ message: 'Origen no permitido por CORS' }, { status: 403 })
  }
  return withCors(new NextResponse(null, { status: 204 }), origin)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = resolveAllowedOrigin(request)
  if (!origin && request.headers.get('origin')) {
    return NextResponse.json({ message: 'Origen no permitido por CORS' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as LoginBody
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')

    if (!email || !password) {
      return withCors(
        NextResponse.json({ message: 'Email y contrasena son requeridos' }, { status: 400 }),
        origin
      )
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.session || !authData.user) {
      return withCors(NextResponse.json({ message: 'Credenciales invalidas' }, { status: 401 }), origin)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('id, empresa_id, rol')
      .eq('id', authData.user.id)
      .single()

    if (perfilError || !perfil) {
      return withCors(
        NextResponse.json(
          { message: 'Perfil de usuario no encontrado o error de base de datos. Contacta al administrador.' },
          { status: 403 }
        ),
        origin
      )
    }

    return withCors(
      NextResponse.json({
        sesion: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
        usuario: {
          id: perfil.id,
          email: authData.user.email,
          nombre: authData.user.user_metadata?.full_name || email.split('@')[0],
          empresa_id: perfil.empresa_id,
          rol: perfil.rol,
        },
      }),
      origin
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return withCors(NextResponse.json({ message }, { status: 500 }), origin)
  }
}
