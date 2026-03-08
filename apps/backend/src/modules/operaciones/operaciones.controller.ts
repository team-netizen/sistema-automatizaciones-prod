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
import { AlertasService } from './alertas.service';
import { OperacionesService } from './operaciones.service';

type AuthenticatedRequest = Request & {
  perfil: PerfilUsuario;
};

@Controller('operaciones')
@UseGuards(RolesGuard, EmpresaGuard)
export class OperacionesController {
  constructor(
    private readonly operacionesService: OperacionesService,
    private readonly alertasService: AlertasService,
  ) {}

  @Get('dashboard')
  @Roles('admin_empresa', 'super_admin')
  getDashboard(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('super_admin debe especificar empresa_id');
    }
    return this.operacionesService.getDashboardMetrics(empresaId);
  }

  @Get('encargado/dashboard')
  @Roles('encargado_sucursal', 'admin_empresa', 'super_admin')
  getDashboardEncargado(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    const sucursalId = req.perfil.sucursal_id;
    if (!empresaId || !sucursalId) {
      throw new ForbiddenException('empresa_id y sucursal_id requeridos');
    }
    return this.operacionesService.getDashboardEncargado(empresaId, sucursalId);
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
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
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
  @Roles('admin_empresa', 'encargado_sucursal', 'vendedor', 'super_admin')
  getAlertas(
    @Req() req: AuthenticatedRequest,
    @Query('usuarioId') usuarioId?: string,
    @Query('empresaId') empresaIdParam?: string,
    @Query('limit') limit?: string,
    @Query('solo_no_leidas') soloNoLeidas?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }

    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    if (usuarioId) {
      if (req.perfil.rol !== 'super_admin' && usuarioId !== req.perfil.id) {
        throw new ForbiddenException('No puedes consultar notificaciones de otro usuario');
      }

      return this.operacionesService.getNotificaciones(usuarioId, empresaId);
    }

    return this.operacionesService.getAlertas(
      empresaId,
      limit ? parseInt(limit, 10) : 20,
      soloNoLeidas === 'true',
    );
  }

  @Patch('alertas/marcar-todas-leidas')
  @Roles('admin_empresa', 'encargado_sucursal', 'vendedor', 'super_admin')
  marcarTodasNotificacionesLeidas(
    @Req() req: AuthenticatedRequest,
    @Body() body: { usuarioId: string; empresaId: string },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }
    if (body?.empresaId && body.empresaId !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }
    if (req.perfil.rol !== 'super_admin' && body?.usuarioId !== req.perfil.id) {
      throw new ForbiddenException('No puedes modificar notificaciones de otro usuario');
    }

    return this.operacionesService.marcarTodasNotificacionesLeidas(body.usuarioId, empresaId);
  }

  @Patch('alertas/:id/leida')
  @Roles('admin_empresa', 'encargado_sucursal', 'vendedor', 'super_admin')
  marcarNotificacionLeida(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }

    return this.operacionesService.marcarNotificacionLeida(id, req.perfil.id, empresaId);
  }

  @Patch('alertas/:id/leer')
  @Roles('admin_empresa', 'encargado_sucursal', 'vendedor', 'super_admin')
  marcarAlertaLeida(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }
    return this.alertasService.marcarLeida(empresaId, id);
  }

  @Patch('alertas/leer-todas')
  @Roles('admin_empresa', 'encargado_sucursal', 'vendedor', 'super_admin')
  marcarTodasLeidas(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }
    return this.alertasService.marcarTodasLeidas(empresaId);
  }

  @Post('notificaciones/mensaje-encargado')
  @Roles('admin_empresa', 'encargado_sucursal')
  async enviarMensajeEncargado(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      empresaId: string;
      sucursalId: string;
      titulo: string;
      mensaje: string;
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }

    if (body?.empresaId && body.empresaId !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada = req.perfil.rol === 'encargado_sucursal'
      ? req.perfil.sucursal_id
      : body?.sucursalId;

    if (!sucursalAutorizada) {
      throw new ForbiddenException('sucursal_id requerido');
    }

    if (
      req.perfil.rol === 'encargado_sucursal'
      && body?.sucursalId
      && body.sucursalId !== req.perfil.sucursal_id
    ) {
      throw new ForbiddenException('No puedes enviar mensajes a otra sucursal');
    }

    return this.operacionesService.enviarMensajeEncargado({
      empresaId,
      sucursalId: sucursalAutorizada,
      titulo: String(body?.titulo || ''),
      mensaje: String(body?.mensaje || ''),
    });
  }

  @Post('alertas/verificar-stock')
  @Roles('admin_empresa', 'super_admin')
  verificarStockBajo(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) {
      throw new ForbiddenException('empresa_id requerido');
    }
    return this.operacionesService.verificarStockBajoEmpresa(empresaId);
  }

  @Get('movimientos')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getMovimientos(
    @Req() req: AuthenticatedRequest,
    @Query('sucursal_id') sucursalId?: string,
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
    @Query('tipo') tipo?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    const sucursalEncargado = req.perfil.sucursal_id || undefined;
    if (req.perfil.rol === 'encargado_sucursal' && !sucursalEncargado) {
      throw new ForbiddenException('sucursal_id requerido para encargado_sucursal');
    }

    const sucursalFinal = req.perfil.rol === 'encargado_sucursal'
      ? sucursalEncargado
      : sucursalId;

    return this.operacionesService.getMovimientos(empresaId, sucursalFinal, inicio, fin, tipo);
  }

  @Get('transferencias')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  async getTransferencias(
    @Req() req: AuthenticatedRequest,
    @Query('estado') estado?: string,
    @Query('sucursal_id') sucursalId?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    const sucursalEncargado = req.perfil.sucursal_id || undefined;
    if (req.perfil.rol === 'encargado_sucursal' && !sucursalEncargado) {
      throw new ForbiddenException('sucursal_id requerido para encargado_sucursal');
    }
    const sucursalFinal = req.perfil.rol === 'encargado_sucursal'
      ? sucursalEncargado
      : sucursalId;
    return this.operacionesService.getTransferencias(empresaId, {
      estado,
      sucursalId: sucursalFinal,
    });
  }

  @Post('transferencias')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  async crearTransferencia(
    @Req() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    const empresaId = req.perfil.empresa_id;
    const usuarioId = req.perfil.id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    const sucursalEncargado = req.perfil.sucursal_id || undefined;
    if (req.perfil.rol === 'encargado_sucursal' && !sucursalEncargado) {
      throw new ForbiddenException('sucursal_id requerido para encargado_sucursal');
    }

    const payload = req.perfil.rol === 'encargado_sucursal'
      ? { ...body, sucursal_origen_id: sucursalEncargado }
      : body;

    return this.operacionesService.crearTransferencia(empresaId, usuarioId, payload);
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

  @Patch('transferencias/:id/completar')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  completarTransferencia(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    const usuarioId = req.perfil.id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    const sucursalEncargado = req.perfil.sucursal_id || undefined;
    if (req.perfil.rol === 'encargado_sucursal' && !sucursalEncargado) {
      throw new ForbiddenException('sucursal_id requerido para encargado_sucursal');
    }
    return this.operacionesService.completarTransferencia(
      empresaId,
      id,
      usuarioId,
      req.perfil.rol === 'encargado_sucursal' ? sucursalEncargado : undefined,
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

  @Patch('stock/ajuste')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
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
    const sucursalEncargado = req.perfil.sucursal_id || undefined;
    if (req.perfil.rol === 'encargado_sucursal' && !sucursalEncargado) {
      throw new ForbiddenException('sucursal_id requerido para encargado_sucursal');
    }

    const payload = req.perfil.rol === 'encargado_sucursal'
      ? { ...body, sucursal_id: sucursalEncargado as string }
      : body;

    return this.operacionesService.ajustarStock(empresaId, usuarioId, payload);
  }

  @Get('reportes/stock-sucursal')
  @Roles('admin_empresa', 'encargado_sucursal', 'vendedor', 'super_admin')
  getReporteStockSucursal(
    @Req() req: AuthenticatedRequest,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada =
      req.perfil.rol === 'encargado_sucursal' || req.perfil.rol === 'vendedor'
        ? req.perfil.sucursal_id
        : sucursalId;
    if (!sucursalAutorizada) {
      throw new ForbiddenException('sucursal_id requerido');
    }
    if (
      (req.perfil.rol === 'encargado_sucursal' || req.perfil.rol === 'vendedor')
      && sucursalId
      && sucursalId !== req.perfil.sucursal_id
    ) {
      throw new ForbiddenException('No puedes consultar otra sucursal');
    }

    return this.operacionesService.getStockSucursal(sucursalAutorizada, empresaId);
  }

  @Get('reportes/movimientos-sucursal')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getReporteMovimientosSucursal(
    @Req() req: AuthenticatedRequest,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada = req.perfil.rol === 'encargado_sucursal' ? req.perfil.sucursal_id : sucursalId;
    if (!sucursalAutorizada) {
      throw new ForbiddenException('sucursal_id requerido');
    }
    if (
      req.perfil.rol === 'encargado_sucursal'
      && sucursalId
      && sucursalId !== req.perfil.sucursal_id
    ) {
      throw new ForbiddenException('No puedes consultar otra sucursal');
    }

    return this.operacionesService.getMovimientosSucursal(
      sucursalAutorizada,
      empresaId,
      String(desde || ''),
      String(hasta || ''),
    );
  }

  @Get('reportes/transferencias-sucursal')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getReporteTransferenciasSucursal(
    @Req() req: AuthenticatedRequest,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada = req.perfil.rol === 'encargado_sucursal' ? req.perfil.sucursal_id : sucursalId;
    if (!sucursalAutorizada) {
      throw new ForbiddenException('sucursal_id requerido');
    }
    if (
      req.perfil.rol === 'encargado_sucursal'
      && sucursalId
      && sucursalId !== req.perfil.sucursal_id
    ) {
      throw new ForbiddenException('No puedes consultar otra sucursal');
    }

    return this.operacionesService.getTransferenciasSucursal(
      sucursalAutorizada,
      empresaId,
      String(desde || ''),
      String(hasta || ''),
    );
  }

  @Get('reportes/pedidos-sucursal')
  @Roles('admin_empresa', 'encargado_sucursal', 'super_admin')
  getReportePedidosSucursal(
    @Req() req: AuthenticatedRequest,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada = req.perfil.rol === 'encargado_sucursal' ? req.perfil.sucursal_id : sucursalId;
    if (!sucursalAutorizada) {
      throw new ForbiddenException('sucursal_id requerido');
    }
    if (
      req.perfil.rol === 'encargado_sucursal'
      && sucursalId
      && sucursalId !== req.perfil.sucursal_id
    ) {
      throw new ForbiddenException('No puedes consultar otra sucursal');
    }

    return this.operacionesService.getPedidosSucursal(
      sucursalAutorizada,
      empresaId,
      String(desde || ''),
      String(hasta || ''),
    );
  }

  @Get('reportes/ventas')
  @Roles('admin_empresa', 'super_admin')
  getReporteVentas(
    @Req() req: AuthenticatedRequest,
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.getReporteVentas(empresaId, inicio, fin);
  }

  @Get('reportes/productos')
  @Roles('admin_empresa', 'super_admin')
  getReporteProductos(
    @Req() req: AuthenticatedRequest,
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.getReporteProductos(empresaId, inicio, fin);
  }

  @Get('reportes/canales')
  @Roles('admin_empresa', 'super_admin')
  getReporteCanales(
    @Req() req: AuthenticatedRequest,
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.getReporteCanales(empresaId, inicio, fin);
  }

  @Get('vendedor/resumen-turno')
  @Roles('vendedor', 'encargado_sucursal', 'admin_empresa', 'super_admin')
  getResumenTurnoVendedor(
    @Req() req: AuthenticatedRequest,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
    @Query('vendedorId') vendedorId?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada = req.perfil.rol === 'vendedor' ? req.perfil.sucursal_id : sucursalId;
    const vendedorAutorizado = req.perfil.rol === 'vendedor' ? req.perfil.id : vendedorId;

    if (!sucursalAutorizada || !vendedorAutorizado) {
      throw new ForbiddenException('sucursalId y vendedorId son requeridos');
    }

    if (req.perfil.rol === 'vendedor') {
      if (sucursalId && sucursalId !== req.perfil.sucursal_id) {
        throw new ForbiddenException('No puedes consultar otra sucursal');
      }
      if (vendedorId && vendedorId !== req.perfil.id) {
        throw new ForbiddenException('No puedes consultar otro vendedor');
      }
    }

    return this.operacionesService.getResumenTurno(sucursalAutorizada, empresaId, vendedorAutorizado);
  }

  @Post('vendedor/crear-pedido')
  @Roles('vendedor', 'encargado_sucursal', 'admin_empresa', 'super_admin')
  crearPedidoVendedor(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      empresaId: string;
      sucursalId: string;
      vendedorId: string;
      items: { productoId: string; cantidad: number; precioUnitario: number }[];
      cliente: { nombre?: string; telefono?: string; dni?: string; email?: string };
      metodoPago: 'efectivo' | 'tarjeta' | 'yape_plin' | 'transferencia';
      montoRecibido?: number;
      observaciones?: string;
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');

    const payload = req.perfil.rol === 'vendedor'
      ? {
          ...body,
          empresaId,
          sucursalId: req.perfil.sucursal_id as string,
          vendedorId: req.perfil.id,
        }
      : {
          ...body,
          empresaId,
        };

    return this.operacionesService.crearPedidoVendedor(payload);
  }

  @Get('vendedor/mis-ventas')
  @Roles('vendedor', 'encargado_sucursal', 'admin_empresa', 'super_admin')
  getMisVentasVendedor(
    @Req() req: AuthenticatedRequest,
    @Query('vendedorId') vendedorId?: string,
    @Query('sucursalId') sucursalId?: string,
    @Query('empresaId') empresaIdParam?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    if (empresaIdParam && empresaIdParam !== empresaId) {
      throw new ForbiddenException('empresa_id no valido para la sesion');
    }

    const sucursalAutorizada = req.perfil.rol === 'vendedor' ? req.perfil.sucursal_id : sucursalId;
    const vendedorAutorizado = req.perfil.rol === 'vendedor' ? req.perfil.id : vendedorId;

    if (!sucursalAutorizada || !vendedorAutorizado) {
      throw new ForbiddenException('sucursalId y vendedorId son requeridos');
    }

    if (req.perfil.rol === 'vendedor') {
      if (sucursalId && sucursalId !== req.perfil.sucursal_id) {
        throw new ForbiddenException('No puedes consultar otra sucursal');
      }
      if (vendedorId && vendedorId !== req.perfil.id) {
        throw new ForbiddenException('No puedes consultar otro vendedor');
      }
    }

    return this.operacionesService.getMisVentas(
      vendedorAutorizado,
      sucursalAutorizada,
      empresaId,
      String(desde || ''),
      String(hasta || ''),
    );
  }

  @Get('vendedor/pedido/:id')
  @Roles('vendedor', 'encargado_sucursal', 'admin_empresa', 'super_admin')
  getDetallePedido(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');

    return this.operacionesService.getDetallePedidoVendedor(id, {
      empresaId,
      rol: req.perfil.rol,
      sucursalId: req.perfil.sucursal_id || undefined,
      vendedorId: req.perfil.id,
    });
  }

  @Get('vendedor/buscar-productos')
  @Roles('vendedor', 'encargado_sucursal', 'admin_empresa', 'super_admin')
  buscarProductosVendedor(
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

    return this.operacionesService.buscarProductosConStock(q, sucursalAutorizada, empresaId);
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

  @Post('integraciones/conectar')
  @Roles('admin_empresa', 'super_admin')
  async conectarIntegracion(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      tipo: string;
      credenciales: Record<string, string>;
      modo: 'conectar' | 'configurar';
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.conectarIntegracion(empresaId, body);
  }

  @Post('integraciones/:tipo/desconectar')
  @Roles('admin_empresa', 'super_admin')
  async desconectarIntegracion(
    @Req() req: AuthenticatedRequest,
    @Param('tipo') tipo: string,
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.desconectarIntegracion(empresaId, tipo);
  }

  @Get('usuarios')
  @Roles('admin_empresa', 'super_admin')
  getUsuarios(@Req() req: AuthenticatedRequest) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.getUsuarios(empresaId);
  }

  @Post('usuarios')
  @Roles('admin_empresa', 'super_admin')
  crearUsuario(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      email: string;
      password: string;
      rol: string;
      sucursal_id: string | null;
    },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.crearUsuario(empresaId, body);
  }

  @Post('usuarios/reset-password')
  @Roles('admin_empresa', 'super_admin')
  resetPassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: { email: string },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.resetPasswordUsuario(empresaId, body.email);
  }

  @Patch('usuarios/:id')
  @Roles('admin_empresa', 'super_admin')
  editarUsuario(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { rol: string; sucursal_id: string | null },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.editarUsuario(empresaId, id, body);
  }

  @Patch('usuarios/:id/toggle')
  @Roles('admin_empresa', 'super_admin')
  toggleUsuario(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { activo: boolean },
  ) {
    const empresaId = req.perfil.empresa_id;
    if (!empresaId) throw new ForbiddenException('empresa_id requerido');
    return this.operacionesService.toggleUsuario(empresaId, id, body.activo);
  }
}
