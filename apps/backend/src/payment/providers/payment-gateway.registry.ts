import { Inject, Injectable } from '@nestjs/common';
import {
  PAYMENT_GATEWAY_PROVIDERS,
  type PaymentGatewayProvider,
} from './payment-gateway.interface';

/**
 * Resolves a PaymentGatewayProvider by the plain `provider` string stored on
 * a payment row. Adding a new bank is registering one more provider against
 * PAYMENT_GATEWAY_PROVIDERS in payment.module.ts — nothing here changes.
 */
@Injectable()
export class PaymentGatewayRegistry {
  private readonly providers = new Map<string, PaymentGatewayProvider>();

  constructor(
    // The plain array registered under this token in payment.module.ts.
    @Inject(PAYMENT_GATEWAY_PROVIDERS) providers: PaymentGatewayProvider[],
  ) {
    for (const provider of providers) {
      this.providers.set(provider.name, provider);
    }
  }

  resolve(name: string): PaymentGatewayProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`No payment gateway registered for provider "${name}"`);
    }
    return provider;
  }
}
