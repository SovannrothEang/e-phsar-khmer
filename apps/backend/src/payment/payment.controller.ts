import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Effect } from 'effect';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentEffectRunner } from './payment-effect-runner.service';
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

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly effectRunner: PaymentEffectRunner) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a payment transaction and its first attempt, then durably ' +
      'hand it off for processing — the full lifecycle up to (not ' +
      'including) the queue processor calling the provider',
  })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePaymentDto,
  ) {
    // The attempt insert and the durable enqueue (an outbox row — see
    // enqueuePaymentAttempt) commit in the same DB transaction, and the
    // outbox worker is woken only once that transaction actually commits —
    // runDurably owns that whole protocol; see its doc comment.
    return this.effectRunner.runDurably((outbox) =>
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
        yield* enqueuePaymentAttempt(outbox, {
          paymentTransactionId: transaction.id,
          paymentAttemptId: attempt.id,
          browserReturnUrl: dto.browserReturnUrl,
        });
        return { transaction, attempt };
      }),
    );
  }

  @Get()
  @ApiOperation({ summary: "List the current user's payment transactions" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListPaymentsQueryDto) {
    return this.effectRunner.run(
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
    const transaction = await this.effectRunner.run(checkPayment(id));
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
    const transaction = await this.effectRunner.run(checkPayment(id));
    if (transaction.customerId !== user.id) {
      throw new NotFoundException('Payment transaction not found');
    }
    return this.effectRunner.run(
      listPaymentAttempts({ paymentTransactionId: id }),
    );
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary:
      'Generic provider webhook intake — dedupes on (provider, ' +
      'providerEventId) and durably hands off a genuinely new event for ' +
      'processing. A duplicate delivery is a safe no-op (structural ' +
      "idempotency). A provider whose wire format doesn't match this " +
      'envelope gets its own intake route instead (see AbaPaywayController).',
  })
  async webhook(@Body() dto: PaymentWebhookDto) {
    // Same durable-handoff protocol as create() — a duplicate delivery
    // still runs inside a transaction, it just has nothing new to enqueue
    // once createPaymentProviderEvent's dedupe finds the existing row.
    return this.effectRunner.runDurably((outbox) =>
      Effect.gen(function* () {
        const { event, isNew } = yield* createPaymentProviderEvent({
          provider: dto.provider,
          providerEventId: dto.providerEventId,
          eventType: dto.eventType,
          payload: dto.payload,
          paymentAttemptId: dto.paymentAttemptId,
        });
        if (isNew) {
          yield* enqueuePaymentProviderEvent(outbox, {
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
    return this.effectRunner.run(
      upsertPayment({
        id,
        expectedVersion: dto.expectedVersion,
        status: dto.status,
        description: dto.description,
      }),
    );
  }
}
