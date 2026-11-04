import { z } from 'zod';

const baseEnvSchema = z.object({
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
  // Private bucket for E2E chat attachments (ciphertext only). Create it in
  // the Supabase dashboard with public off, a 25 MB file size limit and
  // allowed MIME type application/octet-stream.
  CHAT_FILES_BUCKET: z.string().default('chat-files'),
  // Private bucket for uploaded CV files. Create it in the Supabase dashboard
  // with public off, a 5 MB file size limit and allowed MIME types
  // application/pdf, application/msword,
  // application/vnd.openxmlformats-officedocument.wordprocessingml.document and
  // text/plain — a CV is personal data, so it is never a public URL and never
  // goes near the `listings` bucket.
  RESUME_FILES_BUCKET: z.string().default('resume-files'),
  CHAT_ATTACHMENT_DAILY_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(209_715_200),
  DATABASE_URL: z.string().refine((v) => v.startsWith('postgres'), {
    message: 'DATABASE_URL must start with postgres',
  }),
  // postgres.js defaults this to 10, which the whole backend shares (every
  // module, not just chat) — too small once anything sends concurrent
  // queries, where requests start queueing for a free pool connection.
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  // PlasGate SMS — all optional; SmsOutboxHandler no-ops (records a
  // `skipped` row) unless the private key, secret and sender are all set.
  // SMS_BASE_URL defaults to PlasGate's own endpoint.
  SMS_BASE_URL: z.string().url().optional(),
  SMS_PRIVATE_KEY: z.string().optional(),
  SMS_SECRET: z.string().optional(),
  SMS_SENDER: z.string().optional(),
  // Shared PlasGate budget enforced across every instance via
  // SmsRateLimiter (Redis-backed). PlasGate's own ceiling is 200/minute;
  // this leaves headroom.
  SMS_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(150),
  // Per-user spam limits (SmsUserLimiter): one SMS per user per notification
  // type per cooldown window, and a daily cap per user.
  SMS_USER_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(300),
  SMS_USER_DAILY_CAP: z.coerce.number().int().positive().default(10),
  DEV_OTP_TOKEN: z.string().optional(),
  // Which backend issues/verifies phone OTPs: Supabase (the old behaviour) or
  // our own `OtpService` over PlasGate (the shipped default). `OTP_HMAC_SECRET`
  // keys the code hash; unset, `OtpService` derives one from JWT_SECRET and
  // warns once.
  OTP_PROVIDER: z.enum(['supabase', 'plasgate']).default('plasgate'),
  OTP_HMAC_SECRET: z.string().min(16).optional(),
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
  OUTBOX_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  // Longest an idle worker sleeps between due-time checks (one cheap query).
  // A producer in this process wakes the pool instantly and backoff retries
  // fire at their own due time, so this only bounds the latency of a lost
  // wakeup or of a producer in ANOTHER process (e.g. an API-only instance
  // whose drainers run elsewhere) — lower it for that topology.
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().default(5),
  // How long a claim is honoured before another dispatcher may steal the
  // row. Must exceed the slowest realistic handler, or two dispatchers will
  // work the same event.
  OUTBOX_LEASE_TIMEOUT_SECONDS: z.coerce.number().default(60),
  OUTBOX_BACKOFF_BASE_MS: z.coerce.number().default(1000),
  OUTBOX_BACKOFF_FACTOR: z.coerce.number().default(5),
  OUTBOX_BACKOFF_MAX_MS: z.coerce.number().default(900000),
  OUTBOX_RETENTION_DAYS: z.coerce.number().default(7),

  // Sweeper that hard-deletes self-deleted accounts once their 90-day
  // recovery window closes. Every instance sweeps by default — claiming is
  // atomic, so more sweepers just delete sooner. Set false to run an
  // instance that must never delete anything.
  ACCOUNT_PURGE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ACCOUNT_PURGE_INTERVAL_MS: z.coerce.number().default(21600000),

  // BullMQ queue configuration
  QUEUE_HOST: z.string().default('localhost'),
  QUEUE_PORT: z.coerce.number().default(6379),
  // ACL user. Leave unset for the built-in `default` user, which Redis
  // authenticates from the password alone (Redis Cloud's default setup).
  QUEUE_USERNAME: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  // Coerced to undefined when blank: an empty `QUEUE_PASSWORD=` line in a
  // .env would otherwise be sent to Redis as an empty password and fail auth.
  QUEUE_PASSWORD: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  // A numbered Redis database, not a provider's database name. Managed
  // Redis (Redis Cloud, Upstash) only offers 0.
  QUEUE_DB: z.coerce.number().default(0),
  // Connect over TLS (rediss://). Required by some managed Redis plans; off
  // for a local Redis.
  QUEUE_TLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Namespaces every BullMQ key, so a shared Redis can host more than one
  // environment without one draining the other's jobs.
  QUEUE_PREFIX: z.string().default('phsarkhmer'),

  // Payment job retry policy (BullMQ-side, distinct from the outbox budget)
  PAYMENT_JOB_ATTEMPTS: z.coerce.number().default(3),
  PAYMENT_JOB_BACKOFF_MS: z.coerce.number().default(5000),
  PAYMENT_WORKER_CONCURRENCY: z.coerce.number().default(5),

  // Payment reconciler — the guarantee that a payment which was actually made
  // settles even if the app crashed, the poll chain broke, or the browser
  // closed. Reads straight from Postgres (no BullMQ, no outbox row), so it
  // works whichever instance runs it. See src/payment/reconciler/.
  PAYMENT_RECONCILER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  PAYMENT_RECONCILE_INTERVAL_MS: z.coerce.number().default(15_000),
  // Gap between passes while nothing is unresolved (no pending attempt, nothing
  // to activate or expire). Any activity returns to the interval above.
  PAYMENT_RECONCILE_IDLE_INTERVAL_MS: z.coerce.number().default(60_000),
  // Providers the reconciler polls: only those with no webhook (Bakong). ABA
  // PayWay is webhook-only — its expiry is `ABA_PAYWAY_LIFETIME_MINUTES`.
  PAYMENT_RECONCILE_PROVIDERS: z.string().default('bakong'),
  // A pending attempt this old that the provider still reports unpaid is
  // failed (the QR has long expired). 15 min vs. the 5 min QR lifetime.
  PAYMENT_PENDING_ABANDON_MS: z.coerce.number().default(15 * 60 * 1000),
  // How long after creation a failed-by-timeout attempt is still checked, so
  // a late-arriving payment is honoured instead of lost.
  PAYMENT_LATE_PAYMENT_GRACE_MS: z.coerce.number().default(24 * 60 * 60 * 1000),
  // Shared secret for `POST /internal/payments/reconcile`, the wake-up an
  // external pinger/cron calls when nobody is on a checkout page. Blank or
  // absent disables the route (it answers 503) instead of failing the boot.
  INTERNAL_RECONCILE_SECRET: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => value?.trim() || undefined)
    .refine((value) => value === undefined || value.length >= 16, {
      message: 'INTERNAL_RECONCILE_SECRET must be at least 16 characters',
    }),

  // ABA PayWay gateway credentials. Optional so build/tests don't require
  // sandbox access — AbaPaywayProvider fails fast with a clear message if
  // charge()/reconcile() is actually called unconfigured.
  ABA_PAYWAY_API_KEY: z.string().optional().default(''),
  ABA_PAYWAY_MERCHANT_ID: z.string().optional().default(''),
  ABA_PAYWAY_BASE_URL: z
    .string()
    // Confirmed against ABA's own developer docs (developer.payway.com.kh)
    // — the old default (checkout-sandbox.abapayway.com) was never a real
    // ABA domain.
    .default('https://checkout-sandbox.payway.com.kh'),
  // The `return_url` ABA PayWay is told to POST payment results to on
  // every purchase call — this backend's own public
  // /api/v1/payments/webhooks/aba-payway route. Must be a publicly
  // reachable absolute URL (ABA calls it server-to-server); optional so
  // build/tests don't require one, but charge() refuses to call ABA
  // without it configured — silently omitting it would mean ABA has
  // nowhere to report a payment outcome to.
  ABA_PAYWAY_WEBHOOK_URL: z.string().optional().default(''),
  // How long an ABA checkout stays payable (ABA's `lifetime`, minutes, min 3;
  // ABA defaults to 30 days if omitted). After it ABA rejects the payment.
  ABA_PAYWAY_LIFETIME_MINUTES: z.coerce.number().int().min(3).default(15),

  // Bakong KHQR credentials/merchant identity. Unlike ABA, Bakong has no
  // server-side "create transaction" call — BakongProvider.charge() builds
  // the KHQR string locally via the bakong-khqr SDK using these fields, and
  // only BAKONG_API_KEY (a bearer token issued from Bakong's developer
  // portal) is used for a real network call, to check_transaction_by_md5.
  // All optional so build/tests don't require real Bakong credentials —
  // BakongProvider fails fast with a clear message if charge()/reconcile()
  // is actually called unconfigured.
  BAKONG_BASE_URL: z.string().default('https://api-bakong.nbc.gov.kh'),
  BAKONG_API_KEY: z.string().optional().default(''),
  // 'individual' needs only BAKONG_ACCOUNT_ID + BAKONG_MERCHANT_NAME (a
  // personal Bakong account alias — no business registration). 'merchant'
  // additionally needs BAKONG_MERCHANT_ID + BAKONG_ACQUIRING_BANK, issued
  // by a participating bank/PSP through merchant onboarding. Defaults to
  // 'individual' since that's the zero-setup path for local dev/testing.
  BAKONG_MERCHANT_TYPE: z
    .enum(['individual', 'merchant'])
    .default('individual'),
  BAKONG_MERCHANT_ID: z.string().optional().default(''),
  BAKONG_ACCOUNT_ID: z.string().optional().default(''),
  BAKONG_MERCHANT_NAME: z.string().optional().default(''),
  BAKONG_MERCHANT_CITY: z.string().optional().default('Phnom Penh'),
  BAKONG_ACQUIRING_BANK: z.string().optional().default(''),
  // How long a generated KHQR stays scannable before Bakong considers it
  // expired — bakong-khqr requires an expirationTimestamp for any KHQR that
  // carries an amount (a "dynamic" QR), so this always applies here.
  BAKONG_QR_EXPIRY_SECONDS: z.coerce.number().default(300),
});

