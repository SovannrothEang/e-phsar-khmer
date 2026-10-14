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
import { SubscriptionActivationService } from '../../subscriptions/subscription-activation.service';

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
  status: 'active' | 'expired' | 'superseded';
}

@Injectable()
export class UserSubscriptionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly activation: SubscriptionActivationService,
  ) {}

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
        supersededAt: userSubscriptions.supersededAt,
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
      status: r.supersededAt
        ? 'superseded'
        : r.expiresAt.getTime() < now
          ? 'expired'
          : 'active',
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

    return this.activation.grantManual({
      userId: dto.userId,
      termId: dto.termId,
      reason: dto.paymentMethod ?? 'Admin grant',
    });
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
