/**
 * Tipos del módulo de autenticación.
 * DTOs para entrada y salida del login.
 */

/** DTO de entrada del login */
export interface LoginDto {
    email: string;
    password: string;
}

/** Datos del perfil enriquecido devuelto al frontend */
export interface PerfilAutenticado {
    usuario_id: string;
    email: string;
    empresa_id: string | null;
    empresa_nombre: string;
    rol: string;
    estado_empresa: string;
    must_change_password: boolean;
}

/** Respuesta exitosa del login */
export interface LoginResponse {
    ok: true;
    mensaje: string;
    access_token: string;
    refresh_token: string;
    expires_at: number | null;
    sesion: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        expires_at: number | null;
    };
    usuario: PerfilAutenticado;
}

/** Respuesta de error del login */
export interface LoginErrorResponse {
    ok: false;
    mensaje: string;
    codigo: string;
}
