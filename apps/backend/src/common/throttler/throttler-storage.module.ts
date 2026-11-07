import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { queueRedisOptions } from '../queue/queue-connection';
import { RedisThrottlerStorage, THROTTLER_REDIS } from './throttler-storage';

/**
 * The dedicated Redis connection behind `RedisThrottlerStorage`. Exported so
 * `AuthModule`'s account lockout can share it rather than opening a second
 * connection (free Redis Cloud plans cap connections at 30).
 *
 * `enableOfflineQueue: false` + a short `connectTimeout` is what makes the
 * storage fail open fast: while Redis is down a guard-path command rejects
 * immediately instead of queuing and holding the request.
 */
@Module({
  providers: [
    {
      provide: THROTTLER_REDIS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const client = new Redis({
          ...queueRedisOptions(configService, 'throttler'),
          enableOfflineQueue: false,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
        });
        // An 'error' event with no listener crashes the whole process — the
        // same note as ChatPubSubService and the SMS limiter.
        client.on('error', (err) =>
          new Logger('ThrottlerRedis').warn(`Redis error: ${String(err)}`),
        );
        return client;
      },
    },
    RedisThrottlerStorage,
  ],
  exports: [THROTTLER_REDIS, RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
