import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlertasModule } from './modules/alertas/alertas.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { IntegracionesModule } from './modules/integraciones/integraciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { OperacionesModule } from './modules/operaciones/operaciones.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { GoogleGeocodingModule } from './shared/google/google-geocoding.module';
import { SupabaseModule } from './shared/supabase/supabase.module';

@Module({
  imports: [
    // Configuracion global de variables de entorno
    ConfigModule.forRoot({ isGlobal: true }),

    // BullMQ + Redis
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),

    // Modulo Supabase (global)
    SupabaseModule,

    // Modulos de infraestructura y servicios externos
    GoogleGeocodingModule,
    TrackingModule,
    NotificacionesModule,
    AlertasModule,

    // Modulos de negocio
    AuthModule,
    CompaniesModule,
    OperacionesModule,
    IntegracionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
