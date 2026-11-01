import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { ResumeAttachmentsService } from './resume-attachments.service';

export const RESUME_MAINTENANCE_QUEUE = 'resume-maintenance';
export const RESUME_ATTACHMENTS_CLEANUP_JOB = 'attachments-cleanup';

const CLEANUP_EVERY_MS = 60 * 60 * 1000;
const CLEANUP_BATCH = 100;
/** Per run: at most this many batches, so one run can't hog the worker. */
const CLEANUP_MAX_BATCHES = 20;

/**
 * Registers the hourly CV-upload cleanup as a BullMQ job scheduler. An upsert,
 * so every instance calling it on boot keeps exactly one schedule (BullMQ
 * dedups by scheduler id) — no leader election needed.
 */
@Injectable()
export class ResumeMaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(ResumeMaintenanceScheduler.name);

  constructor(
    @InjectQueue(RESUME_MAINTENANCE_QUEUE) private readonly queue: Queue,
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
        RESUME_ATTACHMENTS_CLEANUP_JOB,
        { every: CLEANUP_EVERY_MS },
        { name: RESUME_ATTACHMENTS_CLEANUP_JOB },
      )
      .catch((err: unknown) => {
        // Cleanup is housekeeping: never block boot on it. Orphaned objects
        // just wait for the next successful registration.
        this.logger.warn(
          `Could not schedule ${RESUME_ATTACHMENTS_CLEANUP_JOB}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}

/**
 * Resume housekeeping. Like chat, the module otherwise skips BullMQ (REST is
 * authoritative); this exists only because storage objects can't be removed by
 * a DB cascade.
 */
@Processor(RESUME_MAINTENANCE_QUEUE)
export class ResumeMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeMaintenanceProcessor.name);

  constructor(private readonly attachments: ResumeAttachmentsService) {
    super();
  }

  async process(job: Job): Promise<{ removed: number }> {
    if (job.name !== RESUME_ATTACHMENTS_CLEANUP_JOB) return { removed: 0 };
    let removed = 0;
    for (let i = 0; i < CLEANUP_MAX_BATCHES; i++) {
      const n = await this.attachments.cleanupOrphans(CLEANUP_BATCH);
      removed += n;
      if (n < CLEANUP_BATCH) break;
    }
    if (removed > 0)
      this.logger.log(`Removed ${removed} orphaned resume attachment(s)`);
    return { removed };
  }
}
