import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Inbox, Store, Tag } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Diagnostics {
  uncategorizedCount: number;
  missingVendorCount: number;
  pendingInboxCount: number;
}

export function TaxReportDiagnostics({
  diagnostics,
  businessId,
}: {
  diagnostics: Diagnostics;
  businessId?: string;
}) {
  const { uncategorizedCount, missingVendorCount, pendingInboxCount } = diagnostics;
  const total = uncategorizedCount + missingVendorCount + pendingInboxCount;

  if (total === 0) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Your records look complete for this period.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          What's missing
        </CardTitle>
        <CardDescription>Resolve these to make the report more accurate.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-3">
        {pendingInboxCount > 0 && (
          <DiagItem
            icon={Inbox}
            label={`${pendingInboxCount} unreviewed inbox item${pendingInboxCount === 1 ? '' : 's'}`}
            href={businessId ? `/b/${businessId}/expenses/inbox` : undefined}
          />
        )}
        {uncategorizedCount > 0 && (
          <DiagItem
            icon={Tag}
            label={`${uncategorizedCount} expense${uncategorizedCount === 1 ? '' : 's'} without category`}
            href={businessId ? `/b/${businessId}/accounting/expenses?filter=uncategorized` : undefined}
          />
        )}
        {missingVendorCount > 0 && (
          <DiagItem
            icon={Store}
            label={`${missingVendorCount} expense${missingVendorCount === 1 ? '' : 's'} without vendor`}
            href={businessId ? `/b/${businessId}/accounting/expenses?filter=no-vendor` : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DiagItem({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-2 text-sm hover:bg-background/70 transition-colors">
      <Icon className="h-4 w-4 text-amber-400 shrink-0" />
      <span>{label}</span>
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}
