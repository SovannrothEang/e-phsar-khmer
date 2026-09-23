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
 * `run()` executes a payment use-case, providing `DbClientTag` and mapping
 * a typed failure to the matching HTTP exception — shared by every
 * controller so that boilerplate exists once. `runDurably()` wraps the same
 * thing in a transaction plus a post-commit outbox wakeup, for the write
 * paths that also enqueue an outbox row (create/webhook) — `run()` alone
 * covers the non-durable paths (list/check/update).
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
