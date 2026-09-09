import { Context, Layer } from 'effect';
import type { Queue } from 'bullmq';
import type { PaymentJobData } from './payment-queue.types';

/**
 * Effect-side handle for the `payments` BullMQ queue. Mirrors DbClientTag
 * (`../../db/db.provider.ts`) — this doesn't create a queue connection,
 * `PaymentQueueTag.layer(queue)` just wraps the `Queue` instance NestJS
 * already built via `@InjectQueue(PAYMENT_QUEUE)`.
 */
export class PaymentQueueTag extends Context.Service<
  PaymentQueueTag,
  Queue<PaymentJobData>
>()('psa-npic/payment/PaymentQueue') {
  static readonly layer = (queue: Queue<PaymentJobData>) =>
    Layer.succeed(PaymentQueueTag, queue);
}
