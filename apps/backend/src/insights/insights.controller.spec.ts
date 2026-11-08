import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { InsightsController } from './insights.controller';

// @nestjs/throttler keeps its metadata keys private (throttler.constants.ts);
// these literals are the `default` throttler names the decorators write.
const THROTTLER_LIMIT = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL = 'THROTTLER:TTLdefault';
const THROTTLER_SKIP = 'THROTTLER:SKIPdefault';

describe('InsightsController', () => {
  // The decorators write their metadata onto the method function itself.
  function recordMetadata(key: string): unknown {
    const descriptor = Reflect.getOwnPropertyDescriptor(
      InsightsController.prototype,
      'record',
    );
    return descriptor ? Reflect.getMetadata(key, descriptor.value) : undefined;
  }

  it('throttles the public ingestion route at 600 requests per minute', () => {
    expect(recordMetadata(THROTTLER_LIMIT)).toBe(600);
    expect(recordMetadata(THROTTLER_TTL)).toBe(60_000);
  });

  it('no longer skips the throttler', () => {
    expect(recordMetadata(THROTTLER_SKIP)).toBeUndefined();
  });

  it('stays public', () => {
    expect(recordMetadata(IS_PUBLIC_KEY)).toBe(true);
  });
});
