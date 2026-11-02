import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_BASE_URL = 'https://cloudapi.plasgate.com/rest/send';
const REQUEST_TIMEOUT_MS = 10_000;

export type PlasGateOutcome = 'sent' | 'retry' | 'failed';

export interface PlasGateSendResult {
  outcome: PlasGateOutcome;
  /** HTTP status, when the request actually reached PlasGate. */
  providerStatus?: number;
  /** Response body (or a local error message for a network failure/timeout) — never the request. */
  providerReply?: string;
}

/**
 * Thin HTTP wrapper over PlasGate's single-message endpoint
 * (`POST {base}?private_key=…`, header `X-Secret`, body
 * `{ sender, to, content }`; PlasGate's own ceiling is 200 requests/minute —
 * `SmsRateLimiter` keeps `SmsOutboxHandler` under that before this client is
 * ever called).
 *
 * Carries no retry logic of its own — `send()` only classifies the HTTP
 * outcome into `sent | retry | failed`; `SmsOutboxHandler` is what turns
 * that into an `OutboxHandler` result. Never logs the private key or secret
 * (the key rides in the URL, which this client never passes to `Logger`).
 */
@Injectable()
export class PlasGateClient {
  private readonly logger = new Logger(PlasGateClient.name);
  private readonly baseUrl: string;
  private readonly privateKey: string;
  private readonly secret: string;
  private readonly sender: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('sms.baseUrl') || DEFAULT_BASE_URL;
    this.privateKey = this.configService.get<string>('sms.privateKey') ?? '';
    this.secret = this.configService.get<string>('sms.secret') ?? '';
    this.sender = this.configService.get<string>('sms.sender') ?? '';
  }

  /** No private key, secret or sender → never dials out (dev needs no setup). */
  isConfigured(): boolean {
    return Boolean(this.privateKey && this.secret && this.sender);
  }

  async send(message: {
    to: string;
    content: string;
  }): Promise<PlasGateSendResult> {
    const url = `${this.baseUrl}?private_key=${encodeURIComponent(this.privateKey)}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': this.secret,
        },
        body: JSON.stringify({
          sender: this.sender,
          to: message.to,
          content: message.content,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const providerReply = await res.text();

      if (res.ok) {
        return { outcome: 'sent', providerStatus: res.status, providerReply };
      }

      // 429 and 5xx are PlasGate (or the network path to it) saying "try
      // later"; any other 4xx (bad sender id, bad number, …) will never
      // succeed on retry.
      const outcome: PlasGateOutcome =
        res.status === 429 || res.status >= 500 ? 'retry' : 'failed';
      return { outcome, providerStatus: res.status, providerReply };
    } catch (err) {
      // Network error, DNS failure or the AbortSignal timeout — none of
      // these reached PlasGate, so there is no provider status to report.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`PlasGate request failed: ${message}`);
      return { outcome: 'retry', providerReply: message };
    }
  }

  /** PlasGate wants digits only with the country code: `85512345678`. Local `012345678` and `+855…` both normalise to it. */
  toInternational(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('855')) return digits;
    if (digits.startsWith('0')) return `855${digits.slice(1)}`;
    return digits.length >= 8 ? `855${digits}` : null;
  }
}
