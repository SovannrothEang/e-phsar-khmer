import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { DbClientTag, runInTransaction } from '../db/db.provider';
import { PAYMENT_QUEUE } from './payment.constants';
import { PaymentQueueTag } from './queue/payment-queue.provider';
import type { PaymentJobData } from './queue/payment-queue.types';
import {
  checkPayment,
  createPayment,
  createPaymentAttempt,
  createPaymentProviderEvent,
  enqueuePaymentAttempt,
  enqueuePaymentProviderEvent,
  listPaymentAttempts,
  listPayments,
  upsertPayment,
  PaymentPersistenceError,
  type PaymentUseCaseError,
} from './use-cases';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

/**
 * No tenants table exists yet (see ../tenant/README.md) — every transaction
 * is created under this fixed placeholder until real tenant scoping lands.
 */
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

function toHttpException(error: PaymentUseCaseError): HttpException {
  switch (error._tag) {
    case 'PaymentTransactionNotFoundError':
      return new NotFoundException('Payment transaction not found');
    case 'PaymentTransactionConflictError':
      return new ConflictException(
        'Payment transaction was modified concurrently — refresh and retry',
      );
    case 'DuplicateIdempotencyKeyError':
      return new ConflictException(
        'A payment with this idempotency key already exists',
      );
    case 'PaymentPersistenceError':
      return new InternalServerErrorException(
        'Payment transaction could not be processed',
      );
    case 'PaymentQueueError':
      return new InternalServerErrorException(
        'Payment could not be queued for processing',
      );
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @InjectQueue(PAYMENT_QUEUE) private readonly queue: Queue<PaymentJobData>,
  ) {}

  /**
   * Runs a payment use-case, providing both the DbClientTag and
   * PaymentQueueTag layers from the NestJS-injected Drizzle client and
   * BullMQ queue, and re-throws its typed failure as the matching NestJS
   * HTTP exception. A defect (a bug, not a modeled failure) is left to
   * surface as-is — GlobalExceptionFilter maps it to a 500.
   */
  private async run<A>(
    effect: Effect.Effect<
      A,
      PaymentUseCaseError,
      DbClientTag | PaymentQueueTag
    >,
  ): Promise<A> {
    const layer = Layer.mergeAll(
      DbClientTag.layer(this.db),
      PaymentQueueTag.layer(this.queue),
    );
    const exit = await Effect.runPromiseExit(Effect.provide(effect, layer));
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure)) {
      throw toHttpException(failure.value);
    }
    throw Cause.squash(exit.cause);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a payment transaction and its first attempt, then enqueue ' +
      'it for processing — the full lifecycle up to (not including) the ' +
      'queue processor calling the provider',
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto) {
    return this.run(
      Effect.gen(function* () {
        // 1. Atomically insert transaction and initial attempt inside a DB transaction
        const { transaction, attempt } = yield* runInTransaction(
          Effect.gen(function* () {
            const transaction = yield* createPayment({
              tenantId: DEFAULT_TENANT_ID,
              reference: dto.reference,
              idempotencyKey: dto.idempotencyKey,
              amount: dto.amount.toString(),
              currency: dto.currency,
              type: 'payment',
              customerId: user.id,
              orderId: dto.orderId,
              description: dto.description,
            });
            const attempt = yield* createPaymentAttempt({
              paymentTransactionId: transaction.id,
              provider: dto.provider,
              method: dto.method,
              amount: transaction.amount,
              currency: transaction.currency,
            });
            return { transaction, attempt };
          }),
          (cause) => new PaymentPersistenceError({ cause }),
        );

        // 2. Only after the DB transaction commits successfully, enqueue the job
        yield* enqueuePaymentAttempt({
          paymentTransactionId: transaction.id,
          paymentAttemptId: attempt.id,
        });

        return { transaction, attempt };
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: "List the current user's payment transactions" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPaymentsQueryDto) {
    return this.run(
      listPayments({
        customerId: user.id,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Check a payment transaction by id (owner only)' })
  async check(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const transaction = await this.run(checkPayment(id));
    if (transaction.customerId !== user.id) {
      // 404, not 403 — don't confirm another user's transaction exists.
      throw new NotFoundException('Payment transaction not found');
    }
    return transaction;
  }

  @Get(':id/attempts')
  @ApiOperation({
    summary: "List a payment transaction's attempts (owner only)",
  })
  async listAttempts(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const transaction = await this.run(checkPayment(id));
    if (transaction.customerId !== user.id) {
      throw new NotFoundException('Payment transaction not found');
    }
    return this.run(listPaymentAttempts({ paymentTransactionId: id }));
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary:
      'Provider webhook intake — dedupes on (provider, providerEventId) ' +
      'and enqueues an event-processing job for a genuinely new event. ' +
      'A duplicate delivery is a safe no-op (structural idempotency).',
  })
  webhook(@Body() dto: PaymentWebhookDto) {
    return this.run(
      Effect.gen(function* () {
        const { event, isNew } = yield* createPaymentProviderEvent({
          provider: dto.provider,
          providerEventId: dto.providerEventId,
          eventType: dto.eventType,
          payload: dto.payload,
          paymentAttemptId: dto.paymentAttemptId,
        });
        if (isNew) {
          yield* enqueuePaymentProviderEvent({
            paymentProviderEventId: event.id,
          });
        }
        return { received: true, eventId: event.id, isNew };
      }),
    );
  }

  @Patch(':id')
  @Roles('admin', 'super_admin')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary:
      'Update a payment transaction (optimistic-locked on version). ' +
      'Admin-only: status transitions are a system/webhook/admin concern ' +
      '(see payment_status_history.actorType) — never customer-initiated.',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.run(
      upsertPayment({
        id,
        expectedVersion: dto.expectedVersion,
        status: dto.status,
        description: dto.description,
      }),
    );
  }
}
