import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { SanitizedExceptionFilter } from './core/filters/sanitized-exception.filter';

const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

function validateRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((envName) => {
    const value = process.env[envName];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas faltantes: ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // [SECURITY FIX] Fail-fast para evitar arrancar con secretos/config incompletos.
  validateRequiredEnvVars();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // [SECURITY FIX] Cabeceras HTTP seguras por defecto.
  app.use(helmet());

  // [SECURITY FIX] Rechaza payloads inesperados y evita inyecciones por propiedades extra.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // [SECURITY FIX] Oculta detalles internos de excepciones en respuestas HTTP.
  app.useGlobalFilters(new SanitizedExceptionFilter());

  const corsOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()) ?? []),
    'https://sistema-automatizaciones-frontend.vercel.app',
    'https://sistema-automatizaciones-prod.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter((value): value is string => Boolean(value));

  const vercelProjectOrigin = /^https:\/\/sistema-automatizaciones-[a-z0-9-]+\.vercel\.app$/i;

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permite herramientas server-to-server o health checks sin Origin
      if (!origin) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin) || vercelProjectOrigin.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Backend corriendo en puerto ${port}`);
  logger.log(`CORS habilitado para: ${corsOrigins.join(', ')}`);
}

bootstrap();
