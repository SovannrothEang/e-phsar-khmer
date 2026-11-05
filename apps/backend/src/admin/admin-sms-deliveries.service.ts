import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { smsDeliveries } from '../db/schema/sms-deliveries.schema';
import type { PaginatedResponse } from '../common/types/api-response.types';
import type { ListSmsDeliveriesDto } from './dto/list-sms-deliveries.dto';

/**
 * Longest provider body returned to the admin surface. PlasGate replies are a
 * short JSON error; the cap is what keeps a pathological response from turning
 * the list into a wall of text, not a substitute for redaction.
 */
const MAX_PROVIDER_REPLY_CHARS = 500;

/**
 * One delivery attempt as staff sees it. Every column of `sms_deliveries`
 * except `outboxEventId` (an internal correlation id with no admin use) and
 * — by the table's own design — the message text, which is never stored.
 */
export interface AdminSmsDeliveryRow {
  id: string;
  userId: string | null;
  notificationType: string;
  maskedPhone: string | null;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  skipReason: string | null;
  providerStatus: number | null;
  providerReply: string | null;
  attempts: number;
  purpose: string | null;
  createdAt: Date;
}

/**
 * Read-only view over the SMS audit trail. There is no write path here on
 * purpose: rows are owned by `SmsOutboxHandler` (notification SMS) and
 * `OtpSmsSender` (OTP SMS), and staff must not be able to edit what was sent.
 */
@Injectable()
export class AdminSmsDeliveriesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly config: ConfigService,
  ) {}

  async list(
    dto: ListSmsDeliveriesDto,
  ): Promise<PaginatedResponse<AdminSmsDeliveryRow>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (dto.status) conditions.push(eq(smsDeliveries.status, dto.status));
    if (dto.userId) conditions.push(eq(smsDeliveries.userId, dto.userId));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: smsDeliveries.id,
          userId: smsDeliveries.userId,
          notificationType: smsDeliveries.notificationType,
          maskedPhone: smsDeliveries.maskedPhone,
          status: smsDeliveries.status,
          skipReason: smsDeliveries.skipReason,
          providerStatus: smsDeliveries.providerStatus,
          providerReply: smsDeliveries.providerReply,
          attempts: smsDeliveries.attempts,
          purpose: smsDeliveries.purpose,
          createdAt: smsDeliveries.createdAt,
        })
        .from(smsDeliveries)
        .where(where)
        .orderBy(desc(smsDeliveries.createdAt), desc(smsDeliveries.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(smsDeliveries).where(where),
    ]);

    const total = totalRow.value;
    return {
      data: rows.map((row) => ({
        ...row,
        providerReply: this.redactProviderReply(row.providerReply),
      })),
      meta: {
        nextCursor: null,
        hasMore: offset + rows.length < total,
        limit: pageSize,
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * PlasGate's error body is stored verbatim, and whether it can echo the
   * request (whose URL carries the private key) is an open question in this
   * module's plan. Until that is answered against the live provider, the admin
   * surface is not allowed to relay it unfiltered: any configured credential
   * that appears in the body is replaced, and the result is bounded.
   */
  private redactProviderReply(reply: string | null): string | null {
    if (!reply) return reply;

    const secrets = [
      this.config.get<string>('sms.privateKey'),
      this.config.get<string>('sms.secret'),
    ]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length >= 8,
      )
      .flatMap((value) => [value, encodeURIComponent(value)]);

    let safe = reply;
    for (const secret of secrets) safe = safe.split(secret).join('[redacted]');
    return safe.length > MAX_PROVIDER_REPLY_CHARS
      ? `${safe.slice(0, MAX_PROVIDER_REPLY_CHARS)}…`
      : safe;
  }
}