/** PlasGate credentials the own-OTP path needs before it can deliver a code. */
const SMS_CREDENTIAL_KEYS = [
  'SMS_PRIVATE_KEY',
  'SMS_SECRET',
  'SMS_SENDER',
] as const;

function missingSmsCredentials(env: EnvConfig): string[] {
  return SMS_CREDENTIAL_KEYS.filter((key) => !env[key]);
}

const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  // A fixed OTP accepted for every phone is a dev convenience, but the
  // password-reset flow turns it into an account-takeover primitive: anyone
  // who knows an identifier could verify with the static token and set a new
  // password. Fail the boot instead of shipping the bypass.
  if (env.NODE_ENV === 'production' && env.DEV_OTP_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DEV_OTP_TOKEN'],
      message: 'DEV_OTP_TOKEN must not be set in production',
    });
  }

  // `plasgate` is the default provider, so a production boot without the
  // sender credentials would answer every registration, OTP login and
  // password reset with "code sent" while no SMS can ever leave. Fail the
  // boot instead of shipping an auth surface that silently does nothing.
  if (env.OTP_PROVIDER === 'plasgate' && env.NODE_ENV === 'production') {
    const missing = missingSmsCredentials(env);
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OTP_PROVIDER'],
        message: `OTP_PROVIDER=plasgate requires ${missing.join(', ')} so codes can be delivered`,
      });
    }
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Config validation failed:\n${result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n')}`,
    );
  }
  // Outside production a missing sender still leaves the OTP flows unusable,
  // but failing every local boot (tests, builds) is too blunt. Warn once per
  // non-test environment so the symptom is traceable instead of a silent
  // "code sent".
  if (
    result.data.OTP_PROVIDER === 'plasgate' &&
    result.data.NODE_ENV !== 'test'
  ) {
    const missing = missingSmsCredentials(result.data);
    if (missing.length > 0) {
      console.warn(
        `[config] OTP_PROVIDER=plasgate without ${missing.join(', ')}: SMS OTP delivery is disabled in this environment.`,
      );
    }
  }
  return result.data;
}
