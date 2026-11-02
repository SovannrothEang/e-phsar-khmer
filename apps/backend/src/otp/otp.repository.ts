import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { phoneOtps, type PhoneOtpRow } from '../db/schema';
import type { OtpPurpose } from './otp.types';

/**
 * Persistence for `phone_otps`. Every state change is ONE conditional
 * statement (`... WHERE consumed_at IS NULL ... RETURNING`), so correctness
 * under concurrency comes from Postgres row locking, not from read-then-write
 * in application code. `OtpService` is the only caller.
 */
@Injectable()
export class OtpRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /**
   * Kills every open code for the phone+purpose and inserts the new one in a
   * single transaction, so there is never a moment with two live codes.
   */
  async replaceOpen(input: {
    phone: string;
    purpose: OtpPurpose;
    codeHash: string;
    expiresAt: Date;
    requestIp: string | null;
  }): Promise<PhoneOtpRow> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(phoneOtps)
        .set({ consumedAt: sql`now()` })
        .where(
          and(
            eq(phoneOtps.phone, input.phone),
            eq(phoneOtps.purpose, input.purpose),
            isNull(phoneOtps.consumedAt),
          ),
        );
      const [row] = await tx.insert(phoneOtps).values(input).returning();
      return row;
    });
  }

  /** Newest not-yet-consumed code for the phone, any of the purposes. */
  async findLatestOpen(
    phone: string,
    purposes: OtpPurpose[],
  ): Promise<PhoneOtpRow | null> {
    const [row] = await this.db
      .select()
      .from(phoneOtps)
      .where(
        and(
          eq(phoneOtps.phone, phone),
          inArray(phoneOtps.purpose, purposes),
          isNull(phoneOtps.consumedAt),
        ),
      )
      .orderBy(desc(phoneOtps.createdAt))
      .limit(1);
    return row ?? null;
  }

  /**
   * Spends one attempt, atomically. Returns null when the code is consumed,
   * expired or already at the attempt limit, so no more than `maxAttempts`
   * guesses are ever evaluated against a code, however many requests race.
   */
  async reserveAttempt(
    id: string,
    maxAttempts: number,
  ): Promise<PhoneOtpRow | null> {
    const [row] = await this.db
      .update(phoneOtps)
      .set({ attempts: sql`${phoneOtps.attempts} + 1` })
      .where(
        and(
          eq(phoneOtps.id, id),
          isNull(phoneOtps.consumedAt),
          gt(phoneOtps.expiresAt, sql`now()`),
          lt(phoneOtps.attempts, maxAttempts),
        ),
      )
      .returning();
    return row ?? null;
  }

  /** Single use: exactly one concurrent caller gets `true`. */
  async consume(id: string): Promise<boolean> {
    const rows = await this.db
      .update(phoneOtps)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(phoneOtps.id, id),
          isNull(phoneOtps.consumedAt),
          gt(phoneOtps.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: phoneOtps.id });
    return rows.length === 1;
  }

  /** Invalidates one code (e.g. the provider rejected the SMS). */
  async invalidate(id: string): Promise<void> {
    await this.db
      .update(phoneOtps)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(phoneOtps.id, id), isNull(phoneOtps.consumedAt)));
  }
}
