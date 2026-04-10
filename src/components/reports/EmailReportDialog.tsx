import { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useEmailReport, type ReportType, type ReportFormat } from '@/hooks/use-reports';

interface EmailReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: ReportType;
  reportTitle: string;
  year: number;
  businessId?: string;
  currencyAccountId?: string;
}

export function EmailReportDialog({
  open,
  onOpenChange,
  reportId,
  reportTitle,
  year,
  businessId,
  currencyAccountId,
}: EmailReportDialogProps) {
  const { user } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const emailReport = useEmailReport();

  const effectiveEmail = recipientEmail || user?.email || '';

  const handleSend = async () => {
    await emailReport.mutateAsync({
      report_type: reportId,
      year,
      format,
      business_id: businessId,
      currency_account_id: currencyAccountId,
      recipient_email: effectiveEmail,
      report_title: reportTitle,
    });
    onOpenChange(false);
    setRecipientEmail('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Report
          </DialogTitle>
          <DialogDescription>
            Send <strong>{reportTitle}</strong> ({year}) to an email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Recipient Email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder={user?.email || 'Enter email address'}
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to send to your account email.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={emailReport.isPending}>
            {emailReport.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
