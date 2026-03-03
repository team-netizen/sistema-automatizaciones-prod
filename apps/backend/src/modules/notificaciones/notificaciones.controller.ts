import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { SupabaseAuthGuard } from '../../core/auth/auth.guard';

@Controller('notificaciones')
@UseGuards(SupabaseAuthGuard)
export class NotificacionesController {
    constructor(private readonly notificacionesService: NotificacionesService) { }

    @Get()
    async listar(@Request() req: any) {
        return this.notificacionesService.listarParaUsuario(
            req.user.empresa_id,
            req.user.usuario_id
        );
    }

    @Get('count')
    async contar(@Request() req: any) {
        return this.notificacionesService.contarNoLeidas(
            req.user.empresa_id,
            req.user.usuario_id
        );
    }

    @Patch(':id/leida')
    async marcarLeida(@Param('id') id: string, @Request() req: any) {
        return this.notificacionesService.marcarLeida(id, req.user.empresa_id);
    }
}
