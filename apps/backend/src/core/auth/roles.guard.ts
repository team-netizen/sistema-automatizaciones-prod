import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { Rol } from './roles.decorator';

/**
 * RolesGuard — Validación de rol por ruta.
 *
 * Requiere que SupabaseAuthGuard se haya ejecutado primero
 * (ya que lee request.user.rol inyectado por el guard).
 *
 * Uso:
 *   @UseGuards(SupabaseAuthGuard, RolesGuard)
 *   @Roles('propietario', 'administrador')
 *   @Get('admin-only')
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Si no se decoran roles, la ruta es libre para cualquier usuario autenticado
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user || !user.rol) {
            throw new ForbiddenException('No se pudo determinar el rol del usuario');
        }

        // Los SuperAdmins pasan cualquier validación de rol
        if (user.rol === 'superadmin') {
            return true;
        }

        const tienePermiso = requiredRoles.includes(user.rol);

        if (!tienePermiso) {
            throw new ForbiddenException(
                'No tienes permisos suficientes para esta acción',
            );
        }

        return true;
    }
}
