import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_ORIGINS: z.string().default(''),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('listings'),
  DATABASE_URL: z.string().refine((v) => v.startsWith('postgres'), {
    message: 'DATABASE_URL must start with postgres',
  }),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DEV_OTP_TOKEN: z.string().optional(),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().default(24),
  OUTBOX_CONCURRENCY: z.coerce.number().int().positive().default(5),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1500),
  OUTBOX_RECLAIM_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  OUTBOX_STALE_LOCK_SECONDS: z.coerce.number().int().positive().default(300),
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Config validation failed:\n${result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n')}`,
    );
  }
  return result.data;
}
