import { useState } from 'react';
import { AlertTriangle, Clock, FileWarning, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRetentionPoliciesByJurisdiction } from '@/hooks/use-retention-policies';
import { AccountClosureDialog } from './AccountClosureDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountClosureSectionProps {
  userJurisdiction?: string;
}

const ENTITY_LABELS: Record<string, string> = {
  invoice: 'Invoices',
  payment: 'Payments',
  credit_note: 'Credit Notes',
  audit_log: 'Audit Logs',
  export_manifest: 'Export Records',
};

const FLAG_EMOJIS: Record<string, string> = {
  NG: '🇳🇬',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
  DE: '🇩🇪',
  FR: '🇫🇷',
};

const JURISDICTION_NAMES: Record<string, string> = {
  NG: 'Nigerian',
  US: 'US',
  GB: 'UK',
  CA: 'Canadian',
  AU: 'Australian',
  DE: 'German',
  FR: 'French',
};

export function AccountClosureSection({ userJurisdiction = 'NG' }: AccountClosureSectionProps) {
  const [showDialog, setShowDialog] = useState(false);
  const { data: policies, isLoading } = useRetentionPoliciesByJurisdiction(userJurisdiction);

  const maxRetentionYears = policies?.reduce(
    (max, p) => Math.max(max, p.retention_years),
    0
  ) || 7;

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Close Account</CardTitle>
          </div>
          <CardDescription>
            Permanently close your account and request data deletion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/30">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>This action is permanent</AlertTitle>
            <AlertDescription>
              Once you close your account, you will lose access to all your data, invoices, 
              and settings. This cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-brand-600" />
              <span>Data Retention Notice</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Per {FLAG_EMOJIS[userJurisdiction] || ''} {JURISDICTION_NAMES[userJurisdiction] || userJurisdiction} tax regulations, 
              certain records must be retained for legal compliance:
            </p>
            
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : policies && policies.length > 0 ? (
              <ul className="text-sm space-y-1.5 pl-4">
                {policies.map((policy) => (
                  <li key={policy.id} className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>
                      <strong>{ENTITY_LABELS[policy.entity_type] || policy.entity_type}:</strong>{' '}
                      {policy.retention_years} years
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Standard retention period: 7 years
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
              Your compliance data will be retained for the legally required period 
              after account closure, then permanently deleted.
            </p>
          </div>

          <Button 
            variant="destructive" 
            onClick={() => setShowDialog(true)}
            className="w-full sm:w-auto"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Request Account Closure
          </Button>
        </CardContent>
      </Card>

      <AccountClosureDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        retentionPolicies={policies || []}
        maxRetentionYears={maxRetentionYears}
        jurisdiction={userJurisdiction}
      />
    </>
  );
}
