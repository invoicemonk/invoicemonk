import { Shield, Send, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRegulatorySubmissions, useRegulatoryEvents, useSubmitToRegulator } from '@/hooks/use-regulatory';
import { getComplianceAdapter } from '@/lib/compliance-adapters';
import { useState } from 'react';

interface RegulatoryStatusSectionProps {
  invoiceId: string;
  invoiceStatus: string;
  regulatoryStatus: string;
  jurisdiction?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  not_required: { label: 'Not Required', color: 'bg-muted text-muted-foreground', icon: Shield },
  pending_submission: { label: 'Pending', color: 'bg-amber-500/10 text-amber-600', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  accepted: { label: 'Accepted', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export function RegulatoryStatusSection({ invoiceId, invoiceStatus, regulatoryStatus, jurisdiction }: RegulatoryStatusSectionProps) {
  const { data: submissions = [] } = useRegulatorySubmissions(invoiceId);
  const submitToRegulator = useSubmitToRegulator();
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  const isIssued = invoiceStatus !== 'draft';
  if (!isIssued) return null;

  const config = statusConfig[regulatoryStatus] || statusConfig.not_required;
  const StatusIcon = config.icon;

  // Check if jurisdiction supports submission
  const adapter = jurisdiction ? getComplianceAdapter(
    Object.keys({ 'NGA-NRS': 'NG', 'GBR-HMRC': 'GB', 'DEU-BFINV': 'DE' })
      .find(code => getComplianceAdapter(code)?.countryCode === jurisdiction) || ''
  ) : null;
  const canSubmit = adapter?.submissionRequired && 
    (regulatoryStatus === 'not_required' || regulatoryStatus === 'rejected') &&
    invoiceStatus !== 'voided';

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Regulatory Status
        </CardTitle>
        <CardDescription>
          Regulator submission tracking and compliance status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <StatusIcon className="h-5 w-5" />
            <div>
              <Badge className={config.color}>{config.label}</Badge>
              {adapter && (
                <p className="text-xs text-muted-foreground mt-1">{adapter.displayName}</p>
              )}
            </div>
          </div>
          {canSubmit && (
            <Button
              size="sm"
              onClick={() => submitToRegulator.mutate(invoiceId)}
              disabled={submitToRegulator.isPending}
            >
              <Send className="h-3 w-3 mr-1.5" />
              Submit to Regulator
            </Button>
          )}
        </div>

        {/* Submissions List */}
        {submissions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Submissions</p>
            {submissions.map((sub) => {
              const subConfig = statusConfig[sub.submission_status] || statusConfig.not_required;
              return (
                <Collapsible key={sub.id} open={expandedSubmission === sub.id} onOpenChange={(open) => setExpandedSubmission(open ? sub.id : null)}>
                  <div className="border border-border/50 rounded-lg">
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/30 transition-colors rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge className={subConfig.color} variant="secondary">{subConfig.label}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(sub.created_at)}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                      <SubmissionDetail submissionId={sub.id} submission={sub} />
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}

        {submissions.length === 0 && regulatoryStatus === 'not_required' && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No regulatory submission required for this jurisdiction.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SubmissionDetail({ submissionId, submission }: { submissionId: string; submission: any }) {
  const { data: events = [] } = useRegulatoryEvents(submissionId);

  return (
    <div className="space-y-3 pt-2 border-t border-border/30">
      {submission.submission_reference && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Reference</span>
          <span className="font-mono text-xs">{submission.submission_reference}</span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Retries</span>
        <span>{submission.retry_count} / {submission.max_retries}</span>
      </div>
      {events.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Timeline</p>
          {events.map((event) => {
            const payload = event.event_payload as Record<string, unknown> | null;
            return (
              <div key={event.id} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium">{event.event_type.replace(/_/g, ' ')}</span>
                  {payload?.from && payload?.to && (
                    <span className="text-muted-foreground"> — {String(payload.from)} → {String(payload.to)}</span>
                  )}
                  <p className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
