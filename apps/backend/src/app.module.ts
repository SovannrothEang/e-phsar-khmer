import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { AdminModule } from './admin/admin.module';
import { LastSeenInterceptor } from './common/interceptors/last-seen.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: (configService.get<number>('throttle.ttl') ?? 60) * 1000,
          limit: configService.get<number>('throttle.limit') ?? 100,
        },
      ],
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
