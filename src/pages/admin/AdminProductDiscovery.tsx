import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_REGISTRY, INTENT_OPTIONS } from '@/lib/product-registry';
import { PRODUCT_EMAIL_COPY, productEmailSubject, productEmailHtml, productEmailBodyText } from '@/lib/product-email-draft';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LOW_VOLUME = 5;
type Row = Record<string, any>;
type Overview = { overview: Row; areas: Row[]; workflows: Row[]; intents: Row[]; funnel: Row[]; feedback: Row[] };
const label = (a: string) => PRODUCT_REGISTRY.find((p) => p.area === a)?.label ?? a.replace(/_/g, ' ');
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const ALL = '__all';

function Low({ n }: { n: number }) {
  return n < LOW_VOLUME ? <Badge variant="outline" className="ml-2">low volume</Badge> : null;
}

export default function AdminProductDiscovery() {
  const [days, setDays] = useState('30');
  const [area, setArea] = useState(ALL);
  const [intent, setIntent] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [businessId, setBusinessId] = useState('');
  const [workflow, setWorkflow] = useState('');
  const validBiz = /^[0-9a-f-]{36}$/i.test(businessId.trim()) ? businessId.trim() : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-product-discovery', days, area, intent, status, validBiz, workflow],
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('admin_product_discovery_overview' as any, {
        _days: Number(days), _business_id: validBiz, _area: area === ALL ? null : area,
        _workflow: workflow.trim() || null, _intent: intent === ALL ? null : intent, _status: status === ALL ? null : status,
      });
      if (error) throw error;
      return result as unknown as Overview;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Product Discovery</h1>
        <p className="mt-1 text-muted-foreground">Activation, stated intent, abandonment and feedback. Stated intent is what users told us; observed is what they did.</p>
      </div>
      <Card><CardContent className="grid gap-3 pt-6 md:grid-cols-6">
        <Select value={days} onValueChange={setDays}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['7','30','90','365'].map((d)=><SelectItem key={d} value={d}>Last {d} days</SelectItem>)}</SelectContent></Select>
        <Select value={area} onValueChange={setArea}><SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All products</SelectItem>{PRODUCT_REGISTRY.map((p)=><SelectItem key={p.area} value={p.area}>{p.label}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Workflow" value={workflow} onChange={(e)=>setWorkflow(e.target.value)} />
        <Select value={intent} onValueChange={setIntent}><SelectTrigger><SelectValue placeholder="Intent" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All intents</SelectItem>{INTENT_OPTIONS.map((i)=><SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{['started','activated','outcome','repeat','inactive','abandoned'].map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Business ID" value={businessId} onChange={(e)=>setBusinessId(e.target.value)} />
      </CardContent></Card>

      {isLoading ? <Skeleton className="h-96 w-full" /> : error ? <p className="text-sm text-destructive">Product discovery data could not be loaded.</p> : data && (
        <Tabs defaultValue="overview">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {[['overview','Overview'],['activation','Activation by product'],['intent','Intent vs behavior'],['funnel','Funnel by intent'],['abandonment','Abandonment'],['feedback','Feedback & alternatives'],['timeline','User timeline'],['email','Email draft']].map(([v,l])=><TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="overview"><OverviewCards o={data.overview} /></TabsContent>
          <TabsContent value="activation"><AreaTable rows={data.areas} /></TabsContent>
          <TabsContent value="intent"><IntentTable data={data} /></TabsContent>
          <TabsContent value="funnel"><FunnelTable rows={data.funnel} /></TabsContent>
          <TabsContent value="abandonment"><AbandonTable rows={data.workflows} /></TabsContent>
          <TabsContent value="feedback"><FeedbackTable rows={data.feedback} /></TabsContent>
          <TabsContent value="timeline"><Timeline /></TabsContent>
          <TabsContent value="email"><EmailDraft /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function OverviewCards({ o }: { o: Row }) {
  const items = [['Users', o.users], ['Journeys', o.journeys], ['Activated', o.activated], ['Outcomes', o.outcomes], ['Repeat use', o.repeat], ['Inactive', o.inactive], ['Abandoned', o.abandoned], ['Reactivated', o.reactivated]];
  return <div className="space-y-3">
    {o.journeys < LOW_VOLUME && <p className="text-sm text-muted-foreground">Not enough activity yet for reliable conclusions.</p>}
    <div className="grid gap-4 md:grid-cols-4">{items.map(([l, v]) => <Card key={l}><CardHeader className="pb-2"><CardDescription>{l}</CardDescription><CardTitle>{v ?? 0}</CardTitle></CardHeader></Card>)}</div>
  </div>;
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return <TableRow><TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">{text}</TableCell></TableRow>;
}

function AreaTable({ rows }: { rows: Row[] }) {
  return <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Started</TableHead><TableHead>Activated</TableHead><TableHead>Outcome</TableHead><TableHead>Repeat</TableHead><TableHead>Activation rate</TableHead></TableRow></TableHeader><TableBody>
    {rows.map((r) => <TableRow key={r.product_area}><TableCell>{label(r.product_area)}<Low n={r.journeys} /></TableCell><TableCell>{r.journeys}</TableCell><TableCell>{r.activated}</TableCell><TableCell>{r.outcomes}</TableCell><TableCell>{r.repeats}</TableCell><TableCell>{pct(r.activated, r.journeys)}</TableCell></TableRow>)}
    {!rows.length && <Empty cols={6} text="Not enough product activity yet" />}
  </TableBody></Table></CardContent></Card>;
}

function IntentTable({ data }: { data: Overview }) {
  return <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Stated intent</TableHead><TableHead>Users (stated)</TableHead><TableHead>Primary</TableHead><TableHead>Matching products used (observed)</TableHead></TableRow></TableHeader><TableBody>
    {data.intents.map((r) => {
      const areas = INTENT_OPTIONS.find((i) => i.key === r.intent)?.areas ?? [];
      const observed = new Set(data.funnel.filter((f) => f.intent === r.intent && (areas as string[]).includes(f.product_area) && f.activated > 0).map((f) => f.product_area));
      return <TableRow key={r.intent}><TableCell>{INTENT_OPTIONS.find((i) => i.key === r.intent)?.label ?? r.intent}<Low n={r.users} /></TableCell><TableCell>{r.users}</TableCell><TableCell>{r.primary_users}</TableCell><TableCell>{observed.size ? [...observed].map(label).join(', ') : '–'}</TableCell></TableRow>;
    })}
    {!data.intents.length && <Empty cols={4} text="No stated intent data yet" />}
  </TableBody></Table></CardContent></Card>;
}

function FunnelTable({ rows }: { rows: Row[] }) {
  const mapped = rows.filter((r) => (INTENT_OPTIONS.find((i) => i.key === r.intent)?.areas as string[] | undefined)?.includes(r.product_area));
  return <Card><CardHeader><CardDescription>Users who stated an intent, followed through the products that match it.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Intent</TableHead><TableHead>Product</TableHead><TableHead>Started</TableHead><TableHead>Activated</TableHead><TableHead>Outcome</TableHead></TableRow></TableHeader><TableBody>
    {mapped.map((r) => <TableRow key={r.intent + r.product_area}><TableCell>{r.intent.replace(/_/g, ' ')}</TableCell><TableCell>{label(r.product_area)}<Low n={r.started} /></TableCell><TableCell>{r.started}</TableCell><TableCell>{r.activated} ({pct(r.activated, r.started)})</TableCell><TableCell>{r.outcomes} ({pct(r.outcomes, r.started)})</TableCell></TableRow>)}
    {!mapped.length && <Empty cols={5} text="No intent-matched journeys yet" />}
  </TableBody></Table></CardContent></Card>;
}

function AbandonTable({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => b.abandoned - a.abandoned);
  return <Card><CardContent className="pt-6"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Workflow</TableHead><TableHead>Journeys</TableHead><TableHead>Abandoned</TableHead><TableHead>Most common last step</TableHead></TableRow></TableHeader><TableBody>
    {sorted.map((r) => <TableRow key={r.product_area + r.workflow}><TableCell>{label(r.product_area)}</TableCell><TableCell>{r.workflow ?? '–'}</TableCell><TableCell>{r.journeys}<Low n={r.journeys} /></TableCell><TableCell><Badge variant={r.abandoned ? 'destructive' : 'secondary'}>{r.abandoned}</Badge></TableCell><TableCell className="text-xs">{r.common_stop ?? '–'}</TableCell></TableRow>)}
    {!rows.length && <Empty cols={5} text="No journeys yet" />}
  </TableBody></Table></CardContent></Card>;
}

function FeedbackTable({ rows }: { rows: Row[] }) {
  return <Card><CardHeader><CardDescription>Individual answers are in <Link className="text-primary underline" to="/admin/feedback">Admin Feedback → Product feedback</Link>.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Responses</TableHead><TableHead>Dismissed</TableHead><TableHead>Alternatives named</TableHead></TableRow></TableHeader><TableBody>
    {rows.map((r) => <TableRow key={r.product_area}><TableCell>{label(r.product_area)}</TableCell><TableCell>{r.responses}</TableCell><TableCell>{r.dismissed}</TableCell><TableCell>{(r.tools ?? []).join(', ') || '–'}</TableCell></TableRow>)}
    {!rows.length && <Empty cols={4} text="No contextual feedback yet" />}
  </TableBody></Table></CardContent></Card>;
}

function Timeline() {
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['admin-user-timeline', query], enabled: !!query,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_user_product_timeline' as any, { _email: query });
      if (error) throw error;
      return data as any;
    },
  });
  const stated: Row[] = data?.stated ?? [];
  const observed: Row[] = data?.observed ?? [];
  const statedAreas = new Set(stated.flatMap((s) => (INTENT_OPTIONS.find((i) => i.key === s.intent)?.areas ?? []) as string[]));
  const inferred = [...new Set(observed.filter((o) => o.activated_at && !statedAreas.has(o.product_area)).map((o) => o.product_area))];
  return <Card><CardHeader><CardTitle>Individual user timeline</CardTitle>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(email.trim()); }}><Input placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} /><Button type="submit" disabled={isFetching}>Look up</Button></form>
  </CardHeader><CardContent className="space-y-4">
    {query && !isFetching && data === null && <p className="text-sm text-muted-foreground">No user found for that email.</p>}
    {data && <>
      <section><h3 className="font-medium">Stated intent <Badge variant="outline">what they told us</Badge></h3><p className="text-sm">{stated.length ? stated.map((s) => `${s.intent.replace(/_/g, ' ')}${s.is_primary ? ' (primary)' : ''}`).join(', ') : 'None given'}{stated.find((s) => s.free_text) ? ` — "${stated.find((s) => s.free_text)!.free_text}"` : ''}</p></section>
      <section><h3 className="font-medium">Observed journeys <Badge variant="outline">what they did</Badge></h3><p className="text-sm">{observed.length ? observed.map((o) => `${label(o.product_area)}${o.workflow ? ` / ${o.workflow}` : ''}: ${o.status}`).join(' · ') : 'No product activity'}</p></section>
      <section><h3 className="font-medium">Inferred interest <Badge variant="outline">our guess, not stated</Badge></h3><p className="text-sm">{inferred.length ? inferred.map(label).join(', ') : 'Nothing beyond stated intent'}</p></section>
      <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Event</TableHead><TableHead>Stage</TableHead><TableHead>Source</TableHead></TableRow></TableHeader><TableBody>
        {(data.events as Row[]).map((e, i) => <TableRow key={i}><TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell><TableCell className="text-xs">{e.event_type}</TableCell><TableCell>{e.stage}</TableCell><TableCell>{e.source}</TableCell></TableRow>)}
        {!data.events.length && <Empty cols={4} text="No product events" />}
      </TableBody></Table>
    </>}
  </CardContent></Card>;
}

function EmailDraft() {
  const areas = PRODUCT_REGISTRY.filter((p) => p.area !== 'discovery');
  const [area, setArea] = useState<string>(areas[0]?.area ?? 'invoicing');
  const [withIntent, setWithIntent] = useState(false);
  const sampleIntent = INTENT_OPTIONS[0]?.key ?? 'get_paid_faster';
  const copy = PRODUCT_EMAIL_COPY[area];
  return <Card>
    <CardHeader>
      <CardTitle>Product tip email — draft</CardTitle>
      <CardDescription>
        What an abandoned-journey recipient would receive. Currently switched off: nothing sends until the campaign is enabled, and even then only in test mode to allowlisted recipients — one email per person per product, opt-out via Settings → Notifications.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
          <SelectContent>{areas.map((p) => <SelectItem key={p.area} value={p.area}>{p.label}{copy ? '' : ' (generic wording)'}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={withIntent ? 'yes' : 'no'} onValueChange={(v) => setWithIntent(v === 'yes')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="no">Without a stated goal</SelectItem>
            <SelectItem value="yes">With a stated goal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!copy && <p className="text-sm text-muted-foreground">This product has no specific copy yet, so it falls back to the generic wording.</p>}
      <div>
        <p className="text-sm"><span className="font-medium">Subject:</span> {productEmailSubject(area)}</p>
        <p className="text-xs text-muted-foreground">Sample recipient: Ada{withIntent ? `, stated goal "${sampleIntent.replace(/_/g, ' ')}"` : ''}</p>
      </div>
      <div className="rounded-md border bg-muted/30 p-3">
        <iframe
          title="Product tip email preview"
          srcDoc={productEmailHtml(area, { name: 'Ada', statedIntent: withIntent ? sampleIntent : null })}
          sandbox=""
          className="h-[560px] w-full rounded-md border bg-white"
        />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Plain-text version</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">{productEmailBodyText(area, { name: 'Ada', statedIntent: withIntent ? sampleIntent : null })}</pre>
      </details>
    </CardContent>
  </Card>;
}
