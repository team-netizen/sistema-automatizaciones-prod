import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './shared/supabase/supabase.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AuthModule } from './modules/auth/auth.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { GoogleGeocodingModule } from './shared/google/google-geocoding.module';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({ isGlobal: true }),

    // Módulo Supabase (Global — disponible en toda la app)
    SupabaseModule,

    // Módulos de infraestructura y servicios externos
    GoogleGeocodingModule,
    TrackingModule,
    NotificacionesModule,
    AlertasModule,

    // Módulos de negocio
    AuthModule,
    CompaniesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
