import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, FileText, Clock, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MoneyFlowCard } from '@/components/accounting/MoneyFlowCard';
import { InsightCard } from '@/components/accounting/InsightCard';
import { DemoLayout } from './DemoLayout';

// Sample accounting stats for February 2026
const stats = {
  revenue: 6200000,          // Total invoiced
  revenueCount: 8,
  moneyIn: 3855000,          // Payments received
  moneyInCount: 5,
  moneyOut: 816000,          // Expenses
  expenseCount: 8,
  whatsLeft: 3039000,        // Profit (moneyIn - moneyOut)
  outstanding: 2345000,      // Unpaid invoices
  outstandingCount: 3,
  currency: 'NGN'
};

const formatCurrency = (amount: number) => {
  return `₦${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function DemoAccounting() {
  const collectionRate = Math.round((stats.moneyIn / stats.revenue) * 100);
  const profitMargin = Math.round(((stats.moneyIn - stats.moneyOut) / stats.moneyIn) * 100);

  return (
    <DemoLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <Badge variant="default" className="cursor-pointer">Overview</Badge>
          <Badge variant="outline" className="cursor-pointer">Income</Badge>
          <Badge variant="outline" className="cursor-pointer">Expenses</Badge>
          <Badge variant="outline" className="cursor-pointer">Profit & Loss</Badge>
        </div>

        {/* Header with jurisdiction badge */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">How Your Business is Doing</h1>
            <p className="text-muted-foreground mt-1">
              This month's overview in NGN
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              🇳🇬 Nigeria
            </Badge>
            <Badge variant="outline">This Month</Badge>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MoneyFlowCard
            title="Revenue"
            amount={stats.revenue}
            currency={stats.currency}
            count={stats.revenueCount}
            countLabel="invoices"
            icon={FileText}
            variant="default"
          />
          <MoneyFlowCard
            title="Money In"
            amount={stats.moneyIn}
            currency={stats.currency}
            count={stats.moneyInCount}
            countLabel="paid"
            icon={TrendingUp}
            variant="success"
          />
          <MoneyFlowCard
            title="Money Out"
            amount={stats.moneyOut}
            currency={stats.currency}
            count={stats.expenseCount}
            countLabel="expenses"
            icon={TrendingDown}
            variant="warning"
          />
          <MoneyFlowCard
            title="What's Left"
            amount={stats.whatsLeft}
            currency={stats.currency}
            icon={Wallet}
            variant="success"
          />
        </div>

        {/* Insights row */}
        <div className="grid gap-4 md:grid-cols-3">
          <InsightCard
            title="Outstanding"
            value={formatCurrency(stats.outstanding)}
            description={`${stats.outstandingCount} unpaid invoices`}
            icon={Clock}
          />
          <InsightCard
            title="Collection Rate"
            value={`${collectionRate}%`}
            description="Percentage of revenue collected"
            icon={ArrowUpRight}
            trend={collectionRate >= 80 ? 'up' : 'neutral'}
          />
          <InsightCard
            title="Profit Margin"
            value={`${profitMargin}%`}
            description="After expenses"
            icon={DollarSign}
            trend={profitMargin > 0 ? 'up' : 'down'}
          />
        </div>

        {/* Disclaimer */}
        <div className="p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
          <p>
            <strong>Note:</strong> This is a simplified cash-flow overview for small business planning purposes. 
            For official tax filings or audits, please consult a certified accountant or use approved 
            accounting software compliant with Nigerian Financial Reporting Standards.
          </p>
        </div>
      </motion.div>
    </DemoLayout>
  );
}
