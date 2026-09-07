import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validate } from './config/config.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './common/supabase/supabase.module';
import { DbModule } from './db/db.module';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { LocationsModule } from './locations/locations.module';
import { ListingsModule } from './listings/listings.module';
import { BrandsModule } from './brands/brands.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { ActivityModule } from './activity/activity.module';
import { ChatModule } from './chat/chat.module';
import { OutboxModule } from './outbox/outbox.module';
import { AttributesModule } from './attributes/attributes.module';
import { AdminModule } from './admin/admin.module';
import { LastSeenInterceptor } from './common/interceptors/last-seen.interceptor';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: ['.env', '.env.local'],
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: (configService.get<number>('throttle.ttl') ?? 60) * 1000,
          limit: configService.get<number>('throttle.limit') ?? 100,
        },
      ],
    }),
    // Shared BullMQ connection. Read through ConfigService rather than
    // process.env so the Zod-validated (and coerced) values are used — a
    // raw env port is a string, and Redis options are typed for a number.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('queue.host') ?? 'localhost',
          port: configService.get<number>('queue.port') ?? 6379,
          password: configService.get<string>('queue.password'),
          db: configService.get<number>('queue.db') ?? 0,
        },
        prefix: configService.get<string>('queue.prefix') ?? 'psa',
      }),
    }),
    SupabaseModule,
    DbModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    LocationsModule,
    ListingsModule,
    BrandsModule,
    FilesModule,
    HealthModule,
    ActivityModule,
    ChatModule,
    OutboxModule,
    AttributesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LastSeenInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes(
        { path: '{*splat}', method: RequestMethod.POST },
        { path: '{*splat}', method: RequestMethod.PATCH },
        { path: '{*splat}', method: RequestMethod.PUT },
      );
  }
}
