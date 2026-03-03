import { Module, Global } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';

@Global()
@Module({
    providers: [NotificacionesService],
    controllers: [NotificacionesController],
    exports: [NotificacionesService],
})
export class NotificacionesModule { }
