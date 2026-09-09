import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentUseCaseError } from './use-cases';

/**
 * Maps a `PaymentUseCaseError` to its NestJS HTTP exception. Shared by
 * every controller in this module (`PaymentsController`,
 * `AbaPaywayController`) so the mapping stays in one place rather than
 * drifting between them.
 */
export function toHttpException(error: PaymentUseCaseError): HttpException {
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
