import { describe, expect, it } from 'vitest';
import { canEnterApp, hasActivePaidSubscription } from './use-signup-plan-access';

describe('paid-only signup access', () => {
  it('blocks a new account before a paid plan is confirmed', () => {
    expect(canEnterApp(false, null)).toBe(false);
  });

  it('allows an active Professional subscription', () => {
    expect(canEnterApp(false, { tier: 'professional', status: 'active' })).toBe(true);
  });

  it('does not treat an active Free subscription as paid', () => {
    expect(hasActivePaidSubscription({ tier: 'starter', status: 'active' })).toBe(false);
    expect(canEnterApp(false, { tier: 'starter', status: 'active' })).toBe(false);
  });

  it('preserves access for existing users who already selected Free', () => {
    expect(canEnterApp(true, null)).toBe(true);
  });

  it('does not grant paid access for a cancelled subscription', () => {
    expect(canEnterApp(false, { tier: 'professional', status: 'cancelled' })).toBe(false);
  });
});