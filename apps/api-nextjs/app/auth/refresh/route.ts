import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGIN,
  ...(process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()) ?? []),
  'https://sistema-automatizaciones-prod.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter((value): value is string => Boolean(value))

type RefreshBody = {
  refresh_token?: string
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
    const body = (await request.json()) as RefreshBody
    const refreshToken = String(body.refresh_token ?? '')

    if (!refreshToken) {
      return withCors(NextResponse.json({ message: 'refresh_token es requerido' }, { status: 400 }), origin)
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data?.session) {
      return withCors(
        NextResponse.json({ message: 'Sesion expirada. Inicia sesion nuevamente.' }, { status: 401 }),
        origin
      )
    }

    return withCors(
      NextResponse.json({
        sesion: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      }),
      origin
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno al refrescar sesion'
    return withCors(NextResponse.json({ message }, { status: 500 }), origin)
  }
}
