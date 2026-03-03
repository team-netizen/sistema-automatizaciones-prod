import { Module } from '@nestjs/common';
import { AlertasEngine } from './alertas.engine';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
    imports: [NotificacionesModule],
    providers: [AlertasEngine],
    exports: [AlertasEngine],
})
export class AlertasModule { }
