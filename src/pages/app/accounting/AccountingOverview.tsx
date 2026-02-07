import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, FileText, Clock, Wallet } from 'lucide-react';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { MissingBusinessDataBanner } from '@/components/accounting/MissingBusinessDataBanner';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { JurisdictionBadge } from '@/components/accounting/JurisdictionBadge';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';
import { InsightCard } from '@/components/accounting/InsightCard';
import { useAccountContext } from '@/hooks/use-account-context';
import { useAccountingPreferences, useUpdateAccountingPreferences, AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useAccountingStats } from '@/hooks/use-accounting-stats';
import { useBusiness } from '@/contexts/BusinessContext';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountingOverview() {
  const accountContext = useAccountContext();
  const { currentBusiness: business, loading: isLoadingBusiness } = useBusiness();
  const { data: preferences, isLoading: isLoadingPrefs } = useAccountingPreferences();
  const updatePreferences = useUpdateAccountingPreferences();
  
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'monthly');
  
  const dateRange = getAccountingDateRange(period);
  const { data: stats, isLoading: isLoadingStats } = useAccountingStats(dateRange);

  // Check for missing recommended fields
  const missingFields: ('country' | 'currency' | 'businessType')[] = [];
  if (!business?.jurisdiction) missingFields.push('country');
  if (!business?.default_currency) missingFields.push('currency');

  const handlePeriodChange = (newPeriod: AccountingPeriod) => {
    setPeriod(newPeriod);
    if (preferences?.id) {
      updatePreferences.mutate({ defaultAccountingPeriod: newPeriod });
    }
  };

  const formatCurrency = (amount: number) => {
    const symbols: Record<string, string> = {
      NGN: '₦',
      USD: '$',
      GBP: '£',
      EUR: '€',
    };
    const currency = stats?.currency || 'NGN';
    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isLoading = isLoadingBusiness || isLoadingPrefs || isLoadingStats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <AccountingNavTabs />

      {/* Non-blocking prompt if fields missing */}
      {missingFields.length > 0 && <MissingBusinessDataBanner missingFields={missingFields} />}

      {/* Header with jurisdiction badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">How Your Business is Doing</h1>
          <p className="text-muted-foreground mt-1">
            {getPeriodLabel(period)} overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <JurisdictionBadge country={business?.jurisdiction || null} />
          <AccountingPeriodSelector
            value={period}
            onChange={handlePeriodChange}
            disabled={updatePreferences.isPending}
          />
        </div>
      </div>

      {/* Stats cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MoneyFlowCard
            title="Revenue"
            amount={stats?.revenue || 0}
            currency={stats?.currency || 'NGN'}
            count={stats?.revenueCount}
            countLabel="invoices"
            icon={FileText}
            variant="default"
          />
          <MoneyFlowCard
            title="Money In"
            amount={stats?.moneyIn || 0}
            currency={stats?.currency || 'NGN'}
            count={stats?.moneyInCount}
            countLabel="paid"
            icon={TrendingUp}
            variant="success"
          />
          <MoneyFlowCard
            title="Money Out"
            amount={stats?.moneyOut || 0}
            currency={stats?.currency || 'NGN'}
            count={stats?.expenseCount}
            countLabel="expenses"
            icon={TrendingDown}
            variant="warning"
          />
          <MoneyFlowCard
            title="What's Left"
            amount={stats?.whatsLeft || 0}
            currency={stats?.currency || 'NGN'}
            icon={Wallet}
            variant={stats?.whatsLeft && stats.whatsLeft >= 0 ? 'success' : 'danger'}
          />
        </div>
      )}

      {/* Insights row */}
      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          <InsightCard
            title="Outstanding"
            value={formatCurrency(stats?.outstanding || 0)}
            description={`${stats?.outstandingCount || 0} unpaid invoices`}
            icon={Clock}
          />
          <InsightCard
            title="Collection Rate"
            value={stats?.revenue ? `${Math.round((stats.moneyIn / stats.revenue) * 100)}%` : '0%'}
            description="Percentage of revenue collected"
            icon={ArrowUpRight}
            trend={stats?.moneyIn && stats?.revenue && stats.moneyIn / stats.revenue >= 0.8 ? 'up' : 'neutral'}
          />
          <InsightCard
            title="Profit Margin"
            value={stats?.moneyIn ? `${Math.round(((stats.moneyIn - stats.moneyOut) / stats.moneyIn) * 100)}%` : '0%'}
            description="After expenses"
            icon={DollarSign}
            trend={stats?.whatsLeft && stats.whatsLeft >= 0 ? 'up' : 'down'}
          />
        </div>
      )}

      {/* Disclaimer */}
      <AccountingDisclaimer type="overview" />
    </motion.div>
  );
}
