import { Module, Global } from '@nestjs/common';
import { MetricasService } from './metricas.service';

@Global()
@Module({
    providers: [MetricasService],
    exports: [MetricasService],
})
export class TrackingModule { }
