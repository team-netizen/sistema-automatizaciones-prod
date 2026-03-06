import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmpresaGuard } from '../../core/auth/empresa.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { PerfilUsuario, RolesGuard } from '../../core/auth/roles.guard';
import { OperacionesService } from './operaciones.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
};

@Controller('operaciones')
@UseGuards(RolesGuard, EmpresaGuard)
export class OperacionesController {
  constructor(private readonly operacionesService: OperacionesService) {}

  @Get('dashboard')
  @Roles('admin_empresa', 'super_admin')
  getDashboard(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getDashboardMetrics(empresaId);
  }

  @Get('productos/criticos')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getProductosCriticos(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getProductosCriticos(empresaId);
  }

  @Get('sucursales')
  @Roles('admin_empresa', 'super_admin')
  getSucursales(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getSucursales(empresaId);
  }

  @Post('sucursales')
  @Roles('admin_empresa', 'super_admin')
  crearSucursal(
    @Req() req: AuthenticatedRequest,
    @Body() body: { nombre: string; tipo?: string; estado?: string },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }

    return this.operacionesService.crearSucursal(empresaId, body);
  }

  @Get('categorias')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getCategorias(
    @Req() req: AuthenticatedRequest,
    @Query('incluir_inactivas') incluirInactivas?: string,
    @Query('solo_activas') soloActivas?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) return { categorias: [] };
    const incluir = ['true', '1', 'si', 'yes'].includes(
      String(incluirInactivas ?? '').toLowerCase(),
    );
    const solo = ['true', '1', 'si', 'yes'].includes(
      String(soloActivas ?? '').toLowerCase(),
    );
    return this.operacionesService.getCategorias(empresaId, {
      incluirInactivas: incluir,
      soloActivas: solo,
    });
  }

  @Post('categorias')
  @Roles('admin_empresa', 'super_admin')
  async crearCategoria(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.crearCategoria(empresaId, body);
  }

  @Patch('categorias/:id')
  @Roles('admin_empresa', 'super_admin')
  async actualizarCategoria(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.actualizarCategoria(empresaId, id, body);
  }

  @Delete('categorias/:id')
  @Roles('admin_empresa', 'super_admin')
  async eliminarCategoria(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.eliminarCategoria(empresaId, id);
  }

  @Get('productos')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getProductos(
    @Req() req: AuthenticatedRequest,
    @Query() filters: Record<string, string>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getProductos(empresaId, filters);
  }

  @Post('productos')
  @Roles('admin_empresa', 'super_admin')
  async crearProducto(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      nombre: string;
      sku: string;
      precio: number;
      activo: boolean;
      categoria_id?: string | null;
      descripcion?: string | null;
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.crearProducto(empresaId, body);
  }

  @Post('productos/importar')
  @Roles('admin_empresa', 'super_admin')
  @UseInterceptors(FileInterceptor('file'))
  async importarProductosCSV(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (!file) throw new BadRequestException('Archivo CSV requerido');
    return this.operacionesService.importarProductosCSV(empresaId, file.buffer);
  }

  @Patch('productos/:id')
  @Roles('admin_empresa', 'super_admin')
  async actualizarProducto(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.actualizarProducto(empresaId, id, body);
  }

  @Delete('productos/:id')
  @Roles('admin_empresa', 'super_admin')
  async eliminarProducto(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.eliminarProducto(empresaId, id);
  }

  @Get('pedidos')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getPedidos(
    @Req() req: AuthenticatedRequest,
    @Query() filters: Record<string, string>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    if (req.perfil.rol === 'encargado_sucursal' && req.perfil.sucursal_id) {
      const requestedSucursal = filters?.sucursal_id;
      if (requestedSucursal && requestedSucursal !== req.perfil.sucursal_id) {
        throw new ForbiddenException(
          'Encargado de sucursal no puede consultar pedidos de otra sucursal',
        );
      }
      return this.operacionesService.getPedidos(empresaId, {
        ...filters,
        sucursal_id: req.perfil.sucursal_id,
      });
    }

    return this.operacionesService.getPedidos(empresaId, filters);
  }

  @Get('alertas')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getAlertas(
    @Req() req: AuthenticatedRequest,
    @Query() filters: Record<string, string>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getAlertas(empresaId, filters);
  }

  @Get('transferencias')
  @Roles('admin_empresa', 'super_admin')
  async getTransferencias(
    @Req() req: AuthenticatedRequest,
    @Query('estado') estado?: string,
    @Query('sucursal_id') sucursalId?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.getTransferencias(empresaId, {
      estado,
      sucursalId,
    });
  }

  @Post('transferencias')
  @Roles('admin_empresa', 'super_admin')
  async crearTransferencia(
    @Req() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    const empresaId = req.perfil.empresa_id;
    const usuarioId = req.perfil.id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.crearTransferencia(empresaId, usuarioId, body);
  }

  @Post('transferencias/:id/aprobar')
  @Roles('admin_empresa', 'super_admin')
  async aprobarTransferencia(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    const usuarioId = req.perfil.id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.aprobarTransferencia(empresaId, usuarioId, id);
  }

  @Post('transferencias/:id/rechazar')
  @Roles('admin_empresa', 'super_admin')
  async rechazarTransferencia(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.rechazarTransferencia(empresaId, id, body.motivo);
  }

  @Get('stock')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getStock(
    @Req() req: AuthenticatedRequest,
    @Query('sucursal_id') sucursal_id?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    if (req.perfil.rol === 'encargado_sucursal' && req.perfil.sucursal_id) {
      if (sucursal_id && sucursal_id !== req.perfil.sucursal_id) {
        throw new ForbiddenException(
          'Encargado de sucursal no puede consultar stock de otra sucursal',
        );
      }

      return this.operacionesService.getStockPorSucursal(
        empresaId,
        req.perfil.sucursal_id,
      );
    }

    return this.operacionesService.getStockPorSucursal(empresaId, sucursal_id);
  }

  @Patch('stock/ajuste')
  @Roles('admin_empresa', 'super_admin')
  async ajustarStock(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      producto_id: string;
      sucursal_id: string;
      tipo: 'entrada' | 'salida';
      cantidad: number;
      motivo: string;
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    const usuarioId = req.perfil.id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.ajustarStock(empresaId, usuarioId, body);
  }

  @Get('integraciones')
  @Roles('admin_empresa', 'super_admin')
  getIntegraciones(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getIntegraciones(empresaId);
  }
}
