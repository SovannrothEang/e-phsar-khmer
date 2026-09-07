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
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),
  // Outbox worker pool. Every instance drains by default — claiming is
  // atomic, so more pollers just drain faster. Set false to run an instance
  // API-only.
  OUTBOX_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  OUTBOX_WORKER_CONCURRENCY: z.coerce.number().default(5),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  OUTBOX_BATCH_SIZE: z.coerce.number().default(10),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().default(5),
  // How long a claim is honoured before another dispatcher may steal the
  // row. Must exceed the slowest realistic handler, or two dispatchers will
  // work the same event.
  OUTBOX_LEASE_TIMEOUT_SECONDS: z.coerce.number().default(60),
  OUTBOX_BACKOFF_BASE_MS: z.coerce.number().default(1000),
  OUTBOX_BACKOFF_FACTOR: z.coerce.number().default(5),
  OUTBOX_BACKOFF_MAX_MS: z.coerce.number().default(900000),
  OUTBOX_RETENTION_DAYS: z.coerce.number().default(7),

  // BullMQ queue configuration
  QUEUE_HOST: z.string().default('localhost'),
  QUEUE_PORT: z.coerce.number().default(6379),
  // Coerced to undefined when blank: an empty `QUEUE_PASSWORD=` line in a
  // .env would otherwise be sent to Redis as an empty password and fail auth.
  QUEUE_PASSWORD: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  QUEUE_DB: z.coerce.number().default(0),
  // Namespaces every BullMQ key, so a shared Redis can host more than one
  // environment without one draining the other's jobs.
  QUEUE_PREFIX: z.string().default('psa'),

  // Payment job retry policy (BullMQ-side, distinct from the outbox budget)
  PAYMENT_JOB_ATTEMPTS: z.coerce.number().default(3),
  PAYMENT_JOB_BACKOFF_MS: z.coerce.number().default(5000),
  PAYMENT_WORKER_CONCURRENCY: z.coerce.number().default(5),
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
