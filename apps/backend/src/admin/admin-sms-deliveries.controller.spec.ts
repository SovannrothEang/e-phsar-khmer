import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminSmsDeliveriesController } from './admin-sms-deliveries.controller';

/**
 * The SMS audit trail is operational evidence both staff tiers may read, and
 * this repo matches roles literally — `super_admin` is a governance tier, not a
 * bigger `admin`. The rule gets its own test because the decorators alone would
 * not catch a future `@Roles('admin')` narrowing.
 */
function contextFor(
  controller: unknown,
  handlerName: string,
  role?: string,
): ExecutionContext {
  const proto = (controller as { prototype: Record<string, unknown> })
    .prototype;
  return {
    getHandler: () => proto[handlerName],
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 'u-1', role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('SMS delivery audit authorization', () => {
  const guard = new RolesGuard(new Reflector());

  it('admits admin and super_admin, and nobody else', () => {
    const as = (role?: string) =>
      guard.canActivate(contextFor(AdminSmsDeliveriesController, 'list', role));

    expect(as('admin')).toBe(true);
    expect(as('super_admin')).toBe(true);
    expect(as('user')).toBe(false);
    expect(as()).toBe(false);
  });
});
