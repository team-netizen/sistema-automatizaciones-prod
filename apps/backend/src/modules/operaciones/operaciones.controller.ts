import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EmpresaGuard } from '../../core/auth/empresa.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { PerfilUsuario, RolesGuard } from '../../core/auth/roles.guard';
import { OperacionesService } from './operaciones.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
};

type TransferenciaEstado = 'en_transito' | 'recibido' | 'cancelado';

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

  @Get('transferencias')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getTransferencias(
    @Req() req: AuthenticatedRequest,
    @Query() filters: Record<string, string>,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    if (req.perfil.rol === 'encargado_sucursal' && req.perfil.sucursal_id) {
      const requestedOrigen = filters?.sucursal_origen_id;
      const requestedDestino = filters?.sucursal_destino_id;

      if (
        (requestedOrigen && requestedOrigen !== req.perfil.sucursal_id) ||
        (requestedDestino && requestedDestino !== req.perfil.sucursal_id)
      ) {
        throw new ForbiddenException(
          'Encargado de sucursal no puede consultar transferencias de otra sucursal',
        );
      }

      return this.operacionesService.getTransferencias(empresaId, {
        ...filters,
        sucursal_origen_id: req.perfil.sucursal_id,
        sucursal_destino_id: req.perfil.sucursal_id,
        _encargado_scope: 'true',
      });
    }

    return this.operacionesService.getTransferencias(empresaId, filters);
  }

  @Post('transferencias')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  crearTransferencia(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      sucursal_origen_id: string;
      sucursal_destino_id: string;
      items: Array<{ producto_id: string; cantidad_enviada: number }>;
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    // [SECURITY FIX] No confiar en creado_por del cliente; usar identidad autenticada.
    const payload = {
      ...body,
      creado_por: req.perfil.id,
    };

    if (req.perfil.rol === 'encargado_sucursal' && req.perfil.sucursal_id) {
      const participaSucursal =
        payload.sucursal_origen_id === req.perfil.sucursal_id ||
        payload.sucursal_destino_id === req.perfil.sucursal_id;

      if (!participaSucursal) {
        throw new ForbiddenException(
          'Encargado de sucursal solo puede crear transferencias de su sucursal',
        );
      }
    }

    return this.operacionesService.crearTransferencia(empresaId, payload);
  }

  @Patch('transferencias/:id/estado')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  actualizarEstadoTransferencia(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { estado: TransferenciaEstado },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    if (!body?.estado) {
      throw new BadRequestException('El estado es obligatorio');
    }

    return this.operacionesService.actualizarEstadoTransferencia(
      empresaId,
      id,
      body.estado,
    );
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
