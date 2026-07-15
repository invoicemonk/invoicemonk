import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
 * Admin-only utilities for the July 2026 Stripe subscription incident.
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
    setRepairState('loading');
    try {
      const r = await invokeAdmin('admin-repair-stripe-subscription', { preset: 'rico_2026_07' });
      setRepairResult(r);
      setRepairState('done');
      toast[r.ok ? 'success' : 'error'](
        r.ok ? 'Rico 2026-07 repair complete' : `Repair returned ${r.status}`,
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
          Subscription Repair (Rico 2026-07)
        </CardTitle>
        <CardDescription>
          Platform-admin utilities to close the July 2026 duplicate-subscription incident.
          Every button hits a server-gated edge function; nothing runs client-side.
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

        <section className="space-y-2 border-t pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">2. Run Rico 2026-07 repair (live money)</p>
              <p className="text-xs text-muted-foreground">
                Voids invoice 0008, cancels the old $5 sub + duplicate $15 sub, extends the
                surviving $15 sub via <code>trial_end</code> to 2026-09-01, and patches the
                DB row. Idempotent on Stripe's side; skips already-completed actions.
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmRepair}
                  onChange={(e) => setConfirmRepair(e.target.checked)}
                  className="h-4 w-4"
                />
                I understand this modifies live Stripe subscriptions and Rico's DB row.
              </label>
            </div>
            <Button
              onClick={runRepair}
              disabled={repairState === 'loading' || !confirmRepair}
              variant="destructive"
            >
              {repairState === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Run repair
            </Button>
          </div>
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
                Runs the sync cron once. Confirms the past_due → active-sibling guard leaves
                Rico's row untouched after the repair.
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
