import { Inject, Injectable } from '@nestjs/common';
import { Cause, Effect, Exit, Option } from 'effect';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { DbClientTag, runInTransaction } from '../db/db.provider';
import { OutboxService } from '../outbox/outbox.service';
import { toHttpException } from './payment-http-exception.util';
import { PaymentPersistenceError } from './use-cases';
import type { PaymentUseCaseError } from './use-cases';

/**
 * Runs a payment use-case, providing the `DbClientTag` layer and re-throwing
 * its typed failure as the matching NestJS HTTP exception — shared by every
 * controller in this module so the layer-provide/exit-handling boilerplate
 * exists in exactly one place.
 *
 * `runDurably()` is the other half. Every write path in this module (create
 * a transaction/attempt, receive a generic webhook, receive an ABA webhook)
 * shares the same shape: domain writes plus an outbox enqueue, committed
 * together in one transaction, followed by a post-commit wakeup so the
 * outbox worker doesn't sit waiting for its poll fallback. Folding that
 * whole protocol into one method means a controller only supplies the
 * domain effect (given the `OutboxService` to enqueue with) — the
 * transaction wrapping, the persistence-error mapping, and the wakeup call
 * happen exactly once, in the right order, with no separate step a caller
 * can forget or reorder. `run()` alone still covers this module's
 * non-durable paths (list/check/update), which write nothing to the outbox
 * and have no worker to wake.
 */
@Injectable()
export class PaymentEffectRunner {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly outboxService: OutboxService,
  ) {}

  async run<A>(
    effect: Effect.Effect<A, PaymentUseCaseError, DbClientTag>,
  ): Promise<A> {
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, DbClientTag.layer(this.db)),
    );
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure)) {
      throw toHttpException(failure.value);
    }
    throw Cause.squash(exit.cause);
  }

  async runDurably<A>(
    build: (
      outbox: OutboxService,
    ) => Effect.Effect<A, PaymentUseCaseError, DbClientTag>,
  ): Promise<A> {
    const result = await this.run(
      runInTransaction(
        build(this.outboxService),
        (cause) => new PaymentPersistenceError({ cause }),
      ),
    );
    // Only after the transaction has actually committed — see
    // OutboxService.wakeupAfterCommit's own doc comment.
    this.outboxService.wakeupAfterCommit();
    return result;
  }
}
