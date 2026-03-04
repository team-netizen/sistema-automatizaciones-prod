import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../shared/supabase/supabase.module';
import { OperacionesController } from './operaciones.controller';
import { OperacionesService } from './operaciones.service';

@Module({
  imports: [SupabaseModule],
  controllers: [OperacionesController],
  providers: [OperacionesService],
  exports: [OperacionesService],
})
export class OperacionesModule {}

