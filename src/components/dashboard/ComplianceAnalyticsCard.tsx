import { Shield, FileCode, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusiness } from '@/contexts/BusinessContext';
import { useComplianceAnalytics } from '@/hooks/use-compliance-artifacts';

export function ComplianceAnalyticsCard() {
  const { currentBusiness } = useBusiness();
  const { data: analytics, isLoading } = useComplianceAnalytics(currentBusiness?.id);

  if (!currentBusiness) return null;

  // Don't show if no invoices have been issued yet
  if (!isLoading && (!analytics || analytics.total_invoices === 0)) return null;

  const score = analytics?.avg_score ?? 0;
  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-destructive';
  const scoreBg = score >= 80 ? 'bg-emerald-500/10' : score >= 50 ? 'bg-amber-500/10' : 'bg-destructive/10';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Compliance Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : analytics ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className={`p-3 rounded-lg ${scoreBg}`}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className={`h-4 w-4 ${scoreColor}`} />
                <span className="text-xs font-medium text-muted-foreground">Avg Score</span>
              </div>
              <p className={`text-2xl font-bold ${scoreColor}`}>{Math.round(score)}%</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Checked</span>
              </div>
              <p className="text-2xl font-bold">{analytics.total_invoices}</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">Warnings</span>
              </div>
              <p className="text-2xl font-bold">{analytics.warning_count}</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <FileCode className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Artifacts</span>
              </div>
              <p className="text-2xl font-bold">{analytics.artifact_count}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
