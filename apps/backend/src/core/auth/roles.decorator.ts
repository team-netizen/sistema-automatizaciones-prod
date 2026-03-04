import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type RolPermitido =
  | 'super_admin'
  | 'admin_empresa'
  | 'encargado_sucursal'
  | 'vendedor';

export const Roles = (...roles: RolPermitido[]) => SetMetadata(ROLES_KEY, roles);
