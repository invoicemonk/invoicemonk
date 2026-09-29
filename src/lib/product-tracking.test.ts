import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.fn();
const rpc = vi.fn();
const getSession = vi.fn();

vi.mock('posthog-js', () => ({ default: { capture } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: { getSession } } }));

describe('product tracking', () => {
  beforeEach(() => {
    vi.resetModules();
    capture.mockReset(); rpc.mockReset(); getSession.mockReset();
    sessionStorage.clear();
  });

  it('records authenticated UI events through the tracking RPC', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    rpc.mockResolvedValue({ error: null });
    const { trackProductEvent } = await import('./product-tracking');
    trackProductEvent('data_import', 'import_completed', { milestone: 'activated', businessId: 'b1' });
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('track_product_event', expect.objectContaining({ _area: 'data_import', _event: 'import_completed', _milestone: 'activated', _business_id: 'b1' })));
  });

  it('does not call the database when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { trackProductEvent } = await import('./product-tracking');
    trackProductEvent('discovery', 'intent_prompt_dismissed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('records once-per-session events once', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { trackProductEventOncePerSession } = await import('./product-tracking');
    trackProductEventOncePerSession('dashboard', 'invoicing', 'dashboard_viewed');
    trackProductEventOncePerSession('dashboard', 'invoicing', 'dashboard_viewed');
    expect(capture).toHaveBeenCalledTimes(1);
  });
});