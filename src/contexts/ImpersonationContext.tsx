import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface ImpersonationTarget {
  userId: string;
  email: string;
  fullName: string | null;
  businessId?: string | null;
  businessName?: string | null;
  startedAt: number;
}

interface ImpersonationContextType {
  target: ImpersonationTarget | null;
  isImpersonating: boolean;
  start: (t: Omit<ImpersonationTarget, 'startedAt'>) => void;
  stop: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);
const STORAGE_KEY = 'im_impersonation_v1';
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ImpersonationTarget | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ImpersonationTarget;
      if (!parsed?.userId || Date.now() - parsed.startedAt > MAX_DURATION_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // Auto-expire timer
  useEffect(() => {
    if (!target) return;
    const remaining = MAX_DURATION_MS - (Date.now() - target.startedAt);
    if (remaining <= 0) {
      setTarget(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const id = setTimeout(() => {
      setTarget(null);
      sessionStorage.removeItem(STORAGE_KEY);
      queryClient.invalidateQueries();
    }, remaining);
    return () => clearTimeout(id);
  }, [target, queryClient]);

  const start = useCallback((t: Omit<ImpersonationTarget, 'startedAt'>) => {
    const next: ImpersonationTarget = { ...t, startedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setTarget(next);
    // Wipe caches so subsequent queries fetch the target's data.
    queryClient.invalidateQueries();
  }, [queryClient]);

  const stop = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setTarget(null);
    queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <ImpersonationContext.Provider value={{ target, isImpersonating: !!target, start, stop }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}

/** Safe variant that returns a no-op when the provider is missing. */
export function useImpersonationOptional(): ImpersonationContextType {
  return useContext(ImpersonationContext) ?? {
    target: null,
    isImpersonating: false,
    start: () => {},
    stop: () => {},
  };
}
