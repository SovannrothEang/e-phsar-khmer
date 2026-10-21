import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { listings } from '../db/schema/listings.schema';
import {
  categoryTranslations,
  subcategories,
  subcategoryTranslations,
} from '../db/schema/categories.schema';
import {
  freePlanAdLimits,
  freePlanSettings,
  subscriptionCategories,
  subscriptionCategorySubcategories,
  subscriptionPackages,
  subscriptionPurchases,
  subscriptionTerms,
  userSubscriptions,
} from '../db/schema/subscriptions.schema';
import { DEFAULT_FREE_PLAN } from './entitlements.constants';
import type { PlanLimits } from './entitlements.constants';
import { bucketOf, partitionByAllowance } from './allowance';
import type {
  AdScope,
  AllowanceConfig,
  Bucket,
  BucketKey,
  HeldGroup,
  LiveAd,
} from './allowance';

export interface Entitlements {
  /** `free` when the user holds no live subscription in any group. */
  plan: 'free' | 'premium';
  limits: PlanLimits;
  /** Expiry of the subscription behind these limits; null on the free plan. */
  expiresAt: Date | null;
}

export interface BucketView {
  key: BucketKey;
  kind: 'group' | 'free';
  name: string;
  groupId: string | null;
  limits: PlanLimits;
  used: number;
  expiresAt: Date | null;
}

export interface EntitlementsView extends Entitlements {
  usage: { ads: number };
  /** The bucket `limits`/`usage` describe; null for the account overview. */
  bucket: BucketView | null;
  /** Every group the user holds, plus every free bucket they have ads in. */
  buckets: BucketView[];
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

interface Context {
  config: AllowanceConfig;
  held: Map<string, HeldGroup>;
}

/**
 * The single place a user's plan limits are decided. A subscription is just a
 * label until something reads it — every enforcement point (post, edit,
 * publish, renew, public visibility) goes through here.
 *
 * Limits are per bucket (see `allowance.ts`): a subscription covers only its
 * group's subcategories, so Auto and Property are held side by side, and an
 * ad outside every held group gets the free plan's cap for where it is
 * posted. Package limits come from the purchase's frozen offer snapshot, so
 * editing a package later never changes what a customer already bought; a
 * group's scope (which subcategories it covers) is NOT frozen — it is catalog
 * configuration and applies to everyone holding the group.
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /** Free-plan numbers and group scopes. Small tables, read whole. */
  async loadConfig(): Promise<AllowanceConfig> {
    const [settings, scopes, caps] = await Promise.all([
      this.db.select().from(freePlanSettings).limit(1),
      this.db
        .select({
          subcategoryId: subscriptionCategorySubcategories.subcategoryId,
          groupId: subscriptionCategorySubcategories.subscriptionCategoryId,
        })
        .from(subscriptionCategorySubcategories),
      this.db
        .select({
          categoryId: freePlanAdLimits.categoryId,
          subcategoryId: freePlanAdLimits.subcategoryId,
          ads: freePlanAdLimits.ads,
        })
        .from(freePlanAdLimits),
    ]);
    const row = settings[0];
    return {
      free: row
        ? {
            photos: row.photos,
            renews: row.renews,
            autoRenews: row.autoRenews,
            videos: row.videos,
            otherAds: row.otherAds,
          }
        : { ...DEFAULT_FREE_PLAN },
      subcategoryGroup: new Map(
        scopes.map((s) => [s.subcategoryId, s.groupId]),
      ),
      subcategoryCaps: new Map(
        caps.flatMap((c) =>
          c.subcategoryId ? [[c.subcategoryId, c.ads]] : [],
        ),
      ),
      categoryCaps: new Map(
        caps.flatMap((c) => (c.categoryId ? [[c.categoryId, c.ads]] : [])),
      ),
    };
  }

