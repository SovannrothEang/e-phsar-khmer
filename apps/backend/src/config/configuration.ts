import { validate } from './config.validation';

export default () => {
  const env = validate(process.env);
  // `api` must not hold background work: on a scale-to-zero host every
  // instance that does is an instance that never idles. The role is the
  // master switch; the individual OUTBOX_WORKER_ENABLED / ACCOUNT_PURGE_ENABLED
  // / PAYMENT_RECONCILER_ENABLED flags keep working inside the worker shapes.
  const runsBackgroundWork = env.APP_ROLE !== 'api';
  const defaultPoolMax =
    env.APP_ROLE === 'api' ? 5 : env.APP_ROLE === 'worker' ? 15 : 20;
  return {
    nodeEnv: env.NODE_ENV,
    appRole: env.APP_ROLE,
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
    chat: {
      filesBucket: env.CHAT_FILES_BUCKET,
      attachmentDailyBytes: env.CHAT_ATTACHMENT_DAILY_BYTES,
    },
    resume: {
      filesBucket: env.RESUME_FILES_BUCKET,
    },
    database: {
      url: env.DATABASE_URL,
      poolMax: env.DATABASE_POOL_MAX ?? defaultPoolMax,
      connectTimeoutSeconds: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
      idleTimeoutSeconds: env.DATABASE_IDLE_TIMEOUT_SECONDS,
      maxLifetimeSeconds: env.DATABASE_MAX_LIFETIME_SECONDS,
      statementTimeoutMs: env.DATABASE_STATEMENT_TIMEOUT_MS,
      lockTimeoutMs: env.DATABASE_LOCK_TIMEOUT_MS,
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
    sms: {
      baseUrl: env.SMS_BASE_URL,
      privateKey: env.SMS_PRIVATE_KEY,
      secret: env.SMS_SECRET,
      sender: env.SMS_SENDER,
      rateLimitPerMinute: env.SMS_RATE_LIMIT_PER_MINUTE,
      userCooldownSeconds: env.SMS_USER_COOLDOWN_SECONDS,
      userDailyCap: env.SMS_USER_DAILY_CAP,
    },
    devOtpToken: env.DEV_OTP_TOKEN,
    otp: {
      provider: env.OTP_PROVIDER,
      hmacSecret: env.OTP_HMAC_SECRET,
    },
    idempotency: {
      ttlHours: env.IDEMPOTENCY_TTL_HOURS,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
    outbox: {
      workerEnabled: env.OUTBOX_WORKER_ENABLED && runsBackgroundWork,
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
    accounts: {
      purgeEnabled: env.ACCOUNT_PURGE_ENABLED && runsBackgroundWork,
      purgeIntervalMs: env.ACCOUNT_PURGE_INTERVAL_MS,
    },
    queue: {
      host: env.QUEUE_HOST,
      port: env.QUEUE_PORT,
      username: env.QUEUE_USERNAME,
      password: env.QUEUE_PASSWORD,
      db: env.QUEUE_DB,
      tls: env.QUEUE_TLS,
      prefix: env.QUEUE_PREFIX,
    },
    payment: {
      jobAttempts: env.PAYMENT_JOB_ATTEMPTS,
      jobBackoffMs: env.PAYMENT_JOB_BACKOFF_MS,
      workerConcurrency: env.PAYMENT_WORKER_CONCURRENCY,
      reconcilerEnabled: env.PAYMENT_RECONCILER_ENABLED && runsBackgroundWork,
      reconcileIntervalMs: env.PAYMENT_RECONCILE_INTERVAL_MS,
      reconcileIdleIntervalMs: env.PAYMENT_RECONCILE_IDLE_INTERVAL_MS,
      reconcileProviders: env.PAYMENT_RECONCILE_PROVIDERS.split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      pendingAbandonMs: env.PAYMENT_PENDING_ABANDON_MS,
      latePaymentGraceMs: env.PAYMENT_LATE_PAYMENT_GRACE_MS,
      internalReconcileSecret: env.INTERNAL_RECONCILE_SECRET,
    },
    abaPayway: {
      apiKey: env.ABA_PAYWAY_API_KEY,
      merchantId: env.ABA_PAYWAY_MERCHANT_ID,
      baseUrl: env.ABA_PAYWAY_BASE_URL,
      webhookUrl: env.ABA_PAYWAY_WEBHOOK_URL,
      lifetimeMinutes: env.ABA_PAYWAY_LIFETIME_MINUTES,
    },
    bakong: {
      baseUrl: env.BAKONG_BASE_URL,
      apiKey: env.BAKONG_API_KEY,
      merchantType: env.BAKONG_MERCHANT_TYPE,
      merchantId: env.BAKONG_MERCHANT_ID,
      accountId: env.BAKONG_ACCOUNT_ID,
      merchantName: env.BAKONG_MERCHANT_NAME,
      merchantCity: env.BAKONG_MERCHANT_CITY,
      acquiringBank: env.BAKONG_ACQUIRING_BANK,
      qrExpirySeconds: env.BAKONG_QR_EXPIRY_SECONDS,
    },
  };
};
