import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { users } from '../../db/schema/users.schema';
import {
  subscriptionCategories,
  subscriptionPackages,
  subscriptionPlans,
  subscriptionTerms,
  userSubscriptions,
} from '../../db/schema/subscriptions.schema';
import type { GrantSubscriptionDto } from './dto/grant-subscription.dto';

export interface UserSubscriptionView {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  totalAds: number;
  totalRenew: number;
  autoRenew: number;
  plan: string | null;
  price: string;
  paymentMethod: string | null;
  subscribedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired';
}

function addDuration(
  from: Date,
  value: number,
  unit: 'day' | 'month' | 'year',
): Date {
  const d = new Date(from);
  if (unit === 'day') d.setDate(d.getDate() + value);
  else if (unit === 'month') d.setMonth(d.getMonth() + value);
  else d.setFullYear(d.getFullYear() + value);
  return d;
}

function finalPrice(
  price: number,
  discount: number,
  type: 'percent' | 'amount',
): number {
  const final =
    type === 'percent' ? price * (1 - discount / 100) : price - discount;
  return Math.max(0, Math.round(final * 100) / 100);
}

@Injectable()
export class UserSubscriptionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async list(): Promise<UserSubscriptionView[]> {
    const rows = await this.db
      .select({
        id: userSubscriptions.id,
        userId: userSubscriptions.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        email: users.email,
        phone: users.primaryPhone,
        category: subscriptionCategories.name,
        ads: subscriptionPackages.ads,
        renews: subscriptionPackages.renews,
        autoRenews: subscriptionPackages.autoRenews,
        termName: subscriptionTerms.name,
        price: userSubscriptions.priceUsd,
        paymentMethod: userSubscriptions.paymentMethod,
        subscribedAt: userSubscriptions.subscribedAt,
        expiresAt: userSubscriptions.expiresAt,
      })
      .from(userSubscriptions)
      .innerJoin(users, eq(users.id, userSubscriptions.userId))
      .leftJoin(
        subscriptionTerms,
        eq(subscriptionTerms.id, userSubscriptions.termId),
      )
      .leftJoin(
        subscriptionPackages,
        eq(subscriptionPackages.id, subscriptionTerms.packageId),
      )
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptionPackages.planId),
      )
      .leftJoin(
        subscriptionCategories,
        eq(subscriptionCategories.id, subscriptionPlans.categoryId),
      )
      .orderBy(desc(userSubscriptions.subscribedAt));

    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      accountId: r.userId.slice(0, 8),
      name:
        [r.firstName, r.lastName].filter(Boolean).join(' ') ||
        r.username ||
        'Unknown',
      email: r.email,
      phone: r.phone,
      category: r.category,
      totalAds: r.ads ?? 0,
      totalRenew: r.renews ?? 0,
      autoRenew: r.autoRenews ?? 0,
      plan: r.termName,
      price: r.price,
      paymentMethod: r.paymentMethod,
      subscribedAt: r.subscribedAt,
      expiresAt: r.expiresAt,
      status: r.expiresAt.getTime() < now ? 'expired' : 'active',
    }));
  }

  async grant(dto: GrantSubscriptionDto): Promise<{ id: string }> {
    const [term] = await this.db
      .select()
      .from(subscriptionTerms)
      .where(eq(subscriptionTerms.id, dto.termId))
      .limit(1);
    if (!term) throw new NotFoundException('Term not found');

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const expiresAt = addDuration(now, term.durationValue, term.durationUnit);
    const price = finalPrice(
      Number(term.price),
      Number(term.discount),
      term.discountType,
    );

    const [row] = await this.db
      .insert(userSubscriptions)
      .values({
        userId: dto.userId,
        termId: dto.termId,
        priceUsd: price.toString(),
        paymentMethod: dto.paymentMethod ?? null,
        subscribedAt: now,
        expiresAt,
      })
      .returning({ id: userSubscriptions.id });
    return { id: row.id };
  }

  async remove(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Subscription not found');
    await this.db.delete(userSubscriptions).where(eq(userSubscriptions.id, id));
    return { id };
  }
}
