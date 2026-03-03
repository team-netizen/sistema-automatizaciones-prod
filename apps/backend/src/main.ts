import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const corsOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS?.split(',').map((value) => value.trim()) ?? []),
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter((value): value is string => Boolean(value));

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permite herramientas server-to-server o health checks sin Origin
      if (!origin) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin)) {
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
