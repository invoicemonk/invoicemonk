import React, { createContext, useContext, ReactNode } from 'react';
import { useSubscription, SubscriptionTier, TierLimit, Subscription, TierCheckResult } from '@/hooks/use-subscription';

interface SubscriptionContextType {
  subscription: Subscription | null | undefined;
  tier: SubscriptionTier;
  limits: TierLimit[];
  isLoading: boolean;
  isError: boolean;
  canAccess: (feature: string) => boolean;
  hasTier: (requiredTier: SubscriptionTier) => boolean;
  getLimit: (feature: string) => TierLimit | undefined;
  checkTierLimit: (feature: string) => Promise<TierCheckResult>;
  isStarter: boolean;
  isStarterPaid: boolean;
  isProfessional: boolean;
  isBusiness: boolean;
  isFree: boolean;
  isPaid: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscriptionData = useSubscription();

  return (
    <SubscriptionContext.Provider value={subscriptionData}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
}

// Re-export types for convenience
export type { SubscriptionTier, TierLimit, Subscription, TierCheckResult };
