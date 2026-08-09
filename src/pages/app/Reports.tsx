import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Calendar,
  FileText,
  DollarSign,
  Loader2,
  Receipt,
  Wallet,
  Calculator,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  PieChart,
  Mail,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import Analytics from '@/pages/app/Analytics';
import { EmailReportDialog } from '@/components/reports/EmailReportDialog';
import { ReportUseCaseBadge } from '@/components/reports/ReportUseCaseBadge';
import { ReportGuide } from '@/components/reports/ReportGuide';
import { ReportPreviewCard } from '@/components/reports/ReportPreviewCard';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { UpgradePrompt } from '@/components/app/UpgradePrompt';
import {
  useGenerateReport,
  useReportPreview,
  REPORT_DEFINITIONS,
  REPORT_CATEGORIES,
  type ReportType,
  type ReportCategory,
  type ReportFormat,
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
  const [activeView, setActiveView] = useState<'reports' | 'analytics'>('reports');
  const [previewReportId, setPreviewReportId] = useState<ReportType | null>(null);
  const [emailDialogReport, setEmailDialogReport] = useState<{ id: ReportType; title: string } | null>(null);
  const { canAccess, loading: isLoading, currentBusiness, hasTier, isPlatformAdmin } = useBusiness();
  const { currentCurrencyAccount, activeCurrency, currencyAccounts, switchCurrencyAccount, loading: loadingCurrencyAccount } = useCurrencyAccount();
  const hasReportsAccess = canAccess('reports_enabled');

  const generateReport = useGenerateReport();
  const previewReport = useReportPreview();

  const handleGenerateReport = async (reportId: ReportType, format: ReportFormat = 'csv') => {
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

  const handleTogglePreview = async (reportId: ReportType) => {
    if (previewReportId === reportId) {
      setPreviewReportId(null);
      return;
    }

    setPreviewReportId(reportId);
    const report = REPORT_DEFINITIONS.find(r => r.id === reportId);
    if (!report) return;

    if (report.requiresCurrencyAccount && !currentCurrencyAccount) {
      return;
    }

    previewReport.mutate({
      report_type: reportId,
      year: parseInt(selectedYear),
      format: 'json',
      business_id: currentBusiness?.id,
      currency_account_id: currentCurrencyAccount?.id,
    });
  };

  const handleEmailFromPreview = (reportId: ReportType) => {
    const report = REPORT_DEFINITIONS.find(r => r.id === reportId);
    if (!report) return;
    setEmailDialogReport({ id: reportId, title: report.title });
  };

  const handleDownload = (reportId: ReportType, format: ReportFormat) => {
    handleGenerateReport(reportId, format);
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
    <TooltipProvider>
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
            <Tabs data-tour="reports-tabs" value={activeView} onValueChange={v => setActiveView(v as 'reports' | 'analytics')}>
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
            <ReportGuide />

            {/* Currency account + year selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {loadingCurrencyAccount ? (
                <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
              ) : currentCurrencyAccount ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {currencyAccounts.length > 1 ? (
                    <Select
                      value={currentCurrencyAccount.id}
                      onValueChange={(id) => switchCurrencyAccount(id)}
                    >
                      <SelectTrigger className="w-[220px]">
                        <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name || account.currency} ({account.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-sm font-mono h-10 px-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      {currentCurrencyAccount.name || activeCurrency} ({activeCurrency})
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Reports are scoped to this currency account. InvoiceMonk never mixes currencies.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <span className="text-sm text-destructive">
                    No currency account selected. Financial reports require a currency account.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px]">
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
                      const isPreviewOpen = previewReportId === report.id;
                      const tierLocked = !isPlatformAdmin && !hasTier(report.requiredTier as any);
                      const needsCurrencyAccount = report.requiresCurrencyAccount && !currentCurrencyAccount;
                      const isComplianceReport = report.category === 'compliance' && report.id !== 'export-history';
                      const isGenerating = !!generatingReport?.startsWith(`${report.id}-`);

                      return (
                        <div key={report.id} className="space-y-0">
                          <Card className={`transition-shadow ${tierLocked ? 'opacity-70' : 'hover:shadow-md'} ${isPreviewOpen ? 'ring-2 ring-primary' : ''}`}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-primary/10">
                                    <FileText className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-base">{report.title}</CardTitle>
                                    <p className="text-sm text-foreground mt-0.5">{report.tagline}</p>
                                    <CardDescription className="text-xs mt-1">{report.description}</CardDescription>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <ReportUseCaseBadge reportId={report.id} />
                                  {tierLocked && (
                                    <Badge variant="secondary" className="text-xs">
                                      {report.requiredTier}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center justify-end gap-2">
                                {tierLocked ? (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Lock className="h-3.5 w-3.5" />
                                    {report.category === 'compliance' || report.id === 'tax-report'
                                      ? 'Tax & compliance reports require the Business plan.'
                                      : 'This report requires the Professional plan.'}
                                  </div>
                                ) : needsCurrencyAccount ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" disabled>
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Select currency
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs">Choose a currency account above to generate this report.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleTogglePreview(report.id)}
                                      disabled={isGenerating}
                                    >
                                      {isPreviewOpen ? (
                                        <>
                                          <ChevronUp className="h-4 w-4 mr-2" />
                                          Hide preview
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-4 w-4 mr-2" />
                                          Preview
                                        </>
                                      )}
                                    </Button>
                                    {!isPreviewOpen && report.exportable && (
                                      <>
                                        {isComplianceReport && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(report.id, 'pdf')}
                                            disabled={isGenerating}
                                          >
                                            {generatingReport === `${report.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'PDF'}
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDownload(report.id, 'json')}
                                          disabled={isGenerating}
                                        >
                                          {generatingReport === `${report.id}-json` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'JSON'}
                                        </Button>
                                        <Button
                                          data-tour="reports-export"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDownload(report.id, 'csv')}
                                          disabled={isGenerating}
                                        >
                                          {generatingReport === `${report.id}-csv` ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          ) : (
                                            <Download className="h-4 w-4 mr-2" />
                                          )}
                                          Download
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>

                          {isPreviewOpen && (
                            <ReportPreviewCard
                              reportId={report.id}
                              reportTitle={report.title}
                              year={parseInt(selectedYear)}
                              currency={activeCurrency}
                              preview={previewReport.data}
                              isLoading={previewReport.isPending}
                              error={previewReport.error}
                              onDownload={(format) => handleDownload(report.id, format)}
                              onEmail={() => handleEmailFromPreview(report.id)}
                              isGenerating={isGenerating}
                            />
                          )}
                        </div>
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

        {emailDialogReport && (
          <EmailReportDialog
            open={!!emailDialogReport}
            onOpenChange={(open) => !open && setEmailDialogReport(null)}
            reportId={emailDialogReport.id}
            reportTitle={emailDialogReport.title}
            year={parseInt(selectedYear)}
            businessId={currentBusiness?.id}
            currencyAccountId={currentCurrencyAccount?.id}
          />
        )}
      </motion.div>
    </TooltipProvider>
  );
}
