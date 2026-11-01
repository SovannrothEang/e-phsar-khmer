import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { ChatAttachmentsService } from './chat-attachments.service';

export const CHAT_MAINTENANCE_QUEUE = 'chat-maintenance';
export const ATTACHMENTS_CLEANUP_JOB = 'attachments-cleanup';

const CLEANUP_EVERY_MS = 60 * 60 * 1000;
const CLEANUP_BATCH = 100;
/** Per run: at most this many batches, so one run can't hog the worker. */
const CLEANUP_MAX_BATCHES = 20;

/**
 * Registers the hourly attachment cleanup as a BullMQ job scheduler. An
 * upsert, so every instance calling it on boot keeps exactly one schedule
 * (BullMQ dedups by scheduler id) — no leader election needed.
 */
@Injectable()
export class ChatMaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(ChatMaintenanceScheduler.name);

  constructor(
    @InjectQueue(CHAT_MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    // Never await this: the shared BullMQ client runs with
    // maxRetriesPerRequest: null, so with Redis unreachable the upsert never
    // settles and this catch never fires — awaiting it would hold
    // NestFactory.create past a serverless startup deadline and the app would
    // never call listen (Vercel, 2026-11-01). Fire and forget: a registration
    // that lands once Redis is reachable still applies.
    void this.queue
      .upsertJobScheduler(
        ATTACHMENTS_CLEANUP_JOB,
        { every: CLEANUP_EVERY_MS },
        { name: ATTACHMENTS_CLEANUP_JOB },
      )
      .catch((err: unknown) => {
        // Cleanup is housekeeping: never block boot on it. Orphans just wait
        // for the next successful registration.
        this.logger.warn(
          `Could not schedule ${ATTACHMENTS_CLEANUP_JOB}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}

/**
 * Chat housekeeping jobs. The chat module otherwise skips BullMQ (REST is
 * authoritative, pushes are fire-and-forget); this exists only because
 * storage objects can't be removed by a DB cascade.
 */
@Processor(CHAT_MAINTENANCE_QUEUE)
export class ChatMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatMaintenanceProcessor.name);

  constructor(private readonly attachments: ChatAttachmentsService) {
    super();
  }

  async process(job: Job): Promise<{ removed: number }> {
    if (job.name !== ATTACHMENTS_CLEANUP_JOB) return { removed: 0 };
    let removed = 0;
    for (let i = 0; i < CLEANUP_MAX_BATCHES; i++) {
      const n = await this.attachments.cleanupOrphans(CLEANUP_BATCH);
      removed += n;
      if (n < CLEANUP_BATCH) break;
    }
    if (removed > 0)
      this.logger.log(`Removed ${removed} orphaned chat attachment(s)`);
    return { removed };
  }
}
