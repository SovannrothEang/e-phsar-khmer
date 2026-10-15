import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient, DbExecutor } from '../db/drizzle.provider';
import {
  subscriptionPackages,
  subscriptionPurchases,
  subscriptionTerms,
  userSubscriptions,
} from '../db/schema/subscriptions.schema';
import { users } from '../db/schema/users.schema';
import { EntitlementsService } from './entitlements.service';

export interface PaidPurchaseSettlement {
  purchaseId: string;
  paymentTransactionId: string;
  customerId: string | null;
  amount: string;
  currency: string;
}

export type SubscriptionActivationResult =
  | { status: 'activated'; subscriptionId: string }
  | {
      status:
        | 'already_paid'
        | 'not_found'
        | 'not_pending'
        | 'payment_link_pending'
        | 'payment_mismatch';
    };

interface OfferSnapshot {
  durationValue?: unknown;
  durationUnit?: unknown;
}

export function addDuration(
  from: Date,
  value: number,
  unit: 'day' | 'month' | 'year',
): Date {
  const result = new Date(from);
  if (unit === 'day') result.setDate(result.getDate() + value);
  else if (unit === 'month') result.setMonth(result.getMonth() + value);
  else result.setFullYear(result.getFullYear() + value);
  return result;
}

function toMinorUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function matchesSettlement(
  purchase: {
    userId: string;
    paymentTransactionId: string | null;
    amountUsd: string;
    currency: string;
  },
  settlement: PaidPurchaseSettlement,
): boolean {
  const expectedAmount = toMinorUnits(purchase.amountUsd);
  const settledAmount = toMinorUnits(settlement.amount);

  return (
    purchase.paymentTransactionId === settlement.paymentTransactionId &&
    settlement.customerId === purchase.userId &&
    expectedAmount !== null &&
    settledAmount !== null &&
    expectedAmount === settledAmount &&
    purchase.currency === settlement.currency
  );
}

function durationFromSnapshot(snapshot: unknown): {
  value: number;
  unit: 'day' | 'month' | 'year';
} {
  const offer = snapshot as OfferSnapshot | null;
  const value = offer?.durationValue;
  const unit = offer?.durationUnit;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    (unit !== 'day' && unit !== 'month' && unit !== 'year')
  ) {
    throw new BadRequestException(
      'Subscription purchase has invalid offer snapshot',
    );
  }
  return { value, unit };
}

@Injectable()
export class SubscriptionActivationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly entitlements: EntitlementsService,
  ) {}

  async activatePaidPurchase(
    settlement: PaidPurchaseSettlement,
  ): Promise<SubscriptionActivationResult> {
    const result = await this.db.transaction((tx) =>
      this.activatePurchaseInTx(tx, settlement.purchaseId, settlement),
    );
    if (result.status === 'activated' && settlement.customerId) {
      await this.entitlements.reconcileListingsSafely(settlement.customerId);
    }
    return result;
  }

  private async activatePurchaseInTx(
    tx: DbExecutor,
    purchaseId: string,
    settlement?: PaidPurchaseSettlement,
  ): Promise<SubscriptionActivationResult> {
    const [purchase] = await tx
      .select()
      .from(subscriptionPurchases)
      .where(eq(subscriptionPurchases.id, purchaseId))
      .for('update')
      .limit(1);

    if (!purchase) return { status: 'not_found' };
    if (purchase.status === 'paid') return { status: 'already_paid' };
    if (purchase.status !== 'pending') return { status: 'not_pending' };

    if (settlement) {
      if (!purchase.paymentTransactionId) {
        return { status: 'payment_link_pending' };
      }
      if (!matchesSettlement(purchase, settlement)) {
        return { status: 'payment_mismatch' };
      }
    } else if (purchase.kind !== 'manual_comp') {
      return { status: 'payment_mismatch' };
    }

    // Serialize activation of different purchases for one user, so concurrent
    // upgrades cannot both replace the same active subscription.
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, purchase.userId))
      .for('update');

    const duration = durationFromSnapshot(purchase.offerSnapshot);
    const now = new Date();
    const [active] = await tx
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, purchase.userId),
          isNull(userSubscriptions.supersededAt),
          gt(userSubscriptions.expiresAt, now),
        ),
      )
      .orderBy(desc(userSubscriptions.expiresAt))
      .limit(1);

    // Paid upgrades keep the current expiry boundary (checkout already
    // prorated the price to the remaining time). An admin comp is a fresh
    // grant, so it always starts a full term.
    const expiresAt =
      active && purchase.kind !== 'manual_comp'
        ? active.expiresAt
        : addDuration(now, duration.value, duration.unit);

    if (active) {
      await tx
        .update(userSubscriptions)
        .set({ supersededAt: now, supersededReason: 'upgrade' })
        .where(eq(userSubscriptions.id, active.id));
    }

    const [subscription] = await tx
      .insert(userSubscriptions)
      .values({
        userId: purchase.userId,
        termId: purchase.termId,
        priceUsd: purchase.amountUsd,
        paymentMethod: purchase.kind === 'manual_comp' ? 'comp' : 'bakong',
        subscribedAt: now,
        expiresAt,
      })
      .returning({ id: userSubscriptions.id });

    await tx
      .update(subscriptionPurchases)
      .set({
        status: 'paid',
        paidAt: now,
        subscriptionId: subscription.id,
      })
      .where(eq(subscriptionPurchases.id, purchase.id));

    return { status: 'activated', subscriptionId: subscription.id };
  }

  async grantManual(input: {
    userId: string;
    termId: string;
    reason: string;
  }): Promise<{ id: string }> {
    const granted = await this.db.transaction(async (tx) => {
      const [term] = await tx
        .select()
        .from(subscriptionTerms)
        .where(eq(subscriptionTerms.id, input.termId))
        .limit(1);
      if (!term) throw new NotFoundException('Subscription term not found');

      const [pkg] = await tx
        .select()
        .from(subscriptionPackages)
        .where(eq(subscriptionPackages.id, term.packageId))
        .limit(1);
      if (!pkg) throw new NotFoundException('Subscription package not found');

      const [purchase] = await tx
        .insert(subscriptionPurchases)
        .values({
          userId: input.userId,
          termId: term.id,
          kind: 'manual_comp',
          status: 'pending',
          amountUsd: '0',
          currency: 'USD',
          offerSnapshot: {
            termId: term.id,
            termName: term.name,
            durationValue: term.durationValue,
            durationUnit: term.durationUnit,
            packageId: pkg.id,
            packageName: pkg.name,
            photos: pkg.photos,
            ads: pkg.ads,
            renews: pkg.renews,
            autoRenews: pkg.autoRenews,
            videos: pkg.videos,
            reason: input.reason,
          },
        })
        .returning({ id: subscriptionPurchases.id });

      const activation = await this.activatePurchaseInTx(tx, purchase.id);
      if (activation.status !== 'activated') {
        throw new Error(
          `Manual subscription grant failed: ${activation.status}`,
        );
      }
      return { id: activation.subscriptionId };
    });
    await this.entitlements.reconcileListingsSafely(input.userId);
    return granted;
  }
}
