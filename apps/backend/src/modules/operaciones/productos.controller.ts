import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EmpresaGuard } from '../../core/auth/empresa.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { PerfilUsuario, RolesGuard } from '../../core/auth/roles.guard';
import { OperacionesService } from './operaciones.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
};

@Controller('productos')
@UseGuards(RolesGuard, EmpresaGuard)
export class ProductosController {
  constructor(private readonly operacionesService: OperacionesService) {}

  @Get('buscar')
  @Roles('vendedor', 'encargado_sucursal', 'admin_empresa', 'super_admin')
  buscarProductos(
    @Req() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada =
      req.perfil.rol === 'vendedor' || req.perfil.rol === 'encargado_sucursal'
        ? req.perfil.sucursal_id
        : sucursalId;

    if (!sucursalAutorizada) {
      throw new ForbiddenException('sucursalId requerido');
    }

    if (
      (req.perfil.rol === 'vendedor' || req.perfil.rol === 'encargado_sucursal')
      && sucursalId
      && sucursalId !== req.perfil.sucursal_id
    ) {
      throw new ForbiddenException('No puedes consultar otra sucursal');
    }

    return this.operacionesService.buscarProductosParaVenta(q, sucursalAutorizada, empresaId);
  }
}
