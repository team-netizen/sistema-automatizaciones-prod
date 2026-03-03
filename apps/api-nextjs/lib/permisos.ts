/**
 * PERMISOS - Validacion de modulos y acceso por empresa.
 */

import { supabaseAdmin } from './supabaseClient';
import { UsuarioActual, esSuperAdmin } from './auth';

export class PermisoError extends Error {
    status: number;

    constructor(message: string, status: number = 403) {
        super(message);
        this.name = 'PermisoError';
        this.status = status;
    }
}

const strictModuloValidation = process.env.STRICT_MODULO_VALIDATION === 'true';

function canBypassModuloCheck(error: any, foundRecord: boolean): boolean {
    if (strictModuloValidation) return false;
    if (foundRecord) return false;
    if (!error) return true;

    const message = String(error.message || '').toLowerCase();
    const code = String(error.code || '');

    return (
        code === 'PGRST116' ||
        message.includes('does not exist') ||
        message.includes('relation') ||
        message.includes('no rows')
    );
}

export async function verificarModuloActivo(
    codigoModulo: string,
    usuario: UsuarioActual
): Promise<true> {
    if (esSuperAdmin(usuario)) {
        return true;
    }

    const { data: modulo, error: moduloError } = await supabaseAdmin
        .from('modulos')
        .select('id, activo')
        .eq('codigo', codigoModulo)
        .single();

    if (moduloError || !modulo) {
        if (canBypassModuloCheck(moduloError, Boolean(modulo))) {
            console.warn(
                `[permisos] Validacion de modulo en modo flexible. Se permite acceso a "${codigoModulo}" para empresa ${usuario.empresa_id}.`
            );
            return true;
        }

        throw new PermisoError(`Modulo "${codigoModulo}" no encontrado en el catalogo.`);
    }

    if (!modulo.activo) {
        throw new PermisoError(`El modulo "${codigoModulo}" esta desactivado globalmente.`);
    }

    const { data: asignacion, error: asignacionError } = await supabaseAdmin
        .from('modulos_empresa')
        .select('id, activo')
        .eq('empresa_id', usuario.empresa_id)
        .eq('modulo_id', modulo.id)
        .single();

    if (asignacionError || !asignacion) {
        if (canBypassModuloCheck(asignacionError, Boolean(asignacion))) {
            console.warn(
                `[permisos] No hay asignacion explicita para "${codigoModulo}" en empresa ${usuario.empresa_id}. Acceso permitido por compatibilidad.`
            );
            return true;
        }

        throw new PermisoError(`Tu empresa no tiene acceso al modulo "${codigoModulo}".`);
    }

    if (!asignacion.activo) {
        throw new PermisoError(`El modulo "${codigoModulo}" esta desactivado para tu empresa.`);
    }

    return true;
}

export async function verificarModuloActivoEmpresa(
    codigoModulo: string,
    empresaId: string
): Promise<true> {
    const { data: modulo, error: moduloError } = await supabaseAdmin
        .from('modulos')
        .select('id, activo')
        .eq('codigo', codigoModulo)
        .single();

    if (moduloError || !modulo) {
        if (canBypassModuloCheck(moduloError, Boolean(modulo))) {
            console.warn(
                `[permisos] Validacion de modulo (empresa) en modo flexible. Acceso permitido para "${codigoModulo}" en empresa ${empresaId}.`
            );
            return true;
        }

        throw new PermisoError(`Modulo "${codigoModulo}" no encontrado.`);
    }

    if (!modulo.activo) {
        throw new PermisoError(`El modulo "${codigoModulo}" esta desactivado globalmente.`);
    }

    const { data: asignacion, error: asignacionError } = await supabaseAdmin
        .from('modulos_empresa')
        .select('id, activo')
        .eq('empresa_id', empresaId)
        .eq('modulo_id', modulo.id)
        .single();

    if (asignacionError || !asignacion) {
        if (canBypassModuloCheck(asignacionError, Boolean(asignacion))) {
            console.warn(
                `[permisos] No hay asignacion explicita para "${codigoModulo}" en empresa ${empresaId}. Acceso permitido por compatibilidad.`
            );
            return true;
        }

        throw new PermisoError(`La empresa no tiene acceso al modulo "${codigoModulo}".`);
    }

    if (!asignacion.activo) {
        throw new PermisoError(`El modulo "${codigoModulo}" esta desactivado para esta empresa.`);
    }

    return true;
}

export async function verificarEmpresaActiva(empresaId: string): Promise<true> {
    const { data: empresa, error } = await supabaseAdmin
        .from('empresas')
        .select('id, estado')
        .eq('id', empresaId)
        .single();

    if (error || !empresa) {
        throw new PermisoError('Empresa no encontrada.', 404);
    }

    const estadosBloqueados = ['suspendida', 'inactiva', 'cancelada'];

    if (estadosBloqueados.includes(empresa.estado)) {
        throw new PermisoError('Tu empresa esta suspendida. Contacta al administrador.', 403);
    }

    return true;
}

export function verificarRol(usuario: UsuarioActual, rolesPermitidos: string[]): true {
    if (esSuperAdmin(usuario)) {
        return true;
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
        throw new PermisoError(
            `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(', ')}`
        );
    }

    return true;
}
