import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../core/auth/roles.decorator';
import { RolesGuard } from '../../core/auth/roles.guard';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
@Roles('super_admin')
@UseGuards(RolesGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('dashboard-resumen')
  getDashboardResumen() {
    return this.superAdminService.getDashboardResumen();
  }

  @Get('empresas')
  getEmpresas(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.superAdminService.getEmpresas({
      q,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get('empresas/:id/admin')
  getAdminEmpresa(@Param('id') id: string) {
    return this.superAdminService.getAdminEmpresa(id);
  }

  @Get('empresas/:id/detalle')
  getEmpresaDetalle(@Param('id') id: string) {
    return this.superAdminService.getEmpresaDetalle(id);
  }

  @Post('empresas')
  crearEmpresa(
    @Body()
    body: {
      nombre: string;
      ruc: string;
      adminEmail: string;
      adminPassword: string;
      planId?: string;
    },
  ) {
    return this.superAdminService.crearEmpresa(body);
  }

  @Put('empresas/:id')
  editarEmpresa(
    @Param('id') id: string,
    @Body()
    body: {
      nombre: string;
      ruc: string;
      estado: string;
      planId?: string;
      adminEmail?: string;
      adminPassword?: string;
    },
  ) {
    return this.superAdminService.editarEmpresa(id, body);
  }

  @Patch('empresas/:id/estado')
  cambiarEstadoEmpresa(
    @Param('id') id: string,
    @Body() body: { estado: string },
  ) {
    return this.superAdminService.cambiarEstadoEmpresa(id, body.estado);
  }

  @Get('usuarios')
  getUsuarios(
    @Query('rol') rol?: string,
    @Query('empresaId') empresaId?: string,
    @Query('q') q?: string,
  ) {
    return this.superAdminService.getUsuarios({ rol, empresaId, q });
  }

  @Put('usuarios/:id')
  editarUsuario(
    @Param('id') id: string,
    @Body() body: { email?: string; password?: string; rol?: string },
  ) {
    return this.superAdminService.editarUsuario(id, body);
  }

  @Get('planes')
  getPlanes() {
    return this.superAdminService.getPlanes();
  }

  @Post('planes')
  createPlan(
    @Body()
    body: {
      nombre: string;
      precio: number;
      maximo_usuarios: number;
      limite_tokens_mensual: number;
      limite_ejecuciones_mensual: number;
    },
  ) {
    return this.superAdminService.createPlan(body);
  }

  @Put('planes/:id')
  updatePlan(
    @Param('id') id: string,
    @Body()
    body: {
      nombre: string;
      precio: number;
      maximo_usuarios: number;
      limite_tokens_mensual: number;
      limite_ejecuciones_mensual: number;
    },
  ) {
    return this.superAdminService.updatePlan(id, body);
  }

  @Post('suscripciones')
  createSuscripcion(
    @Body()
    body: {
      empresa_id: string;
      plan_id: string;
      fecha_inicio: string;
      fecha_fin: string;
    },
  ) {
    return this.superAdminService.createSuscripcion(body);
  }

  @Get('metricas')
  getMetricas(@Query('mes') mes?: string) {
    return this.superAdminService.getMetricas(mes);
  }

  @Get('modulos')
  getModulos() {
    return this.superAdminService.getModulos();
  }

  @Patch('modulos/:id/estado')
  updateModuloEstado(
    @Param('id') id: string,
    @Body() body: { activo: boolean },
  ) {
    return this.superAdminService.updateModuloEstado(id, Boolean(body.activo));
  }

  @Get('auditoria')
  getAuditoria(
    @Query('empresaId') empresaId?: string,
    @Query('tipoAccion') tipoAccion?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.superAdminService.getAuditoria({
      empresaId,
      tipoAccion,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }
}
