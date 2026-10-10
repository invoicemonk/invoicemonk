import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { EmailFrame } from './JourneyEmails';

type Row = Record<string, any>;
const SEGMENTS: Record<string, string> = { A: 'Was active, now inactive', B: 'Never got started', C: 'Cancelled with a reason', D: 'Excluded (account/fraud)', E: 'Unsubscribed' };

function nextEligibleStep(r: Row): number | null {
  if (!['A', 'B', 'C'].includes(r.segment) || r.responded_at || r.has_open_abandonment) return null;
  const count = Number(r.research_sent_count ?? 0);
  if (!Number.isInteger(count) || count < 0 || count >= 3) return null;
  const next = count + 1;
  if (next > 1) {
    const waitDays = next === 2 ? 7 : 14;
    if (!r.last_research_at || Date.now() - new Date(r.last_research_at).getTime() < waitDays * 86400000) return null;
  }
  return next;
}

function status(r: Row) {
  if (r.segment === 'D' || r.segment === 'E') return r.excluded_reason?.replace(/_/g, ' ') ?? 'excluded';
  if (r.responded_at) return 'responded — sequence stopped';
  if (r.research_sent_count >= 3) return 'sequence complete';
  if (r.has_open_abandonment) return 'waiting: abandonment journey open';
  return r.research_sent_count ? `email ${r.research_sent_count} of 3 sent` : 'not contacted';
}

