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
import { Cause, Effect, Exit, Option } from 'effect';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { DbClientTag } from '../db/db.provider';
import {
  checkPayment,
  createPayment,
  listPayments,
  upsertPayment,
  type PaymentUseCaseError,
} from './use-cases';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
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
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /**
   * Runs a payment use-case, providing the DbClientTag layer from the
   * NestJS-injected Drizzle client, and re-throws its typed failure as the
   * matching NestJS HTTP exception. A defect (a bug, not a modeled failure)
   * is left to surface as-is — GlobalExceptionFilter maps it to a 500.
   */
  private async run<A>(
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

  @Post()
  @ApiOperation({ summary: 'Create a payment transaction (status: pending)' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePaymentDto) {
    return this.run(
      createPayment({
        tenantId: DEFAULT_TENANT_ID,
        reference: dto.reference,
        idempotencyKey: dto.idempotencyKey,
        amount: dto.amount.toString(),
        currency: dto.currency,
        type: 'payment',
        customerId: user.id,
        orderId: dto.orderId,
        description: dto.description,
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
