import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntentCapturePrompt } from './IntentCapturePrompt';

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
      upsert,
    }),
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('posthog-js', () => ({ default: { setPersonProperties: vi.fn(), capture: vi.fn() } }));
vi.mock('@/lib/product-tracking', () => ({ trackProductEvent: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderRequiredPrompt(onRequiredComplete = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <IntentCapturePrompt surface="onboarding" required onRequiredComplete={onRequiredComplete} />
    </QueryClientProvider>,
  );
  return onRequiredComplete;
}

describe('required onboarding discovery', () => {
  afterEach(() => {
    cleanup();
    upsert.mockReset();
  });

  it('requires a selection and offers no skip or dismiss action', async () => {
    renderRequiredPrompt();
    const saveButton = await screen.findByRole('button', { name: 'Save and continue' });
    expect(saveButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send professional invoices' }));
    expect(saveButton).toBeEnabled();
  });

  it('continues only after the selected intent is saved', async () => {
    upsert.mockResolvedValue({ error: null });
    const onComplete = renderRequiredPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Send professional invoices' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: 'test-user', intent: 'send_invoices', source: 'onboarding' })],
      { onConflict: 'user_id,intent' },
    ));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it('does not continue when saving fails', async () => {
    upsert.mockResolvedValue({ error: new Error('write failed') });
    const onComplete = renderRequiredPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Track business expenses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(upsert).toHaveBeenCalledOnce());
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeInTheDocument();
  });
});