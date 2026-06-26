import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function buildCorsOrigins(allowedOrigins: string[]) {
  if (allowedOrigins.includes('*')) return true;

  const origins = new Set<string | RegExp>();

  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin.includes('*')) {
      const escaped = allowedOrigin
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '[^.]+');
      origins.add(new RegExp(`^${escaped}$`));
    } else {
      origins.add(allowedOrigin);
    }
  }

  return Array.from(origins);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('cors.origins') ?? [];
  const corsOrigin = buildCorsOrigins(corsOrigins);

  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Routlis AudioBoard API')
    .setDescription(
      'API REST para autenticacion, RBAC, audios, categorias, botones, botonera, playback e historial.',
    )
    .setVersion('1.0.0')
    .addCookieAuth(
      configService.get<string>('auth.cookieName') ?? 'routlis_token',
      {
        type: 'apiKey',
        in: 'cookie',
      },
      'cookie',
    )
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Routlis API Docs',
  });

  await app.listen(configService.get<number>('port') ?? 4000, '0.0.0.0');
}

void bootstrap();
