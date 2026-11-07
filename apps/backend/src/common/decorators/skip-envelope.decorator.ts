import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

/**
 * Leaves the handler's return value exactly as it is — no `{ success, data }`
 * wrapper. For a third-party contract that reads the raw body, such as ABA
 * PayWay's `{ code: 0 }` ack: the envelope would read as a non-zero/failed
 * callback and make the provider retry forever.
 */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
