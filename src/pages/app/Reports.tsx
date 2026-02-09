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
} from 'lucide-react';
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

const CATEGORY_ICONS: Record<ReportCategory, typeof DollarSign> = {
  revenue: DollarSign,
  receipts: Receipt,
  expenses: Wallet,
  accounting: Calculator,
  compliance: ShieldCheck,
};

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('revenue');

  const { canAccess, loading: isLoading, currentBusiness, hasTier, isPlatformAdmin } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const hasReportsAccess = canAccess('reports_enabled');

  const generateReport = useGenerateReport();

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

  const categoryReports = REPORT_DEFINITIONS.filter(r => r.category === activeCategory);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Compliance-ready reports scoped by currency account
          </p>
        </div>
        <div className="flex items-center gap-2">
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
    </motion.div>
  );
}
