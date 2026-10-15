import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { EntitlementsService } from './entitlements.service';

export const ENTITLEMENTS_QUEUE = 'entitlements';
export const LISTING_SWEEP_JOB = 'listing-restriction-sweep';

const SWEEP_EVERY_MS = 10 * 60 * 1000;

/**
 * Registers the recurring sweep as a BullMQ job scheduler. An upsert, so every
 * instance calling it on boot keeps exactly one schedule (same pattern as
 * `ChatMaintenanceScheduler`).
 */
@Injectable()
export class EntitlementsScheduler implements OnModuleInit {
  private readonly logger = new Logger(EntitlementsScheduler.name);

  constructor(@InjectQueue(ENTITLEMENTS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        LISTING_SWEEP_JOB,
        { every: SWEEP_EVERY_MS },
        { name: LISTING_SWEEP_JOB },
      );
    } catch (err) {
      // Never block boot on housekeeping: activation and plan changes
      // reconcile directly, the sweep only catches lapses.
      this.logger.warn(
        `Could not schedule ${LISTING_SWEEP_JOB}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Nothing fires when a subscription's `expires_at` passes, so this is what
 * restricts an owner's over-limit ads from public browsing after a lapse.
 */
@Processor(ENTITLEMENTS_QUEUE)
export class EntitlementsProcessor extends WorkerHost {
  private readonly logger = new Logger(EntitlementsProcessor.name);

  constructor(private readonly entitlements: EntitlementsService) {
    super();
  }

  async process(job: Job): Promise<{ users: number }> {
    if (job.name !== LISTING_SWEEP_JOB) return { users: 0 };
    const users = await this.entitlements.reconcileAll();
    if (users > 0) this.logger.log(`Reconciled listings for ${users} user(s)`);
    return { users };
  }
}
