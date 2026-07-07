import { toast } from 'sonner';

/**
 * Read the current impersonation target directly from sessionStorage.
 * Used inside mutation hooks (outside React render) as a defense-in-depth
 * block so admins can't accidentally mutate a user's data.
 */
export function isImpersonatingNow(): boolean {
  try {
    const raw = sessionStorage.getItem('im_impersonation_v1');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed?.userId;
  } catch {
    return false;
  }
}

export function assertNotImpersonating(actionLabel = 'This action'): void {
  if (isImpersonatingNow()) {
    toast.error(`${actionLabel} is disabled while impersonating.`, {
      description: 'Exit the impersonation session to make changes.',
    });
    throw new Error('BLOCKED_BY_IMPERSONATION');
  }
}
