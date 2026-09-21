import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import {
  userE2eIdentities,
  userE2eOneTimePrekeys,
} from '../../db/schema/chat.schema';
import { isBlockedEitherWay } from '../blocks.util';
import type { RegisterE2eKeysDto } from './dto/register-e2e-keys.dto';
import type { E2eKeyBundle } from './e2e-keys.types';

@Injectable()
export class E2eKeysService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /**
   * Upserts the identity + signed prekey (a re-registration rotates them —
   * this is also how a second device silently invalidates the first
   * device's sessions, by design: spec decision #2 / design §9) and inserts
   * any one-time prekeys not already present. Public material only —
   * nothing here ever sees a private key.
   */
  async registerKeys(
    userId: string,
    dto: RegisterE2eKeysDto,
  ): Promise<{ accepted: number }> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(userE2eIdentities)
        .values({
          userId,
          identityKey: dto.identityKey,
          identitySigningKey: dto.identitySigningKey,
          registrationId: dto.registrationId,
          signedPrekeyId: dto.signedPrekeyId,
          signedPrekeyPublic: dto.signedPrekeyPublic,
          signedPrekeySignature: dto.signedPrekeySignature,
          signedPrekeyCreatedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: userE2eIdentities.userId,
          set: {
            identityKey: dto.identityKey,
            identitySigningKey: dto.identitySigningKey,
            registrationId: dto.registrationId,
            signedPrekeyId: dto.signedPrekeyId,
            signedPrekeyPublic: dto.signedPrekeyPublic,
            signedPrekeySignature: dto.signedPrekeySignature,
            signedPrekeyCreatedAt: sql`now()`,
            updatedAt: sql`now()`,
          },
        });

      if (dto.oneTimePrekeys.length > 0) {
        await tx
          .insert(userE2eOneTimePrekeys)
          .values(
            dto.oneTimePrekeys.map((k) => ({
              userId,
              prekeyId: k.prekeyId,
              publicKey: k.publicKey,
            })),
          )
          // Matches the partial unique index — a replayed registration call
          // (e.g. a retried request) never duplicates a prekey id.
          .onConflictDoNothing({
            target: [
              userE2eOneTimePrekeys.userId,
              userE2eOneTimePrekeys.prekeyId,
            ],
          });
      }
    });

    return { accepted: dto.oneTimePrekeys.length };
  }

  /**
   * Fetches a bundle to start an X3DH handshake, atomically claiming one
   * one-time prekey in the same shape as OutboxService.claim() — SKIP LOCKED
   * so concurrent callers never claim the same row twice. A null
   * `oneTimePrekey` (pool exhausted) is a graceful degradation, not an
   * error: X3DH can proceed on the signed prekey alone.
   *
   * Gated by the same block check as ChatService.sendMessage — a block
   * disables every chat interaction surface, not just sending. Without this,
   * a blocked user could still enumerate whether the target has E2E enabled
   * and burn through their one-time prekey pool for sessions that could
   * never send a message anyway.
   */
  async getBundle(
    callerId: string,
    targetUserId: string,
  ): Promise<E2eKeyBundle> {
    if (await isBlockedEitherWay(this.db, callerId, targetUserId))
      throw new ForbiddenException('Messaging unavailable');

    const [identity] = await this.db
      .select()
      .from(userE2eIdentities)
      .where(eq(userE2eIdentities.userId, targetUserId))
      .limit(1);
    if (!identity)
      throw new NotFoundException('User has not registered E2E keys');

    const [claimed] = await this.db
      .update(userE2eOneTimePrekeys)
      .set({ usedAt: sql`now()` })
      .where(
        sql`${userE2eOneTimePrekeys.id} in (
          select ${userE2eOneTimePrekeys.id} from ${userE2eOneTimePrekeys}
          where ${userE2eOneTimePrekeys.userId} = ${targetUserId}
            and ${userE2eOneTimePrekeys.usedAt} is null
          order by ${userE2eOneTimePrekeys.prekeyId}
          for update skip locked
          limit 1
        )`,
      )
      .returning();

    return {
      identityKey: identity.identityKey,
      identitySigningKey: identity.identitySigningKey,
      registrationId: identity.registrationId,
      signedPrekeyId: identity.signedPrekeyId,
      signedPrekeyPublic: identity.signedPrekeyPublic,
      signedPrekeySignature: identity.signedPrekeySignature,
      oneTimePrekey: claimed
        ? { prekeyId: claimed.prekeyId, publicKey: claimed.publicKey }
        : null,
    };
  }

  async getPrekeyCount(userId: string): Promise<{ available: number }> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userE2eOneTimePrekeys)
      .where(
        and(
          eq(userE2eOneTimePrekeys.userId, userId),
          isNull(userE2eOneTimePrekeys.usedAt),
        ),
      );
    return { available: row?.count ?? 0 };
  }
}
