/**
 * ═══════════════════════════════════════════════════════════
 * PERMISOS — Validación de módulos y acceso por empresa
 * ═══════════════════════════════════════════════════════════
 *
 * verificarModuloActivo(codigoModulo, usuario):
 *   - Verifica que la empresa del usuario tenga el módulo
 *     asignado y activo en `modulos_empresa`.
 *   - Super admin siempre tiene acceso.
 *   - Retorna true o lanza PermisoError 403.
 *
 * verificarEmpresaActiva(empresaId):
 *   - Valida que la empresa exista y esté activa.
 *   - Bloquea si la empresa está suspendida.
 *
 * verificarRol(usuario, rolesPermitidos):
 *   - Valida que el rol del usuario esté en la lista.
 * ═══════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from './supabaseServer';
import { UsuarioActual, esSuperAdmin } from './auth';

// ─── Error de permisos ──────────────────────────────────
export class PermisoError extends Error {
    status: number;

    constructor(message: string, status: number = 403) {
        super(message);
        this.name = 'PermisoError';
        this.status = status;
    }
}

// ─── Verificar módulo activo para la empresa ─────────────
export async function verificarModuloActivo(
    codigoModulo: string,
    usuario: UsuarioActual
): Promise<true> {
    // Super admin tiene acceso total a todos los módulos
    if (esSuperAdmin(usuario)) {
        return true;
    }

    // 1. Buscar el módulo en el catálogo global
    const { data: modulo, error: moduloError } = await supabaseAdmin
        .from('modulos')
        .select('id, activo')
        .eq('codigo', codigoModulo)
        .single();

    if (moduloError || !modulo) {
        throw new PermisoError(
            `Módulo "${codigoModulo}" no encontrado en el catálogo.`
        );
    }

    // 2. Verificar que el módulo esté activo globalmente
    if (!modulo.activo) {
        throw new PermisoError(
            `El módulo "${codigoModulo}" está desactivado globalmente.`
        );
    }

    // 3. Verificar asignación a la empresa del usuario
    const { data: asignacion, error: asignacionError } = await supabaseAdmin
        .from('modulos_empresa')
        .select('id, activo')
        .eq('empresa_id', usuario.empresa_id)
        .eq('modulo_id', modulo.id)
        .single();

    if (asignacionError || !asignacion) {
        throw new PermisoError(
            `Tu empresa no tiene acceso al módulo "${codigoModulo}".`
        );
    }

    // 4. Verificar que la asignación esté activa
    if (!asignacion.activo) {
        throw new PermisoError(
            `El módulo "${codigoModulo}" está desactivado para tu empresa.`
        );
    }

    return true;
}

/**
 * Versión de verificación de módulo para procesos que no tienen usuario (sólo empresa_id).
 * Como Webhooks, Cron Jobs, etc.
 */
export async function verificarModuloActivoEmpresa(
    codigoModulo: string,
    empresaId: string
): Promise<true> {
    // 1. Buscar el módulo
    const { data: modulo, error: moduloError } = await supabaseAdmin
        .from('modulos')
        .select('id, activo')
        .eq('codigo', codigoModulo)
        .single();

    if (moduloError || !modulo) {
        throw new PermisoError(`Módulo "${codigoModulo}" no encontrado.`);
    }

    if (!modulo.activo) {
        throw new PermisoError(`El módulo "${codigoModulo}" está desactivado globalmente.`);
    }

    // 2. Verificar asignación a la empresa
    const { data: asignacion, error: asignacionError } = await supabaseAdmin
        .from('modulos_empresa')
        .select('id, activo')
        .eq('empresa_id', empresaId)
        .eq('modulo_id', modulo.id)
        .single();

    if (asignacionError || !asignacion) {
        throw new PermisoError(`La empresa no tiene acceso al módulo "${codigoModulo}".`);
    }

    if (!asignacion.activo) {
        throw new PermisoError(`El módulo "${codigoModulo}" está desactivado para esta empresa.`);
    }

    return true;
}

// ─── Verificar que la empresa esté activa ────────────────
export async function verificarEmpresaActiva(
    empresaId: string
): Promise<true> {
    const { data: empresa, error } = await supabaseAdmin
        .from('empresas')
        .select('id, estado')
        .eq('id', empresaId)
        .single();

    if (error || !empresa) {
        throw new PermisoError('Empresa no encontrada.', 404);
    }

    // Estados inactivos que bloquean el acceso
    const estadosBloqueados = ['suspendida', 'inactiva', 'cancelada'];

    if (estadosBloqueados.includes(empresa.estado)) {
        throw new PermisoError(
            'Tu empresa está suspendida. Contacta al administrador.',
            403
        );
    }

    return true;
}

// ─── Verificar rol del usuario ───────────────────────────
export function verificarRol(
    usuario: UsuarioActual,
    rolesPermitidos: string[]
): true {
    // Super admin siempre pasa
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
