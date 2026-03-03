import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type Rol =
    | 'superadmin'
    | 'propietario'
    | 'administrador'
    | 'editor'
    | 'operador'
    | 'lector';

export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
