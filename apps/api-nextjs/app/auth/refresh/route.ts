import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return NextResponse.json(
        { message: 'refresh_token es requerido' },
        { status: 400 }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token,
    });

    if (error || !data?.session) {
      return NextResponse.json(
        { message: 'Sesion expirada. Inicia sesion nuevamente.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      sesion: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Error interno al refrescar sesion' },
      { status: 500 }
    );
  }
}
