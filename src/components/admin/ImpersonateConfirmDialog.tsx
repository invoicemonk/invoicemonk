import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel: string;
  onConfirm: () => void;
}

export function ImpersonateConfirmDialog({ open, onOpenChange, targetLabel, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const canConfirm = typed.trim().toUpperCase() === 'IMPERSONATE';

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped('');
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Start impersonation session
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You will view the app as <strong>{targetLabel}</strong> in <strong>read-only</strong> mode.
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>All mutation actions (create, edit, delete, send) are disabled.</li>
                <li>Every action is written to the audit log with your admin identity.</li>
                <li>The session auto-exits after 30 minutes.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="impersonate-confirm">Type <code className="font-mono">IMPERSONATE</code> to confirm</Label>
          <Input
            id="impersonate-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              setTyped('');
            }}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            Start session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
