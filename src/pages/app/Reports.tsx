import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Download,
  Calendar,
  FileText,
  TrendingUp,
  DollarSign,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradePrompt } from '@/components/app/UpgradePrompt';
import { useGenerateReport, useReportStats, useAuditEventsCount, type ReportType } from '@/hooks/use-reports';

const reportTypes: {
  id: ReportType;
  title: string;
  description: string;
  icon: typeof DollarSign;
  format: string;
}[] = [
  {
    id: 'revenue-summary',
    title: 'Revenue Summary',
    description: 'Monthly revenue breakdown with trends',
    icon: DollarSign,
    format: 'PDF / Excel',
  },
  {
    id: 'invoice-register',
    title: 'Invoice Register',
    description: 'Complete list of all issued invoices',
    icon: FileText,
    format: 'PDF / Excel / CSV',
  },
  {
    id: 'tax-report',
    title: 'Tax Report',
    description: 'Tax-ready summary for filing',
    icon: TrendingUp,
    format: 'PDF',
  },
  {
    id: 'audit-export',
    title: 'Audit Export',
    description: 'Complete audit trail with hash verification',
    icon: BarChart3,
    format: 'PDF / JSON',
  },
];

function formatCurrency(amount: number, currency: string = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  
  const { canAccess, isLoading } = useSubscription();
  const hasReportsAccess = canAccess('reports_enabled');
  
  const generateReport = useGenerateReport();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useReportStats(
    parseInt(selectedYear)
  );
  const { data: auditEventsCount, isLoading: auditLoading, isError: auditError } = useAuditEventsCount(
    parseInt(selectedYear)
  );

  const handleGenerateReport = async (reportId: ReportType) => {
    setGeneratingReport(reportId);
    try {
      await generateReport.mutateAsync({
        report_type: reportId,
        year: parseInt(selectedYear),
        format: 'json'
      });
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleDownloadCSV = async (reportId: ReportType) => {
    setGeneratingReport(reportId);
    try {
      await generateReport.mutateAsync({
        report_type: reportId,
        year: parseInt(selectedYear),
        format: 'csv'
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
            Generate compliance-ready reports and exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
              <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
              <SelectItem value={(currentYear - 2).toString()}>{currentYear - 2}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats - Real Data */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : statsError ? (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalRevenue || 0, stats?.currency)}
              </div>
            )}
            <p className="text-sm text-muted-foreground">Total Revenue (YTD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : statsError ? (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            ) : (
              <div className="text-2xl font-bold">{stats?.totalInvoices || 0}</div>
            )}
            <p className="text-sm text-muted-foreground">Invoices Issued (YTD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {statsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : statsError ? (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalTax || 0, stats?.currency)}
              </div>
            )}
            <p className="text-sm text-muted-foreground">Tax Collected (YTD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {auditLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : auditError ? (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            ) : (
              <div className="text-2xl font-bold">{auditEventsCount?.toLocaleString() || 0}</div>
            )}
            <p className="text-sm text-muted-foreground">Audit Events (YTD)</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map((report) => {
          const isGenerating = generatingReport === report.id;
          return (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <report.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {report.format}
                  </Badge>
                  <div className="flex gap-2">
                    {(report.id === 'invoice-register' || report.id === 'revenue-summary' || report.id === 'tax-report') && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownloadCSV(report.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>CSV</>
                        )}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleGenerateReport(report.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Generate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Compliance Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <BarChart3 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Audit-Ready Exports</p>
            <p className="text-xs text-muted-foreground">
              All exports include verification hashes and timestamps. Reports are generated from immutable 
              source data and include cryptographic proof of integrity.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
