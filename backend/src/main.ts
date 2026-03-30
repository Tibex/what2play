import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV') || 'development';
  const isProd = nodeEnv === 'production';
  const frontendUrl = config.get<string>('FRONTEND_URL');
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'https://what2play.games',
    ...(frontendUrl ? [frontendUrl] : []),
  ]);

  // Echo allowed origins as explicit strings (not `callback(null, true)`), and keep
  // credentials off: we use Bearer tokens, not cookies. Credentialed CORS + `true`
  // reflection has caused Chrome to show "CORS error" on PATCH while preflight 204
  // still succeeds (no visible status/body in DevTools).
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, origin);
      if (
        !isProd &&
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)
      ) {
        return callback(null, origin);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 0,
  });

  // Allow larger payloads for manual BGG XML imports.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('What2Play API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('APP_PORT') || 3001;
  await app.listen(port);
}
bootstrap();
