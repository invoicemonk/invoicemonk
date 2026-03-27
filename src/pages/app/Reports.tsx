import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Calendar,
  FileText,
  TrendingUp,
  DollarSign,
  Loader2,
  Receipt,
  Wallet,
  Calculator,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  PieChart,
  FileDown,
} from 'lucide-react';
import Analytics from '@/pages/app/Analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { UpgradePrompt } from '@/components/app/UpgradePrompt';
import {
  useGenerateReport,
  REPORT_DEFINITIONS,
  REPORT_CATEGORIES,
  type ReportType,
  type ReportCategory,
} from '@/hooks/use-reports';
import { useTaxPack } from '@/hooks/use-tax-pack';
import { getJurisdictionTaxPackConfig } from '@/lib/jurisdiction-config';
import type { JurisdictionTaxPackConfig } from '@/lib/jurisdiction-config';

const CATEGORY_ICONS: Record<ReportCategory, typeof DollarSign> = {
  revenue: DollarSign,
  receipts: Receipt,
  expenses: Wallet,
  accounting: Calculator,
  compliance: ShieldCheck,
};

function getTaxPackPeriodOptions(config: JurisdictionTaxPackConfig | null): { value: string; label: string; start: string; end: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const periods: { value: string; label: string; start: string; end: string }[] = [];

  const defaultPeriod = config?.defaultFilingPeriod || 'quarterly';
  const filingPeriods = config?.filingPeriods || ['quarterly', 'annual'];
  const activePeriod = filingPeriods.includes(defaultPeriod as any) ? defaultPeriod : filingPeriods[0];

  if (activePeriod === 'monthly') {
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1);
      const monthEnd = new Date(year, m + 1, 0);
      if (monthStart <= now) {
        periods.push({
          value: `${year}-${String(m + 1).padStart(2, '0')}`,
          label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0],
        });
      }
    }
  } else if (activePeriod === 'bimonthly') {
    const bimonths = [
      ['Jan-Feb', 0, 1], ['Mar-Apr', 2, 3], ['May-Jun', 4, 5],
      ['Jul-Aug', 6, 7], ['Sep-Oct', 8, 9], ['Nov-Dec', 10, 11],
    ] as const;
    for (const [label, startM, endM] of bimonths) {
      const s = new Date(year, startM, 1);
      const e = new Date(year, endM + 1, 0);
      if (s <= now) {
        periods.push({ value: `${year}-bm-${startM}`, label: `${label} ${year}`, start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] });
      }
    }
  } else if (activePeriod === 'quarterly') {
    const quarters = [
      ['Q1 (Jan-Mar)', 0, 2], ['Q2 (Apr-Jun)', 3, 5],
      ['Q3 (Jul-Sep)', 6, 8], ['Q4 (Oct-Dec)', 9, 11],
    ] as const;
    for (const [label, startM, endM] of quarters) {
      const s = new Date(year, startM, 1);
      const e = new Date(year, endM + 1, 0);
      if (s <= now) {
        periods.push({ value: `${year}-q-${startM}`, label: `${label} ${year}`, start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] });
      }
    }
  }

  // Always add annual
  periods.push({
    value: `${year}-annual`,
    label: `Full Year ${year}`,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  });

  // Add previous year
  periods.push({
    value: `${year - 1}-annual`,
    label: `Full Year ${year - 1}`,
    start: `${year - 1}-01-01`,
    end: `${year - 1}-12-31`,
  });

  return periods.reverse();
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('revenue');
  const [activeView, setActiveView] = useState<'reports' | 'analytics'>('reports');
  const { canAccess, loading: isLoading, currentBusiness, hasTier, isPlatformAdmin } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const hasReportsAccess = canAccess('reports_enabled');

  const generateReport = useGenerateReport();
  const { generateTaxPack, isGenerating: isGeneratingTaxPack } = useTaxPack();

  const jurisdiction = currentBusiness?.jurisdiction || null;
  const taxPackConfig = jurisdiction ? getJurisdictionTaxPackConfig(jurisdiction) : null;
  const taxPackPeriods = getTaxPackPeriodOptions(taxPackConfig);
  const [selectedTaxPeriod, setSelectedTaxPeriod] = useState(taxPackPeriods[0]?.value || '');

  const handleGenerateReport = async (reportId: ReportType, format: 'json' | 'csv' = 'json') => {
    setGeneratingReport(`${reportId}-${format}`);
    try {
      await generateReport.mutateAsync({
        report_type: reportId,
        year: parseInt(selectedYear),
        format,
        business_id: currentBusiness?.id,
        currency_account_id: currentCurrencyAccount?.id,
      });
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleGenerateTaxPack = () => {
    if (!currentBusiness?.id || !currentCurrencyAccount?.id) return;
    const period = taxPackPeriods.find(p => p.value === selectedTaxPeriod);
    if (!period) return;
    generateTaxPack({
      business_id: currentBusiness.id,
      currency_account_id: currentCurrencyAccount.id,
      period_start: period.start,
      period_end: period.end,
    });
  };

  // Show upgrade prompt if user doesn't have access
  if (!isLoading && !hasReportsAccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate compliance-ready reports and exports
          </p>
        </div>
        <UpgradePrompt
          feature="Reports"
          title="Unlock Powerful Reports"
          description="Generate tax-ready reports, revenue summaries, and audit exports with a Professional subscription."
          requiredTier="professional"
          variant="card"
          className="max-w-xl mx-auto mt-12"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top-level view switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Compliance-ready reports and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeView} onValueChange={v => setActiveView(v as 'reports' | 'analytics')}>
            <TabsList>
              <TabsTrigger value="reports" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5">
                <PieChart className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {activeView === 'analytics' ? (
        <Analytics />
      ) : (
        <div className="space-y-6">
          {/* Year selector */}
          <div className="flex items-center justify-end gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

      {/* Currency Account Indicator */}
      {currentCurrencyAccount ? (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex items-center gap-3 py-3">
            <Badge variant="outline" className="text-sm font-mono">
              {activeCurrency}
            </Badge>
            <span className="text-sm text-muted-foreground">
              All reports below are scoped to <strong>{currentCurrencyAccount.name || activeCurrency}</strong> account.
              Switch currency accounts to see reports in a different currency.
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <span className="text-sm text-destructive">
              No currency account selected. Financial reports require a currency account to ensure accurate, single-currency data.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Tax Pack Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {taxPackConfig?.documentTitle || 'Tax Summary Pack'}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {taxPackConfig
                    ? `Download a ${taxPackConfig.taxAuthorityName}-ready tax filing summary for your accountant`
                    : 'Set your business jurisdiction to generate jurisdiction-specific tax documents'
                  }
                </CardDescription>
              </div>
            </div>
            {taxPackConfig && (
              <Badge variant="outline" className="text-xs shrink-0">
                {taxPackConfig.taxAuthorityName}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3">
            <Select value={selectedTaxPeriod} onValueChange={setSelectedTaxPeriod}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {taxPackPeriods.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleGenerateTaxPack}
              disabled={isGeneratingTaxPack || !currentCurrencyAccount || !currentBusiness?.id || (!isPlatformAdmin && !hasTier('professional'))}
            >
              {isGeneratingTaxPack ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Generate Tax Pack
            </Button>
          </div>
          {taxPackConfig?.hasVat && (
            <p className="text-xs text-muted-foreground mt-2">
              Includes {taxPackConfig.vatLabel} summary at {taxPackConfig.standardVatRate}% standard rate, income statement, revenue &amp; expense registers
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as ReportCategory)}>
        <TabsList className="w-full sm:w-auto">
          {REPORT_CATEGORIES.map(cat => {
            const Icon = CATEGORY_ICONS[cat.id];
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {REPORT_CATEGORIES.map(cat => (
          <TabsContent key={cat.id} value={cat.id} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {REPORT_DEFINITIONS.filter(r => r.category === cat.id).map(report => {
                const isGeneratingJson = generatingReport === `${report.id}-json`;
                const isGeneratingCsv = generatingReport === `${report.id}-csv`;
                const isGenerating = isGeneratingJson || isGeneratingCsv;
                const tierLocked = !isPlatformAdmin && !hasTier(report.requiredTier as any);
                const needsCurrencyAccount = report.requiresCurrencyAccount && !currentCurrencyAccount;

                return (
                  <Card key={report.id} className={`transition-shadow ${tierLocked ? 'opacity-60' : 'hover:shadow-md'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{report.title}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{report.description}</CardDescription>
                          </div>
                        </div>
                        {tierLocked && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {report.requiredTier}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-end gap-2">
                        {report.exportable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateReport(report.id, 'csv')}
                            disabled={isGenerating || tierLocked || needsCurrencyAccount}
                          >
                            {isGeneratingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : 'CSV'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateReport(report.id, 'json')}
                          disabled={isGenerating || tierLocked || needsCurrencyAccount}
                        >
                          {isGeneratingJson ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Generate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Compliance Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Audit-Ready & Currency-Safe</p>
            <p className="text-xs text-muted-foreground">
              All reports are scoped to a single currency account — no cross-currency aggregation.
              Exports include verification hashes and timestamps for compliance.
            </p>
          </div>
        </CardContent>
      </Card>
        </div>
      )}
    </motion.div>
  );
}