  /** The groups a user holds right now, keyed by group id. */
  async heldGroups(userId: string): Promise<Map<string, HeldGroup>> {
    const rows = await this.db
      .select({
        groupId: userSubscriptions.subscriptionCategoryId,
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
          isNotNull(userSubscriptions.subscriptionCategoryId),
          gt(userSubscriptions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(userSubscriptions.expiresAt));

    const held = new Map<string, HeldGroup>();
    for (const row of rows) {
      if (!row.groupId) continue;
      const snapshot = row.offerSnapshot as Record<string, unknown> | null;
      const limits = {} as PlanLimits;
      for (const key of LIMIT_KEYS) {
        limits[key] = limitValue(snapshot, key, row[key]);
      }
      // The unique index allows one current row per group; should two ever
      // be live at once, each limit takes the higher value.
      const existing = held.get(row.groupId);
      if (existing) {
        for (const key of LIMIT_KEYS) {
          existing.limits[key] = Math.max(existing.limits[key], limits[key]);
        }
        continue;
      }
      held.set(row.groupId, {
        groupId: row.groupId,
        limits,
        expiresAt: row.expiresAt,
      });
    }
    return held;
  }

  private async context(userId: string): Promise<Context> {
    const [config, held] = await Promise.all([
      this.loadConfig(),
      this.heldGroups(userId),
    ]);
    return { config, held };
  }

  /** Live ads (active or restricted, unexpired), newest first. */
  private liveAds(userId: string): Promise<LiveAd[]> {
    return this.db
      .select({
        id: listings.id,
        status: listings.status,
        categoryId: listings.categoryId,
        subcategoryId: listings.subcategoryId,
      })
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
  }

  /** The limits that apply to one ad, given where it is posted. */
  async resolve(
    userId: string,
    ad: AdScope,
  ): Promise<Entitlements & { bucket: Bucket }> {
    const { config, held } = await this.context(userId);
    const bucket = bucketOf(ad, config, held);
    return {
      plan: held.size > 0 ? 'premium' : 'free',
      limits: bucket.limits,
      expiresAt: bucket.groupId
        ? (held.get(bucket.groupId)?.expiresAt ?? null)
        : null,
      bucket,
    };
  }

  /**
   * The account overview, or — with `scope` — one ad's bucket (what the post
   * form shows for the subcategory being posted to).
   */
  async view(
    userId: string,
    subcategoryId?: string,
  ): Promise<EntitlementsView> {
    const [{ config, held }, live, scope] = await Promise.all([
      this.context(userId),
      this.liveAds(userId),
      subcategoryId ? this.scopeOf(subcategoryId) : null,
    ]);

    const used = new Map<BucketKey, number>();
    const buckets = new Map<BucketKey, Bucket>();
    for (const ad of live) {
      const bucket = bucketOf(ad, config, held);
      buckets.set(bucket.key, bucket);
      used.set(bucket.key, (used.get(bucket.key) ?? 0) + 1);
    }
    for (const group of held.values()) {
      const key: BucketKey = `group:${group.groupId}`;
      if (!buckets.has(key)) {
        const anySub = [...config.subcategoryGroup].find(
          ([, groupId]) => groupId === group.groupId,
        );
        buckets.set(
          key,
          anySub
            ? bucketOf(
                { categoryId: '', subcategoryId: anySub[0] },
                config,
                held,
              )
            : {
                key,
                kind: 'group',
                groupId: group.groupId,
                limits: group.limits,
              },
        );
      }
    }
    const requested = scope ? bucketOf(scope, config, held) : null;
    if (requested && !buckets.has(requested.key)) {
      buckets.set(requested.key, requested);
    }

    const names = await this.bucketNames([...buckets.keys()]);
    const toView = (bucket: Bucket): BucketView => ({
      key: bucket.key,
      kind: bucket.kind,
      name: names.get(bucket.key) ?? 'Other ads',
      groupId: bucket.groupId,
      limits: bucket.limits,
      used: used.get(bucket.key) ?? 0,
      expiresAt: bucket.groupId
        ? (held.get(bucket.groupId)?.expiresAt ?? null)
        : null,
    });
    const views = [...buckets.values()]
      .map(toView)
      .sort(
        (a, b) =>
          Number(b.kind === 'group') - Number(a.kind === 'group') ||
          Number(a.key === 'other') - Number(b.key === 'other') ||
          a.name.localeCompare(b.name),
      );

    const plan = held.size > 0 ? 'premium' : 'free';
    if (requested) {
      const bucket = toView(requested);
      return {
        plan,
        limits: bucket.limits,
        expiresAt: bucket.expiresAt,
        usage: { ads: bucket.used },
        bucket,
        buckets: views,
      };
    }
    // Overview: the account-wide free numbers, every live ad counted.
    return {
      plan,
      limits: {
        photos: config.free.photos,
        ads: config.free.otherAds,
        renews: config.free.renews,
        autoRenews: config.free.autoRenews,
        videos: config.free.videos,
      },
      expiresAt: null,
      usage: { ads: live.length },
      bucket: null,
      buckets: views,
    };
  }

  private async scopeOf(subcategoryId: string): Promise<AdScope | null> {
    const [row] = await this.db
      .select({ categoryId: subcategories.categoryId })
      .from(subcategories)
      .where(eq(subcategories.id, subcategoryId))
      .limit(1);
    return row ? { categoryId: row.categoryId, subcategoryId } : null;
  }

  /** Display names: group name, subcategory or category (en), else "Other ads". */
  private async bucketNames(
    keys: BucketKey[],
  ): Promise<Map<BucketKey, string>> {
    const ids = (prefix: string) =>
      keys
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
    const [groupIds, subIds, catIds] = [
      ids('group:'),
      ids('sub:'),
      ids('cat:'),
    ];
    const [groups, subs, cats] = await Promise.all([
      groupIds.length
        ? this.db
            .select({
              id: subscriptionCategories.id,
              name: subscriptionCategories.name,
            })
            .from(subscriptionCategories)
            .where(inArray(subscriptionCategories.id, groupIds))
        : [],
      subIds.length
        ? this.db
            .select({
              id: subcategories.id,
              slug: subcategories.slug,
              name: subcategoryTranslations.name,
            })
            .from(subcategories)
            .leftJoin(
              subcategoryTranslations,
              and(
                eq(subcategoryTranslations.subcategoryId, subcategories.id),
                eq(subcategoryTranslations.locale, 'en'),
              ),
            )
            .where(inArray(subcategories.id, subIds))
        : [],
      catIds.length
        ? this.db
            .select({
              id: categoryTranslations.categoryId,
              name: categoryTranslations.name,
            })
            .from(categoryTranslations)
            .where(
              and(
                inArray(categoryTranslations.categoryId, catIds),
                eq(categoryTranslations.locale, 'en'),
              ),
            )
        : [],
    ]);
    const names = new Map<BucketKey, string>();
    for (const g of groups) names.set(`group:${g.id}`, g.name);
    for (const s of subs) names.set(`sub:${s.id}`, s.name ?? s.slug);
    for (const c of cats) names.set(`cat:${c.id}`, c.name);
    return names;
  }

  /**
   * `requested` photos on one ad. `alreadyHas` grandfathers photos the ad
   * already carries (e.g. uploaded under a plan that has since lapsed), so a
   * user can still edit the text without being forced to delete photos.
   */
  async assertPhotos(
    userId: string,
    ad: AdScope,
    requested: number,
    alreadyHas = 0,
  ): Promise<void> {
    const { limits } = await this.resolve(userId, ad);
    if (requested > Math.max(limits.photos, alreadyHas)) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_PHOTOS',
        message: `Your plan allows ${limits.photos} photos per ad here. Upgrade your subscription to add more.`,
      });
    }
  }

  /**
   * A new ad (or a re-post of one that is no longer counted) needs a free
   * slot in its bucket. `ad.id` excludes the ad itself from the count.
   */
  async assertCanHoldAnotherAd(
    userId: string,
    ad: AdScope & { id?: string },
  ): Promise<void> {
    const [{ config, held }, live] = await Promise.all([
      this.context(userId),
      this.liveAds(userId),
    ]);
    const bucket = bucketOf(ad, config, held);
    const inBucket = live.filter(
      (other) =>
        other.id !== ad.id && bucketOf(other, config, held).key === bucket.key,
    ).length;
    if (inBucket >= bucket.limits.ads) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_ADS',
        message: `Your plan allows ${bucket.limits.ads} active ads in this category and you have ${inBucket}. Upgrade your subscription or remove an ad to post another.`,
      });
    }
  }

  async assertCanRenew(
    userId: string,
    ad: AdScope,
    renewCount: number,
  ): Promise<void> {
    const { limits } = await this.resolve(userId, ad);
    if (renewCount >= limits.renews) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_RENEWS',
        message:
          limits.renews === 0
            ? 'Your plan does not include renewals here. Upgrade your subscription to renew this ad.'
            : `This ad has used all ${limits.renews} renewals your plan includes.`,
      });
    }
  }

  /**
   * Brings the user's live ads in line with their allowances: in each bucket
   * the newest `ads` stay (or become) public, the rest are restricted from
   * public browsing — not deleted, so renewing the plan brings them straight
   * back. Idempotent; safe to call after any change to subscriptions, ads,
   * group scopes or the free plan.
   */
  async reconcileListings(
    userId: string,
  ): Promise<{ restricted: number; restored: number }> {
    const [{ config, held }, live] = await Promise.all([
      this.context(userId),
      this.liveAds(userId),
    ]);
    const { within, beyond } = partitionByAllowance(live, config, held);

    const toRestore = within
      .filter((row) => row.status === 'restricted')
      .map((row) => row.id);
    const toRestrict = beyond
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
   * Periodic sweep, and the follow-up to an admin edit of a group's scope or
   * the free plan: every user holding restricted ads (maybe renewed), or more
   * live ads than the smallest allowance anywhere (maybe lapsed or moved).
   * Returns how many users it looked at.
   */
  async reconcileAll(): Promise<number> {
    const config = await this.loadConfig();
    const [smallestPackage] = await this.db
      .select({
        ads: sql<number | null>`min(${subscriptionPackages.ads})::int`,
      })
      .from(subscriptionPackages);
    const floor = Math.min(
      config.free.otherAds,
      ...config.subcategoryCaps.values(),
      ...config.categoryCaps.values(),
      smallestPackage?.ads ?? config.free.otherAds,
    );
    const candidates = await this.db
      .select({ userId: listings.userId })
      .from(listings)
      .where(inArray(listings.status, ['active', 'restricted']))
      .groupBy(listings.userId)
      .having(
        sql`count(*) filter (where ${listings.status} = 'restricted') > 0 or count(*) > ${floor}`,
      );
    for (const { userId } of candidates) {
      await this.reconcileListingsSafely(userId);
    }
    return candidates.length;
  }

  /** Fire-and-forget `reconcileAll` for admin edits; the 10-minute sweep is the backstop. */
  reconcileAllInBackground(reason: string): void {
    void this.reconcileAll().catch((err: unknown) =>
      this.logger.warn(
        `Reconcile after ${reason} failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
}
