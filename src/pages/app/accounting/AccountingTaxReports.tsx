import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Printer, AlertTriangle, Download, Loader2, Lock } from 'lucide-react';
import { AccountingNavTabs } from '@/components/accounting/AccountingNavTabs';
import { AccountingPeriodSelector, getAccountingDateRange, getPeriodLabel } from '@/components/accounting/AccountingPeriodSelector';
import { AccountingDisclaimer } from '@/components/accounting/AccountingDisclaimer';
import { TaxReportDiagnostics } from '@/components/accounting/TaxReportDiagnostics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingPreferences, type AccountingPeriod } from '@/hooks/use-accounting-preferences';
import { useTaxReport } from '@/hooks/use-tax-report';
import {
  resolveTaxJurisdiction,
  getJurisdictionLabel,
  type TaxReportJurisdiction,
} from '@/lib/tax-report-mappings';
import { formatCurrency } from '@/lib/utils';

const JURISDICTION_OPTIONS: TaxReportJurisdiction[] = ['US', 'GB', 'EU', 'NG', 'XX'];

export default function AccountingTaxReports() {
  const { businessId } = useParams<{ businessId: string }>();
  const { currentBusiness: business, hasTier, isPlatformAdmin } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const { data: preferences } = useAccountingPreferences();

  const defaultJurisdiction = useMemo(
    () => resolveTaxJurisdiction(business?.jurisdiction),
    [business?.jurisdiction],
  );
  const [jurisdiction, setJurisdiction] = useState<TaxReportJurisdiction>(defaultJurisdiction);
  const [period, setPeriod] = useState<AccountingPeriod>(preferences?.defaultAccountingPeriod || 'yearly');

  const dateRange = getAccountingDateRange(period) ?? undefined;

  const { report, isLoading } = useTaxReport({
    businessId: business?.id,
    currencyAccountId: currentCurrencyAccount?.id,
    currency: activeCurrency,
    jurisdiction,
    dateRange,
  });

  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const canExportPdf = isPlatformAdmin || hasTier('professional');

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!business?.id) return;
    if (format === 'pdf' && !canExportPdf) {
      toast.error('Print-ready report requires a Professional subscription or higher.');
      return;
    }
    setExporting(format);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const toIso = (d: Date) => d.toISOString().split('T')[0];
      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate-tax-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            business_id: business.id,
            currency_account_id: currentCurrencyAccount?.id,
            currency: activeCurrency,
            jurisdiction,
            start_date: dateRange ? toIso(dateRange.start) : undefined,
            end_date: dateRange ? toIso(dateRange.end) : undefined,
            period_label: getPeriodLabel(period),
            format: format === 'pdf' ? 'print' : 'csv',
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      if (format === 'pdf') {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
          // Popup blocked — fall back to download
          const a = document.createElement('a');
          a.href = url;
          a.download = `tax-report-${jurisdiction}-${activeCurrency}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        toast.success('Print-ready report opened in a new tab.');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax-report-${jurisdiction}-${activeCurrency}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Tax report CSV downloaded.');
      }
    } catch (e) {
      toast.error((e as Error).message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight font-display">Tax Reports</h1>
          <p className="text-sm text-muted-foreground">
            Structured filing-style summaries — informational, not a substitute for a licensed accountant.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={!report || report.lines.length === 0 || exporting !== null}
          >
            {exporting === 'csv' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            CSV
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={!report || report.lines.length === 0 || exporting !== null}
            title={canExportPdf
              ? 'Opens a branded page — print or Save as PDF from your browser'
              : 'Upgrade to Professional to generate the print-ready report'}
          >
            {exporting === 'pdf'
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : canExportPdf ? <Printer className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Print-ready report (Pro)
          </Button>
        </div>
      </div>

      <AccountingNavTabs />

      {/* Disclaimer */}
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Informational summary — figures roll up from your recorded expenses and issued invoices in {activeCurrency}.
          Not a substitute for a licensed accountant or a filed return.
        </span>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Jurisdiction</label>
            <Select value={jurisdiction} onValueChange={(v) => setJurisdiction(v as TaxReportJurisdiction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JURISDICTION_OPTIONS.map((j) => (
                  <SelectItem key={j} value={j}>{getJurisdictionLabel(j)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Period</label>
            <AccountingPeriodSelector value={period} onChange={setPeriod} />
          </div>
        </CardContent>
      </Card>

      <AccountingDisclaimer />

      {/* What's missing */}
      {report && (
        <TaxReportDiagnostics
          diagnostics={report.diagnostics}
          businessId={businessId}
        />
      )}

      {/* EU VAT summary */}
      {report?.vat && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">VAT position — {getPeriodLabel(period)}</CardTitle>
            <CardDescription>Output VAT collected on invoices minus input VAT paid on expenses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <VatStat label="Output VAT (collected)" value={report.vat.outputVat} currency={report.currency} />
            <VatStat label="Input VAT (reclaimable)" value={report.vat.inputVat} currency={report.currency} />
            <VatStat
              label="Net position"
              value={report.vat.netPosition}
              currency={report.currency}
              emphasis
            />
          </CardContent>
        </Card>
      )}

      {/* Report table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg">{getJurisdictionLabel(jurisdiction)}</CardTitle>
              <CardDescription>{getPeriodLabel(period)} · {activeCurrency}</CardDescription>
            </div>
            {report && (
              <Badge variant="outline" className="text-xs">
                {report.lines.length} line{report.lines.length === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !report || report.lines.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No expenses in this period. Record expenses or approve items from the Inbox to see your tax report.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Line</th>
                    <th className="py-2 pr-4 font-medium text-right">Items</th>
                    <th className="py-2 pr-4 font-medium text-right">Raw total</th>
                    <th className="py-2 pl-4 font-medium text-right">Deductible</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((line) => {
                    const isPartial = Math.abs(line.deductibleTotal - line.rawTotal) > 0.005;
                    return (
                      <motion.tr
                        key={line.code}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{line.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-1 flex-wrap">
                            {line.categories.map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px] h-4 px-1.5">{c}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">{line.count}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {formatCurrency(line.rawTotal, report.currency)}
                        </td>
                        <td className="py-3 pl-4 text-right tabular-nums font-medium">
                          {formatCurrency(line.deductibleTotal, report.currency)}
                          {isPartial && (
                            <div className="text-[10px] text-amber-400 mt-0.5">
                              {Math.round((line.deductibleTotal / line.rawTotal) * 100)}% deductible
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-3 pr-4">Total</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                      {report.lines.reduce((s, l) => s + l.count, 0)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatCurrency(report.totalRaw, report.currency)}
                    </td>
                    <td className="py-3 pl-4 text-right tabular-nums text-primary">
                      {formatCurrency(report.totalDeductible, report.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VatStat({
  label, value, currency, emphasis,
}: { label: string; value: number; currency: string; emphasis?: boolean }) {
  const positive = value >= 0;
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${
        emphasis ? (positive ? 'text-destructive' : 'text-emerald-400') : ''
      }`}>
        {formatCurrency(value, currency)}
      </div>
      {emphasis && (
        <div className="text-xs text-muted-foreground">
          {positive ? 'Owed to tax authority' : 'Refundable'}
        </div>
      )}
    </div>
  );
}

