import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = Record<string, any>;
const pretty = (s?: string | null) => (s ?? '').split('.').pop()!.replace(/_/g, ' ');

async function invoke(body: Row) {
  const { data, error } = await supabase.functions.invoke('preview-product-tip', { body });
  if (error) throw error;
  return data as Row;
}

export function EmailFrame({ html, text, subject, title }: { html?: string; text?: string; subject?: string; title: string }) {
  return <div className="space-y-2">
    <p className="text-sm"><span className="font-medium">Subject:</span> {subject}</p>
    <iframe title={title} srcDoc={html ?? ''} sandbox="" className="h-[520px] w-full rounded-md border bg-card" />
    <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Plain-text version</summary>
      <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">{text}</pre></details>
  </div>;
}

function ResultSummary({ result }: { result: Row }) {
  if (result.status === 'outcome_completed') return <p className="text-sm text-muted-foreground">No email — the outcome for this job was already reached.</p>;
  if (result.status === 'insufficient_journey_context') return <p className="text-sm"><Badge variant="outline" className="mr-2">insufficient journey context</Badge>No email. {result.detail}</p>;
  const e = result.email;
  return <div className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-2">
    <p><span className="font-medium">Job:</span> {e.jobLabel}</p>
    <p><span className="font-medium">Last meaningful action:</span> {pretty(e.lastAction)}</p>
    <p><span className="font-medium">Observed:</span> {(e.evidence as string[]).map(pretty).join(' → ')}</p>
    <p><span className="font-medium">Next step:</span> {e.nextAction}</p>
    <p className="md:col-span-2"><span className="font-medium">Stated intent</span> <Badge variant="outline">what they told us</Badge> {e.statedIntent ?? 'None used'}</p>
  </div>;
}

export function JourneyEmails() {
  const [sample, setSample] = useState('0');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookup, setLookup] = useState('');
  const [journeyIdx, setJourneyIdx] = useState('0');
  const samples = useQuery({ queryKey: ['tip-samples'], queryFn: () => invoke({ samples: true }) });
  const user = useQuery({ queryKey: ['tip-user', lookup], enabled: !!lookup, queryFn: () => invoke({ email: lookup }) });
  const s = samples.data?.samples?.[Number(sample)];
  const j = user.data?.journeys?.[Number(journeyIdx)];
  const active = lookup ? j : s;
  return <Card>
    <CardHeader>
      <CardTitle>Product abandonment emails</CardTitle>
      <CardDescription>Written per user job from the recorded actions. When the record can't support a truthful message, no email is sent. Sending stays off and test-mode safeguards stay on.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={sample} onValueChange={(v) => { setSample(v); setLookup(''); }}>
          <SelectTrigger><SelectValue placeholder="Sample journey" /></SelectTrigger>
          <SelectContent>{(samples.data?.samples ?? []).map((x: Row) => <SelectItem key={x.index} value={String(x.index)}>{x.label}</SelectItem>)}</SelectContent>
        </Select>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setLookup(lookupEmail.trim()); setJourneyIdx('0'); }}>
          <Input type="email" placeholder="Or look up a user's recorded journeys" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} />
          <Button type="submit" disabled={user.isFetching}>Look up</Button>
        </form>
      </div>
      {lookup && user.data && <>
        <p className="text-sm"><span className="font-medium">Stated intent</span> <Badge variant="outline">what they told us</Badge> {user.data.statedIntent ? `${pretty(user.data.statedIntent.intent)}${user.data.statedIntent.text ? ` — "${user.data.statedIntent.text}"` : ''}` : 'None given'}</p>
        {user.data.journeys?.length ? <Table><TableHeader><TableRow><TableHead>Area</TableHead><TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead>Stopped at</TableHead><TableHead>Email decision</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{user.data.journeys.map((x: Row, i: number) => <TableRow key={x.journey.id}>
            <TableCell>{pretty(x.journey.product_area)}</TableCell><TableCell>{x.job?.label ?? <Badge variant="outline">unknown job</Badge>}</TableCell>
            <TableCell>{x.journey.status}</TableCell><TableCell>{pretty(x.journey.stopped_step)}</TableCell>
            <TableCell>{x.result.status.replace(/_/g, ' ')}</TableCell>
            <TableCell><Button size="sm" variant={String(i) === journeyIdx ? 'default' : 'outline'} onClick={() => setJourneyIdx(String(i))}>View</Button></TableCell>
          </TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">No journeys recorded for this user.</p>}
      </>}
      {(samples.error || user.error) && <p className="text-sm text-destructive">The secure email preview could not be loaded.</p>}
      {active && <ResultSummary result={active.result} />}
      {active?.result?.status === 'email' && <EmailFrame title="Product email preview" html={active.result.email.html} text={active.result.email.text} subject={active.result.email.subject} />}
    </CardContent>
  </Card>;
}

export function InsufficientContextQueue() {
  const q = useQuery({
    queryKey: ['insufficient-context'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lifecycle_email_deliveries').select('id, user_id, recipient_email, product_area, metadata, created_at')
        .eq('suppression_reason', 'insufficient_journey_context').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  return <Card><CardHeader><CardTitle>Needs review: insufficient journey context</CardTitle>
    <CardDescription>Abandoned journeys where no truthful email could be written, so none was sent.</CardDescription></CardHeader>
    <CardContent>{q.error ? <p className="text-sm text-destructive">Could not load the review queue.</p> :
      <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Area</TableHead><TableHead>Workflow</TableHead><TableHead>Why</TableHead><TableHead>Logged</TableHead></TableRow></TableHeader>
        <TableBody>{(q.data ?? []).length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nothing to review yet.</TableCell></TableRow> :
          (q.data ?? []).map((r: Row) => <TableRow key={r.id}><TableCell>{r.recipient_email}</TableCell><TableCell>{pretty(r.product_area)}</TableCell><TableCell>{pretty(r.metadata?.workflow)}</TableCell><TableCell>{r.metadata?.detail}</TableCell><TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table>}
    </CardContent></Card>;
}
