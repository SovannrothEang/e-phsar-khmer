import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { listings } from '../db/schema/listings.schema';
import {
  subscriptionPackages,
  subscriptionPurchases,
  subscriptionTerms,
  userSubscriptions,
} from '../db/schema/subscriptions.schema';
import { FREE_PLAN_LIMITS } from './entitlements.constants';
import type { PlanLimits } from './entitlements.constants';

export interface Entitlements {
  /** `free` when the user holds no live subscription. */
  plan: 'free' | 'premium';
  limits: PlanLimits;
  /** Latest expiry among the live subscriptions; null on the free plan. */
  expiresAt: Date | null;
}

export interface EntitlementsView extends Entitlements {
  usage: { ads: number };
}

const LIMIT_KEYS = ['photos', 'ads', 'renews', 'autoRenews', 'videos'] as const;

/** A number from the purchase's offer snapshot, else the live package value. */
function limitValue(
  snapshot: Record<string, unknown> | null,
  key: keyof PlanLimits,
  live: number | null,
): number {
  const frozen = snapshot?.[key];
  return typeof frozen === 'number' ? frozen : (live ?? 0);
}

/**
 * The single place a user's plan limits are decided. A subscription is just a
 * label until something reads it — every enforcement point (post, edit,
 * publish, renew, public visibility) goes through here.
 *
 * Rules: limits are global per user; the free plan is the floor (a subscriber
 * is never worse off than a free user); if several subscriptions are somehow
 * live at once, each limit takes the highest value; limits come from the
 * purchase's frozen offer snapshot, so editing a package later never changes
 * what a customer already bought.
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async resolve(userId: string): Promise<Entitlements> {
    const rows = await this.db
      .select({
        expiresAt: userSubscriptions.expiresAt,
        offerSnapshot: subscriptionPurchases.offerSnapshot,
        photos: subscriptionPackages.photos,
        ads: subscriptionPackages.ads,
        renews: subscriptionPackages.renews,
        autoRenews: subscriptionPackages.autoRenews,
        videos: subscriptionPackages.videos,
      })
      .from(userSubscriptions)
      .leftJoin(
        subscriptionTerms,
        eq(subscriptionTerms.id, userSubscriptions.termId),
      )
      .leftJoin(
        subscriptionPackages,
        eq(subscriptionPackages.id, subscriptionTerms.packageId),
      )
      .leftJoin(
        subscriptionPurchases,
        eq(subscriptionPurchases.subscriptionId, userSubscriptions.id),
      )
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          isNull(userSubscriptions.supersededAt),
          gt(userSubscriptions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(userSubscriptions.expiresAt));

    if (rows.length === 0) {
      return { plan: 'free', limits: { ...FREE_PLAN_LIMITS }, expiresAt: null };
    }

    const limits: PlanLimits = { ...FREE_PLAN_LIMITS };
    for (const row of rows) {
      const snapshot = row.offerSnapshot as Record<string, unknown> | null;
      for (const key of LIMIT_KEYS) {
        limits[key] = Math.max(
          limits[key],
          limitValue(snapshot, key, row[key]),
        );
      }
    }
    return { plan: 'premium', limits, expiresAt: rows[0].expiresAt };
  }

  /** Ads that count against the allowance: live (active or restricted) and unexpired. */
  async countLiveAds(userId: string, excludeId?: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(
        and(
          eq(listings.userId, userId),
          inArray(listings.status, ['active', 'restricted']),
          or(isNull(listings.expiresAt), gt(listings.expiresAt, new Date())),
          excludeId ? sql`${listings.id} <> ${excludeId}` : undefined,
        ),
      );
    return row?.count ?? 0;
  }

  async view(userId: string): Promise<EntitlementsView> {
    const [entitlements, ads] = await Promise.all([
      this.resolve(userId),
      this.countLiveAds(userId),
    ]);
    return { ...entitlements, usage: { ads } };
  }

  /**
   * `requested` photos on one ad. `alreadyHas` grandfathers photos the ad
   * already carries (e.g. uploaded under a plan that has since lapsed), so a
   * user can still edit the text without being forced to delete photos.
   */
  async assertPhotos(
    userId: string,
    requested: number,
    alreadyHas = 0,
  ): Promise<void> {
    const { limits } = await this.resolve(userId);
    if (requested > Math.max(limits.photos, alreadyHas)) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_PHOTOS',
        message: `Your plan allows ${limits.photos} photos per ad. Upgrade your subscription to add more.`,
      });
    }
  }

  /** A new ad (or a re-post of one that is no longer counted) needs a free slot. */
  async assertCanHoldAnotherAd(userId: string, excludeId?: string) {
    const [{ limits }, live] = await Promise.all([
      this.resolve(userId),
      this.countLiveAds(userId, excludeId),
    ]);
    if (live >= limits.ads) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_ADS',
        message: `Your plan allows ${limits.ads} active ads and you have ${live}. Upgrade your subscription or remove an ad to post another.`,
      });
    }
  }

  async assertCanRenew(userId: string, renewCount: number): Promise<void> {
    const { limits } = await this.resolve(userId);
    if (renewCount >= limits.renews) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_RENEWS',
        message:
          limits.renews === 0
            ? 'Your plan does not include renewals. Upgrade your subscription to renew this ad.'
            : `This ad has used all ${limits.renews} renewals your plan includes.`,
      });
    }
  }

  /**
   * Brings the user's live ads in line with their current allowance: the
   * newest `ads` stay (or become) public, the rest are restricted from public
   * browsing — not deleted, so renewing the plan brings them straight back.
   * Idempotent; safe to call after any change to the subscription or ads.
   */
  async reconcileListings(
    userId: string,
  ): Promise<{ restricted: number; restored: number }> {
    const { limits } = await this.resolve(userId);
    const live = await this.db
      .select({ id: listings.id, status: listings.status })
      .from(listings)
      .where(
        and(
          eq(listings.userId, userId),
          inArray(listings.status, ['active', 'restricted']),
          or(isNull(listings.expiresAt), gt(listings.expiresAt, new Date())),
        ),
      )
      .orderBy(
        desc(sql`coalesce(${listings.publishedAt}, ${listings.createdAt})`),
        desc(listings.id),
      );

    const toRestore = live
      .slice(0, limits.ads)
      .filter((row) => row.status === 'restricted')
      .map((row) => row.id);
    const toRestrict = live
      .slice(limits.ads)
      .filter((row) => row.status === 'active')
      .map((row) => row.id);

    if (toRestore.length > 0) {
      await this.db
        .update(listings)
        .set({ status: 'active', updatedAt: new Date() })
        .where(inArray(listings.id, toRestore));
    }
    if (toRestrict.length > 0) {
      await this.db
        .update(listings)
        .set({ status: 'restricted', updatedAt: new Date() })
        .where(inArray(listings.id, toRestrict));
    }
    return { restricted: toRestrict.length, restored: toRestore.length };
  }

  /** Best-effort wrapper for callers that must not fail because of it; the sweep heals. */
  async reconcileListingsSafely(userId: string): Promise<void> {
    try {
      await this.reconcileListings(userId);
    } catch (err) {
      this.logger.warn(
        `Could not reconcile listings for ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Periodic sweep: only users who could be out of line — anyone holding
   * restricted ads (maybe renewed), or more live ads than the free plan
   * allows (maybe lapsed). Returns how many users it looked at.
   */
  async reconcileAll(): Promise<number> {
    const candidates = await this.db
      .select({ userId: listings.userId })
      .from(listings)
      .where(inArray(listings.status, ['active', 'restricted']))
      .groupBy(listings.userId)
      .having(
        sql`count(*) filter (where ${listings.status} = 'restricted') > 0 or count(*) > ${FREE_PLAN_LIMITS.ads}`,
      );
    for (const { userId } of candidates) {
      await this.reconcileListingsSafely(userId);
    }
    return candidates.length;
  }
}
