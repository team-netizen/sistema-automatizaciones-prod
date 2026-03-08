import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../shared/supabase/supabase.module';
import { AlertasService } from './alertas.service';
import { OperacionesController } from './operaciones.controller';
import { OperacionesService } from './operaciones.service';
import { ProductosController } from './productos.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [OperacionesController, ProductosController],
  providers: [OperacionesService, AlertasService],
  exports: [OperacionesService, AlertasService],
})
export class OperacionesModule {}
