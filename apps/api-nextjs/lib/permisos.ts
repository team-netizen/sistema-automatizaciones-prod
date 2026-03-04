import { supabaseAdmin } from './supabaseClient';
import { UsuarioActual, esSuperAdmin, type Rol } from './auth';

export class PermisoError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'PermisoError';
    this.status = status;
  }
}

export async function verificarModuloActivo(
  codigoModulo: string,
  usuario: UsuarioActual,
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
    // [SECURITY FIX] Modo estricto: no bypass por tablas faltantes o errores.
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
    throw new PermisoError(`Tu empresa no tiene acceso al modulo "${codigoModulo}".`);
  }

  if (!asignacion.activo) {
    throw new PermisoError(`El modulo "${codigoModulo}" esta desactivado para tu empresa.`);
  }

  return true;
}

export async function verificarModuloActivoEmpresa(
  codigoModulo: string,
  empresaId: string,
): Promise<true> {
  const { data: modulo, error: moduloError } = await supabaseAdmin
    .from('modulos')
    .select('id, activo')
    .eq('codigo', codigoModulo)
    .single();

  if (moduloError || !modulo) {
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

  const estadosBloqueados = new Set(['suspendida', 'inactiva', 'cancelada']);
  if (estadosBloqueados.has(String(empresa.estado).toLowerCase())) {
    throw new PermisoError('Tu empresa esta suspendida. Contacta al administrador.', 403);
  }

  return true;
}

export function verificarRol(usuario: UsuarioActual, rolesPermitidos: Rol[]): true {
  if (esSuperAdmin(usuario)) {
    return true;
  }

  if (!rolesPermitidos.includes(usuario.rol)) {
    throw new PermisoError(
      `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(', ')}`,
      403,
    );
  }

  return true;
}
