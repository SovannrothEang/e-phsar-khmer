import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { listingEvents } from '../db/schema/insights.schema';
import { listings } from '../db/schema/listings.schema';
import type { InsightEventInput } from './dto/record-events.dto';

/** The flat shape `/insight` renders. */
export interface InsightSummary {
  impression: number;
  engagement: number;
  view: number;
  chat: number;
  call: number;
  showContact: number;
  applyJob: number;
}

/**
 * Records buyer interactions and aggregates them for a listing owner.
 *
 * Ingestion is deliberately forgiving: unknown listing ids and the owner's
 * own actions are skipped rather than rejected, so one stale card in a client
 * batch can never fail the rest of it. The trade-off is that this table is an
 * analytics log, not an audit trail.
 */
@Injectable()
export class InsightsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async record(
    actorId: string | null,
    events: InsightEventInput[],
  ): Promise<{ recorded: number }> {
    if (events.length === 0) return { recorded: 0 };

    // One card can appear twice in a batch (grid/list, a re-render); collapse
    // identical pairs before touching the database.
    const unique = new Map<string, InsightEventInput>();
    for (const event of events) {
      const listingId = event.listingId.toLowerCase();
      unique.set(`${listingId}:${event.type}`, { listingId, type: event.type });
    }
    const batch = [...unique.values()];
    const listingIds = [...new Set(batch.map((event) => event.listingId))];

    const owned = await this.db
      .select({ id: listings.id, userId: listings.userId })
      .from(listings)
      .where(inArray(listings.id, listingIds));
    const ownerById = new Map(owned.map((row) => [row.id, row.userId]));

    const rows = batch.flatMap((event) => {
      const ownerId = ownerById.get(event.listingId);
      // Unknown / hard-deleted listing: drop it, never fail the batch.
      if (!ownerId) return [];
      // The owner refreshing their own ad must not inflate their own counts.
      if (actorId === ownerId) return [];
      return [
        {
          listingId: event.listingId,
          ownerId,
          actorId,
          eventType: event.type,
        },
      ];
    });

    if (rows.length === 0) return { recorded: 0 };

    await this.db.insert(listingEvents).values(rows);
    return { recorded: rows.length };
  }

  async summary(ownerId: string): Promise<InsightSummary> {
    const rows = await this.db
      .select({
        type: listingEvents.eventType,
        total: sql<number>`count(*)::int`,
      })
      .from(listingEvents)
      .where(eq(listingEvents.ownerId, ownerId))
      .groupBy(listingEvents.eventType);

    const totals = new Map(rows.map((row) => [row.type, Number(row.total)]));
    const view = totals.get('view') ?? 0;
    const chat = totals.get('chat') ?? 0;
    const call = totals.get('call') ?? 0;
    const showContact = totals.get('show_contact') ?? 0;
    const applyJob = totals.get('apply_job') ?? 0;

    return {
      impression: totals.get('impression') ?? 0,
      // Engagement is the buyer actions, not the impressions that led to them.
      engagement: view + chat + call + showContact + applyJob,
      view,
      chat,
      call,
      showContact,
      applyJob,
    };
  }
}
