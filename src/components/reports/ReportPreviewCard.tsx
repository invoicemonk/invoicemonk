import { useMemo } from 'react';
import { Loader2, Download, FileJson, FileText, Mail, AlertCircle, Plus, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import type { ReportType, ReportResponse } from '@/hooks/use-reports';

interface ReportPreviewCardProps {
  reportId: ReportType;
  reportTitle: string;
  year: number;
  currency?: string;
  preview: ReportResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onDownload: (format: 'csv' | 'pdf' | 'json') => void;
  onEmail: () => void;
  isGenerating: boolean;
}

const EMPTY_STATE_LINKS: Record<ReportType, { label: string; to: string } | null> = {
  'invoice-register': { label: 'Create your first invoice', to: '../invoices/new' },
  'revenue-by-period': { label: 'Create your first invoice', to: '../invoices/new' },
  'revenue-by-client': { label: 'Create your first invoice', to: '../invoices/new' },
  'outstanding-report': { label: 'Create your first invoice', to: '../invoices/new' },
  'receipt-register': { label: 'Record a payment', to: '../invoices' },
  'expense-register': { label: 'Add an expense', to: '../accounting/expenses' },
  'expense-by-category': { label: 'Add an expense', to: '../accounting/expenses' },
  'expense-by-vendor': { label: 'Add an expense', to: '../accounting/expenses' },
  'income-statement': { label: 'Create an invoice or add an expense', to: '../invoices/new' },
  'cash-flow-summary': { label: 'Create an invoice or add an expense', to: '../invoices/new' },
  'tax-report': { label: 'Create your first invoice', to: '../invoices/new' },
  'audit-export': null,
  'export-history': null,
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 120);
  return JSON.stringify(value);
}

function isEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
}

export function ReportPreviewCard({
  reportId,
  reportTitle,
  year,
  currency,
  preview,
  isLoading,
  error,
  onDownload,
  onEmail,
  isGenerating,
}: ReportPreviewCardProps) {
  const rows = useMemo(() => {
    if (!preview?.data || !Array.isArray(preview.data)) return [];
    return preview.data.slice(0, 5);
  }, [preview]);

  const columns = useMemo(() => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const summary = preview?.summary;

  if (isLoading) {
    return (
      <Card className="mt-4 bg-muted/20">
        <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preview for {reportTitle}...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 border-destructive/50">
        <CardContent className="p-4">
          <Alert variant="destructive" className="border-0 bg-transparent p-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message || 'Could not load the preview. Try downloading the report instead.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (preview && (!preview.data || (Array.isArray(preview.data) && preview.data.length === 0))) {
    const link = EMPTY_STATE_LINKS[reportId];
    return (
      <Card className="mt-4 border-dashed bg-muted/20">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No data for {reportTitle} in {year}</p>
              <p className="text-xs text-muted-foreground">
                {currency ? `Your selected ${currency} account has no records for this report.` : 'No records found for this report.'}
              </p>
            </div>
            {link && (
              <Button asChild size="sm" variant="outline">
                <Link to={link.to}>
                  <Plus className="h-4 w-4 mr-2" />
                  {link.label}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 bg-muted/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Preview</p>
            <p className="text-xs text-muted-foreground">
              {Array.isArray(preview?.data) ? (preview?.data as unknown[]).length : 0} rows · {currency || 'No currency'} · {year}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDownload('json')} disabled={isGenerating}>
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDownload('pdf')} disabled={isGenerating}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button size="sm" onClick={() => onDownload('csv')} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={onEmail} disabled={isGenerating}>
              <Mail className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {summary && Object.keys(summary).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary).map(([key, value]) => {
              if (key === 'currency') return null;
              return (
                <Badge key={key} variant="secondary" className="text-xs font-normal">
                  {key.replace(/_/g, ' ')}: {formatCellValue(value)}
                </Badge>
              );
            })}
          </div>
        )}

        {rows.length > 0 && columns.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="text-xs whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell key={col} className="text-xs max-w-[200px] truncate">
                        {formatCellValue((row as Record<string, unknown>)[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