export function DormantResearch() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [seg, setSeg] = useState('A');
  const [step, setStep] = useState('1');
  const [reason, setReason] = useState('switching_competitor');
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingSendIds, setPendingSendIds] = useState<string[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState('');
  const [logFor, setLogFor] = useState<Row | null>(null);
  const [response, setResponse] = useState('');
  const [tool, setTool] = useState('');
  const [saving, setSaving] = useState(false);
  const list = useQuery({
    queryKey: ['dormant-research'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dormant_research_candidates' as any, { _days: 21 });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const preview = useQuery({
    queryKey: ['research-preview', seg, step, reason],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('preview-product-tip', { body: { research: { segment: seg, step: Number(step), cancellationReason: seg === 'C' ? reason : null } } });
      if (error) throw error;
      return data?.email as Row | null;
    },
  });
  const save = async () => {
    if (!logFor || !response.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_log_research_response' as any, { _user_id: logFor.user_id, _response: response.trim().slice(0, 5000), _alternative_tool: tool.trim().slice(0, 200) || null });
    setSaving(false);
    if (error) { toast({ title: 'Could not save the reply', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Reply logged', description: 'No more research emails will go to this person.' });
    setLogFor(null); setResponse(''); setTool('');
    qc.invalidateQueries({ queryKey: ['dormant-research'] });
  };
  const eligibleRows = (list.data ?? []).filter((r) => nextEligibleStep(r) === Number(step));
  const openSend = (ids: string[]) => {
    setPendingSendIds(ids);
    setSendOpen(true);
  };
  const sendResearch = async () => {
    if (!pendingSendIds.length) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-dormant-research', {
      body: { step: Number(step), userIds: pendingSendIds },
    });
    setSending(false);
    setSendOpen(false);
    if (error) {
      toast({ title: 'Could not send research email', description: error.message, variant: 'destructive' });
      return;
    }
    const result = data as { sent: number; suppressed: number; failed: number; results: { reason?: string }[] };
    const reasons = [...new Set((result.results ?? []).map((item) => item.reason).filter(Boolean))];
    const reasonText = reasons.includes('test_mode_not_allowlisted')
      ? ' Test mode is on; recipients not on the approved test list were not emailed.'
      : reasons.length ? ` Some recipients were held: ${reasons.map((item) => String(item).replace(/_/g, ' ')).join(', ')}.` : '';
    setSendFeedback(`Email ${step}: ${result.sent} sent, ${result.suppressed} held, ${result.failed} failed.${reasonText}`);
    toast({
      title: result.sent ? 'Research send complete' : 'No research emails were sent',
      description: `${result.sent} sent · ${result.suppressed} held · ${result.failed} failed.${reasonText}`,
      variant: result.failed ? 'destructive' : 'default',
    });
    setSelected([]);
    setPendingSendIds([]);
    qc.invalidateQueries({ queryKey: ['dormant-research'] });
  };
  return <div className="space-y-4">
    <Card><CardHeader><CardTitle>Dormant user research</CardTitle>
      <CardDescription>People with no meaningful activity for 21+ days. Emails come from Yinka and replies go to yinka@invoicemonk.com. “Log response” records a reply received outside the app and stops the sequence; it does not send an email.</CardDescription></CardHeader>
      <CardContent className="space-y-3">{list.error ? <p className="text-sm text-destructive">Could not load dormant users.</p> : <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Send step</span>
          <Select value={step} onValueChange={(value) => { setStep(value); setSelected([]); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{['1', '2', '3'].map((s) => <SelectItem key={s} value={s}>Email {s}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" disabled={!eligibleRows.length} onClick={() => setSelected(eligibleRows.map((r) => r.user_id))}>Select eligible ({eligibleRows.length})</Button>
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <Button size="sm" disabled={!selected.length} onClick={() => openSend(selected)}>Send selected</Button>
        </div>
        <p className="text-xs text-muted-foreground">Every send is checked against the current sequence step, reply status, opt-outs, duplicates, delivery cap, and test-mode allowlist. Blocked sends are reported here.</p>
        {sendFeedback && <p role="status" className="text-sm">{sendFeedback}</p>}
        <div className="overflow-x-auto">
        <Table><TableHeader><TableRow><TableHead className="w-10"><span className="sr-only">Select</span></TableHead><TableHead>User</TableHead><TableHead>Last active</TableHead><TableHead>Segment</TableHead><TableHead>Known cancellation reason</TableHead><TableHead>Research status</TableHead><TableHead>Response</TableHead><TableHead>Alternative tool</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{(list.data ?? []).length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{list.isLoading ? 'Loading…' : 'No dormant users.'}</TableCell></TableRow> :
            (list.data ?? []).map((r) => <TableRow key={r.user_id}>
              <TableCell><Checkbox aria-label={`Select ${r.full_name || r.email}`} checked={selected.includes(r.user_id)} disabled={nextEligibleStep(r) !== Number(step)} onCheckedChange={(checked) => setSelected((current) => checked ? [...new Set([...current, r.user_id])] : current.filter((id) => id !== r.user_id))} /></TableCell>
              <TableCell><div>{r.full_name || '—'}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
              <TableCell>{new Date(r.last_active_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant="outline">{r.segment}</Badge> <span className="text-xs">{SEGMENTS[r.segment]}</span></TableCell>
              <TableCell className="text-xs">{[r.cancellation_reason?.replace(/_/g, ' '), r.cancellation_details].filter(Boolean).join(' — ') || '—'}</TableCell>
              <TableCell className="text-xs">{status(r)}{r.last_research_at ? ` · ${new Date(r.last_research_at).toLocaleDateString()}` : ''}</TableCell>
              <TableCell className="max-w-xs text-xs">{r.response ?? '—'}</TableCell>
              <TableCell className="text-xs">{r.alternative_tool ?? '—'}</TableCell>
              <TableCell><div className="flex flex-wrap gap-2">{nextEligibleStep(r) === Number(step) && <Button size="sm" onClick={() => openSend([r.user_id])}>Send email {step}</Button>}{r.segment !== 'D' && r.segment !== 'E' && !r.responded_at && <Button size="sm" variant="outline" onClick={() => setLogFor(r)}>Log response</Button>}</div></TableCell>
            </TableRow>)}</TableBody></Table>
        </div>
        </>}
      </CardContent></Card>

    <Card><CardHeader><CardTitle>Research email previews</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={seg} onValueChange={setSeg}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['A', 'B', 'C'].map((s) => <SelectItem key={s} value={s}>{s} · {SEGMENTS[s]}</SelectItem>)}</SelectContent></Select>
          {seg === 'C' && <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['too_expensive', 'missing_features', 'not_using_enough', 'switching_competitor', 'business_changed'].map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>}
        </div>
        {preview.data && <EmailFrame title="Research email preview" html={preview.data.html} text={preview.data.text} subject={preview.data.subject} />}
      </CardContent></Card>

    <Dialog open={!!logFor} onOpenChange={(o) => !o && setLogFor(null)}>
      <DialogContent><DialogHeader><DialogTitle>Log reply from {logFor?.full_name || logFor?.email}</DialogTitle><DialogDescription>This saves a reply received outside Invoicemonk and stops the remaining research emails. It does not send an email.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Textarea placeholder="Paste their reply" value={response} maxLength={5000} onChange={(e) => setResponse(e.target.value)} rows={6} />
          <Input placeholder="Other tool they mentioned (optional)" value={tool} maxLength={200} onChange={(e) => setTool(e.target.value)} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving || !response.trim()}>{saving ? 'Saving…' : 'Save reply'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={sendOpen} onOpenChange={(open) => !sending && setSendOpen(open)}>
      <DialogContent><DialogHeader><DialogTitle>Send Email {step} to {pendingSendIds.length} {pendingSendIds.length === 1 ? 'person' : 'people'}?</DialogTitle><DialogDescription>The server will recheck each recipient’s next sequence step and current safety settings. Test mode, opt-outs, duplicate/cooldown checks, and the delivery cap can hold individual messages; held messages will not be sent.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>Cancel</Button><Button onClick={sendResearch} disabled={sending}>{sending ? 'Checking and sending…' : `Confirm Email ${step}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
