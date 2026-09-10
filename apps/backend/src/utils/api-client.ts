import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { Effect, Schema } from 'effect';

/**
 * A network call that couldn't produce an answer at all (timeout, DNS
 * failure, non-2xx). `cause` is deliberately a sanitized summary, not the
 * raw AxiosError — see `sanitizeAxiosError`'s doc comment below for why.
 */
export class ApiClientError extends Schema.TaggedError<ApiClientError>()(
  'ApiClientError',
  {
    message: Schema.String,
    status: Schema.optional(Schema.Number),
    data: Schema.optional(Schema.Unknown),
  },
) {}

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ApiClient {
  post<T>(
    path: string,
    body: unknown,
    config?: AxiosRequestConfig,
  ): Effect.Effect<T, ApiClientError>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * An AxiosError's `.config` carries the *request* config back, including
 * any `Authorization` header we set at client-creation time — passing the
 * raw error through as `ApiClientError.cause` would mean a future
 * `JSON.stringify`/logger call on the failure could print our own bearer
 * token. Keep only the response-facing fields (message/status/body), which
 * are the provider's own words, not our secret.
 */
function sanitizeAxiosError(error: unknown): {
  message: string;
  status?: number;
  data?: unknown;
} {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * Thin Effect wrapper around a single-host axios instance, for a provider
 * that calls one external gateway over HTTP. Deliberately minimal — this is
 * the first thing to harden further before trusting it with a second
 * provider or a more adversarial gateway host:
 *
 * TODO(security): no response schema validation — a shape change from the
 * provider is trusted blindly. Decode with `Schema.decodeUnknown` per
 * response type once callers need that guarantee.
 * TODO(security): no retry/backoff or circuit breaker — a transient
 * failure costs the caller its one attempt today (BullMQ's own retry is
 * the only safety net, at the whole-job granularity).
 * TODO(security): no host allowlist beyond the HTTPS check below — a
 * misconfigured `baseUrl` env var still points this at *some* HTTPS host,
 * just not necessarily the right one.
 * TODO(security): no mTLS / certificate pinning — relies entirely on the
 * platform's default trust store.
 * TODO(security): no request signing beyond whatever's baked into
 * `headers` at construction time.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  if (!config.baseUrl.startsWith('https://')) {
    throw new Error(
      `Refusing to create an API client for a non-HTTPS base URL: ${config.baseUrl}`,
    );
  }

  const instance: AxiosInstance = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    headers: config.headers,
  });

  return {
    post<T>(path: string, body: unknown, requestConfig?: AxiosRequestConfig) {
      return Effect.tryPromise({
        try: async () => {
          const response = await instance.post<T>(path, body, requestConfig);
          return response.data;
        },
        catch: (cause) => new ApiClientError(sanitizeAxiosError(cause)),
      });
    },
  };
}
