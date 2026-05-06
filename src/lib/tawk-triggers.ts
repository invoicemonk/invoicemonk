/**
 * Tawk.to engagement trigger helpers.
 * Shared utilities for firing programmatic chat messages to logged-in users.
 */

const SESSION_LOCK_KEY = 'tawk_trigger_fired';

export type TawkTriggerKey =
  | 'pricing_dwell'
  | 'invoice_milestone_5'
  | 'return_visit'
  | 'stuck_invoice';

export function waitForTawk(timeout = 10000): Promise<NonNullable<Window['Tawk_API']>> {
  return new Promise((resolve, reject) => {
    if (window.Tawk_API?.maximize) return resolve(window.Tawk_API);
    const start = Date.now();
    const check = () => {
      if (window.Tawk_API?.maximize) return resolve(window.Tawk_API);
      if (Date.now() - start > timeout) return reject(new Error('Tawk timeout'));
      setTimeout(check, 200);
    };
    check();
  });
}

export function isSessionLocked(): boolean {
  try {
    return !!sessionStorage.getItem(SESSION_LOCK_KEY);
  } catch {
    return false;
  }
}

function lockSession(triggerKey: TawkTriggerKey) {
  try {
    sessionStorage.setItem(SESSION_LOCK_KEY, triggerKey);
  } catch {}
}

export function userKey(triggerKey: TawkTriggerKey, userId: string) {
  return `tawk_trigger_${triggerKey}_${userId}`;
}

export function hasFiredForUser(triggerKey: TawkTriggerKey, userId: string): boolean {
  try {
    return !!localStorage.getItem(userKey(triggerKey, userId));
  } catch {
    return false;
  }
}

function markFiredForUser(triggerKey: TawkTriggerKey, userId: string) {
  try {
    localStorage.setItem(userKey(triggerKey, userId), new Date().toISOString());
  } catch {}
}

interface FireOptions {
  userId: string;
  triggerKey: TawkTriggerKey;
  message: string;
  event?: { name: string; props?: Record<string, unknown> };
  /** Skip the per-session lock (still respects per-user state). */
  ignoreSessionLock?: boolean;
}

export async function fireTawkMessage(opts: FireOptions): Promise<boolean> {
  const { userId, triggerKey, message, event, ignoreSessionLock } = opts;

  if (!ignoreSessionLock && isSessionLocked()) return false;
  if (hasFiredForUser(triggerKey, userId)) return false;

  try {
    const tawk = await waitForTawk();
    try {
      tawk.showWidget?.();
      tawk.maximize?.();
    } catch {}
    try {
      (tawk as any).sendMessage?.(message);
    } catch {}
    if (event) {
      try {
        (tawk as any).addEvent?.(event.name, event.props || {});
      } catch {}
    }
    markFiredForUser(triggerKey, userId);
    lockSession(triggerKey);
    return true;
  } catch {
    return false;
  }
}

/** Trigger 3 helpers — last visit timestamp + 30-day cooldown. */
export function readLastVisit(userId: string): number | null {
  try {
    const v = localStorage.getItem(`tawk_last_visit_${userId}`);
    return v ? new Date(v).getTime() : null;
  } catch {
    return null;
  }
}

export function writeLastVisit(userId: string) {
  try {
    localStorage.setItem(`tawk_last_visit_${userId}`, new Date().toISOString());
  } catch {}
}

export function returnVisitOnCooldown(userId: string): boolean {
  try {
    const v = localStorage.getItem(`tawk_return_visit_cooldown_${userId}`);
    if (!v) return false;
    const last = new Date(v).getTime();
    return Date.now() - last < 30 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function markReturnVisitFired(userId: string) {
  try {
    localStorage.setItem(`tawk_return_visit_cooldown_${userId}`, new Date().toISOString());
  } catch {}
}
