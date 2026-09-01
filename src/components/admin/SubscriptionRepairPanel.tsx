import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wrench, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type CallState = 'idle' | 'loading' | 'done';

interface CallResult {
  ok: boolean;
  status: number;
  body: unknown;
}

async function invokeAdmin(functionName: string, body?: Record<string, unknown>): Promise<CallResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in again.');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, body: parsed };
}

/**
 * Admin-only subscription repair utilities.
 * All buttons hit server-gated edge functions (platform_admin required).
 */
export function SubscriptionRepairPanel() {
  const [scanState, setScanState] = useState<CallState>('idle');
  const [scanResult, setScanResult] = useState<CallResult | null>(null);
  const [repairState, setRepairState] = useState<CallState>('idle');
  const [repairResult, setRepairResult] = useState<CallResult | null>(null);
  const [syncState, setSyncState] = useState<CallState>('idle');
  const [syncResult, setSyncResult] = useState<CallResult | null>(null);
  const [confirmRepair, setConfirmRepair] = useState(false);

  // Parameterised repair form
  const [rowId, setRowId] = useState('');
  const [cancelIds, setCancelIds] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');
  const [paidThrough, setPaidThrough] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const runScan = async () => {
    setScanState('loading');
    try {
      const r = await invokeAdmin('admin-scan-duplicate-subs', { days_back: 90 });
      setScanResult(r);
      setScanState('done');
      toast[r.ok ? 'success' : 'error'](
        r.ok ? 'Duplicate-subs scan complete' : `Scan failed (${r.status})`,
      );
    } catch (e) {
      setScanState('idle');
      toast.error((e as Error).message);
    }
  };

  const runRepair = async () => {
    if (!confirmRepair) {
      toast.error('Tick the confirmation box first.');
      return;
    }
    const cancelList = cancelIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!rowId && cancelList.length === 0) {
      toast.error('Provide a subscription row ID and/or Stripe subscription IDs to cancel.');
      return;
    }
    // Mirrors the server rule: paid_through is never accepted without a reason.
    if (paidThrough && !reason.trim()) {
      toast.error('A written reason is required whenever you grant paid-through coverage.');
      return;
    }
    if (paidThrough && !rowId) {
      toast.error('Paid-through coverage needs the subscription row ID it applies to.');
      return;
    }

    const body: Record<string, unknown> = {};
    if (cancelList.length) {
      body.cancel_subscription_ids = cancelList.map((id) => ({
        id,
        ...(reason.trim() ? { metadata: { cancellation_reason: reason.trim().slice(0, 400) } } : {}),
      }));
    }
    if (rowId) {
      body.update_db_subscription = {
        id: rowId.trim(),
        ...(tier.trim() ? { tier: tier.trim() } : {}),
        ...(status.trim() ? { status: status.trim() } : {}),
        ...(paidThrough
          ? {
              paid_through: new Date(`${paidThrough}T00:00:00Z`).toISOString(),
              paid_through_reason: reason.trim(),
            }
          : {}),
      };
    }
    if (note.trim() || reason.trim()) {
      body.audit = { note: note.trim() || reason.trim() };
    }

    setRepairState('loading');
    try {
      const r = await invokeAdmin('admin-repair-stripe-subscription', body);
      setRepairResult(r);
      setRepairState('done');
      toast[r.ok ? 'success' : 'error'](
        r.ok ? 'Repair complete' : `Repair returned ${r.status}`,
      );
    } catch (e) {
      setRepairState('idle');
      toast.error((e as Error).message);
    }
  };

  const runSync = async () => {
    setSyncState('loading');
    try {
      const r = await invokeAdmin('sync-subscriptions');
      setSyncResult(r);
      setSyncState('done');
      toast[r.ok ? 'success' : 'error'](
        r.ok ? 'sync-subscriptions run complete' : `sync-subscriptions failed (${r.status})`,
      );
    } catch (e) {
      setSyncState('idle');
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Subscription repair
        </CardTitle>
        <CardDescription>
          Platform-admin utilities for reconciling a subscription against Stripe.
          Every action hits a server-gated edge function; nothing runs client-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">1. Scan for duplicate subscriptions (read-only)</p>
              <p className="text-xs text-muted-foreground">
                Surfaces customers with more than one active Stripe sub and paid-invoice pairs
                within 10 minutes over the last 90 days.
              </p>
            </div>
            <Button onClick={runScan} disabled={scanState === 'loading'} variant="secondary">
              {scanState === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run scan
            </Button>
          </div>
          {scanResult && (
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(scanResult, null, 2)}
            </pre>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <div>
            <p className="text-sm font-medium">2. Repair a subscription (live money)</p>
            <p className="text-xs text-muted-foreground">
              Cancels the Stripe subscriptions you list and patches the DB row. Paid-through
              coverage is durable credit — reconciliation and webhooks will not downgrade the
              customer before that date.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="repair-row-id">Subscription row ID (public.subscriptions.id)</Label>
              <Input
                id="repair-row-id"
                value={rowId}
                onChange={(e) => setRowId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repair-cancel-ids">Stripe subscription IDs to cancel (optional)</Label>
              <Input
                id="repair-cancel-ids"
                value={cancelIds}
                onChange={(e) => setCancelIds(e.target.value)}
                placeholder="sub_123, sub_456"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repair-tier">Tier (optional)</Label>
              <Input
                id="repair-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                placeholder="professional"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repair-status">Status (optional)</Label>
              <Input
                id="repair-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="active"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repair-paid-through">Paid through (optional)</Label>
              <Input
                id="repair-paid-through"
                type="date"
                value={paidThrough}
                onChange={(e) => setPaidThrough(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repair-reason">
                Reason {paidThrough ? <span className="text-destructive">(required)</span> : '(optional)'}
              </Label>
              <Input
                id="repair-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this override is being applied"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="repair-note">Audit note (optional)</Label>
              <Textarea
                id="repair-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Extra context stored in the audit trail"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={confirmRepair}
              onChange={(e) => setConfirmRepair(e.target.checked)}
              className="h-4 w-4"
            />
            I understand this modifies live Stripe subscriptions and the customer&apos;s DB row.
          </label>

          <Button
            onClick={runRepair}
            disabled={repairState === 'loading' || !confirmRepair || (!!paidThrough && !reason.trim())}
            variant="destructive"
          >
            {repairState === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Run repair
          </Button>

          {repairResult && (
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(repairResult, null, 2)}
            </pre>
          )}
        </section>

        <section className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">3. Regression check — manual sync-subscriptions</p>
              <p className="text-xs text-muted-foreground">
                Runs the reconciliation job once and records the run, so you can confirm it
                completes without errors.
              </p>
            </div>
            <Button onClick={runSync} disabled={syncState === 'loading'} variant="secondary">
              {syncState === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run sync
            </Button>
          </div>
          {syncResult && (
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(syncResult, null, 2)}
            </pre>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
