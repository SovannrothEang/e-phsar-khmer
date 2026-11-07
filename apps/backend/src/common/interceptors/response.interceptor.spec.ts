import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { SkipEnvelope } from '../decorators/skip-envelope.decorator';

/** The only two members `Reflector.getAllAndOverride` is given. */
function contextFor(handler: unknown, controller: unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

async function run(
  interceptor: ResponseInterceptor,
  context: ExecutionContext,
  value: unknown,
): Promise<unknown> {
  return firstValueFrom(
    interceptor.intercept(context, handlerReturning(value)),
  );
}

class PlainController {
  plain(this: void): unknown {
    return undefined;
  }
}

@SkipEnvelope()
class SkippedController {
  handler(this: void): unknown {
    return undefined;
  }
}

class MixedController {
  @SkipEnvelope()
  skipped(this: void): unknown {
    return undefined;
  }

  wrapped(this: void): unknown {
    return undefined;
  }
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor(new Reflector());

  it('wraps a normal object in the success envelope', async () => {
    await expect(
      run(
        interceptor,
        contextFor(PlainController.prototype.plain, PlainController),
        { id: '1' },
      ),
    ).resolves.toEqual({ success: true, data: { id: '1' } });
  });

  it('passes a string through unchanged, as before', async () => {
    await expect(
      run(
        interceptor,
        contextFor(PlainController.prototype.plain, PlainController),
        'ok',
      ),
    ).resolves.toBe('ok');
  });

  it('keeps a handler paginated shape as data + meta', async () => {
    await expect(
      run(
        interceptor,
        contextFor(PlainController.prototype.plain, PlainController),
        { data: [1], meta: { total: 1 } },
      ),
    ).resolves.toEqual({ success: true, data: [1], meta: { total: 1 } });
  });

  it('returns the handler value untouched when the handler is @SkipEnvelope()', async () => {
    const ack = { code: 0 };

    await expect(
      run(
        interceptor,
        contextFor(MixedController.prototype.skipped, MixedController),
        ack,
      ),
    ).resolves.toBe(ack);
  });

  it('returns every route untouched when the controller is @SkipEnvelope()', async () => {
    const ack = { code: 0 };

    await expect(
      run(
        interceptor,
        contextFor(SkippedController.prototype.handler, SkippedController),
        ack,
      ),
    ).resolves.toBe(ack);
  });

  it('still wraps the routes of a controller that only skips one handler', async () => {
    await expect(
      run(
        interceptor,
        contextFor(MixedController.prototype.wrapped, MixedController),
        { id: '1' },
      ),
    ).resolves.toEqual({ success: true, data: { id: '1' } });
  });
});
