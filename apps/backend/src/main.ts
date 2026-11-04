import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Vercel terminates TLS and forwards exactly one hop, so the client address
  // is the last X-Forwarded-For entry. Without this Express reports the
  // proxy's address for every request, and the IP-keyed throttler puts all
  // clients in one bucket (and rotating the proxy IP would bypass it).
  app.set('trust proxy', 1);

  // Without this, SIGTERM (every Vercel scale-down and redeploy) killed the
  // process with no lifecycle hooks: BullMQ workers never closed (an active
  // payment job was left to the 30 s stalled check), ChatPubSubService never
  // QUIT its Redis connections, and OutboxWorker's own shutdown grace in
  // onModuleDestroy never ran.
  app.enableShutdownHooks();

  // Express's default JSON limit is 100 KB, which silently 413'd every E2E
  // history-backup segment above it (AddBackupSegmentDto allows ~900 KB of
  // ciphertext). 1 MB also matches the Next.js server-action body default —
  // the hop every web request crosses first — so neither limit is the
  // tighter surprise. Applies app-wide: every other DTO still caps its own
  // fields, so this only widens what can be parsed, not what is accepted.
  app.useBodyParser('json', { limit: '1mb' });

  app.setGlobalPrefix('api', { exclude: ['health', '/'] });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  const rawOrigins = process.env.FRONTEND_ORIGINS ?? '';
  const frontendOrigins = rawOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';

  // `origin: true` reflects whatever origin asks, so with credentials on it
  // grants every site a logged-in context. That is tolerable while developing
  // against arbitrary localhost ports; in production it is a misconfiguration
  // (a forgotten env var), so boot fails loudly rather than silently opening
  // the API to any origin.
  if (isProduction && frontendOrigins.length === 0) {
    throw new Error(
      'FRONTEND_ORIGINS must list the allowed browser origins in production: CORS with credentials cannot default to every origin. Set it to a comma-separated list, e.g. "https://phsarkhmer.com".',
    );
  }

  app.enableCors({
    origin: frontendOrigins.length ? frontendOrigins : true,
    credentials: true,
  });

  app.useWebSocketAdapter(new WsAdapter(app));

  // The schema enumerates every route and DTO shape; keep it off the public
  // production surface (it is still mounted for local/dev and E2E runs).
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PhsarKhmer.com API')
      .setDescription('E-Market API — PhsarKhmer.com marketplace')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0', () => {
    console.log(
      `🚀 Server listening on port ${process.env.PORT ?? 3000} (env: ${
        process.env.NODE_ENV ?? 'development'
      })`,
    );
  });
}

// A boot-time configuration error (e.g. missing FRONTEND_ORIGINS in
// production) must stop the process with a readable message, not leave a
// rejected promise whose default report buries the reason.
void bootstrap().catch((err: unknown) => {
  console.error(
    `Fatal error during boot: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
