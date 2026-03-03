/**
 * ═══════════════════════════════════════════════════════════
 * POST /auth/login — Autenticación de usuario
 * ═══════════════════════════════════════════════════════════
 * 
 * Flujo:
 *   1. Recibe email y password
 *   2. Autentica contra Supabase Auth
 *   3. Busca perfil del usuario (empresa, rol)
 *   4. Retorna sesión + datos del usuario
 * ═══════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: 'Email y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // 1. Autenticar con Supabase Auth
        const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.error('[AUTH_LOGIN] Error de autenticación:', authError.message);
            return NextResponse.json(
                { message: 'Credenciales inválidas' },
                { status: 401 }
            );
        }

        if (!authData.session || !authData.user) {
            return NextResponse.json(
                { message: 'No se pudo crear la sesión' },
                { status: 401 }
            );
        }

        // 2. Buscar perfil del usuario (con service_role para bypass RLS)
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('perfiles')
            .select('id, empresa_id, rol')
            .eq('id', authData.user.id)
            .single();

        if (perfilError || !perfil) {
            console.error('[AUTH_LOGIN] Perfil no encontrado o error:', perfilError?.message || 'No data');
            return NextResponse.json(
                { message: 'Perfil de usuario no encontrado o error de base de datos. Contacta al administrador.' },
                { status: 403 }
            );
        }

        // 3. Retornar sesión + datos del usuario
        console.log(`[AUTH_LOGIN] Login exitoso: ${email} (${perfil.rol})`);

        return NextResponse.json({
            sesion: {
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                expires_at: authData.session.expires_at
            },
            usuario: {
                id: perfil.id,
                email: authData.user.email,
                nombre: authData.user.user_metadata?.full_name || email.split('@')[0],
                empresa_id: perfil.empresa_id,
                rol: perfil.rol
            }
        });

    } catch (error: any) {
        console.error('[AUTH_LOGIN] Error inesperado:', error.message);
        return NextResponse.json(
            { message: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
