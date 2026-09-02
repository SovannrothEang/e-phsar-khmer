import { validate } from './config.validation';

export default () => {
  const env = validate(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendOrigins: env.FRONTEND_ORIGINS
      ? env.FRONTEND_ORIGINS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      jwtSecret: env.SUPABASE_JWT_SECRET,
      storageBucket: env.SUPABASE_STORAGE_BUCKET,
    },
    database: {
      url: env.DATABASE_URL,
    },
    jwt: {
      secret: env.JWT_SECRET,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
    },
    devOtpToken: env.DEV_OTP_TOKEN,
    idempotency: {
      ttlHours: env.IDEMPOTENCY_TTL_HOURS,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
    outbox: {
      workerEnabled: env.OUTBOX_WORKER_ENABLED,
      workerConcurrency: env.OUTBOX_WORKER_CONCURRENCY,
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
      batchSize: env.OUTBOX_BATCH_SIZE,
      maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      leaseTimeoutSeconds: env.OUTBOX_LEASE_TIMEOUT_SECONDS,
      backoffBaseMs: env.OUTBOX_BACKOFF_BASE_MS,
      backoffFactor: env.OUTBOX_BACKOFF_FACTOR,
      backoffMaxMs: env.OUTBOX_BACKOFF_MAX_MS,
      retentionDays: env.OUTBOX_RETENTION_DAYS,
    },
  };
};
