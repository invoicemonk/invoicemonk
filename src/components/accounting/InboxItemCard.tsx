import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, FileText, AlertTriangle, Check, X, Trash2, Sparkles, Store } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VendorPicker } from '@/components/vendors/VendorPicker';
import {
  type InboxItem,
  type InboxExtraction,
  useApproveInboxItem,
  useRejectInboxItem,
  useDeleteInboxItem,
  useInboxThumbnailUrl,
} from '@/hooks/use-expense-inbox';
import { EXPENSE_CATEGORIES } from '@/hooks/use-expenses';

interface Props {
  item: InboxItem;
  defaultCurrency?: string | null;
  currencyAccountId?: string | null;
  selected?: boolean;
  onToggleSelect?: (id: string, next: boolean) => void;
}

function ConfidenceBadge({ confidence, handwritten }: { confidence: number | null; handwritten: boolean }) {
  if (handwritten) {
    return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">Handwritten</Badge>;
  }
  if (confidence === null) return null;
  if (confidence >= 0.8) return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">High confidence</Badge>;
  if (confidence >= 0.5) return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">Medium confidence</Badge>;
  return <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">Low confidence</Badge>;
}

export function InboxItemCard({ item, defaultCurrency, currencyAccountId, selected, onToggleSelect }: Props) {
  const ext = item.extracted_data ?? {};
  const [vendorName, setVendorName] = useState(ext.vendor_name ?? '');
  const [vendorId, setVendorId] = useState<string | null>(ext.matched_vendor_id ?? null);
  const [createVendor, setCreateVendor] = useState<boolean>(!ext.matched_vendor_id);
  const [amount, setAmount] = useState<string>(ext.total_amount?.toString() ?? '');
  const [currency, setCurrency] = useState(ext.currency ?? defaultCurrency ?? '');
  const [date, setDate] = useState(ext.date ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(ext.category ?? 'other');

  const { data: thumbUrl } = useInboxThumbnailUrl(item);
  const approve = useApproveInboxItem();
  const reject = useRejectInboxItem();
  const del = useDeleteInboxItem();

  const isScanning = item.status === 'scanning';
  const isFailed = item.status === 'failed';
  const isPending = item.status === 'pending';
  const isApproved = item.status === 'approved';
  const isRejected = item.status === 'rejected';

  const handleApprove = () => {
    const overrides: Partial<InboxExtraction> & { vendor_id?: string | null; create_vendor?: boolean } = {
      vendor_name: vendorName || undefined,
      total_amount: amount ? Number(amount) : undefined,
      currency: currency || undefined,
      date,
      category,
      vendor_id: vendorId,
      create_vendor: !vendorId && createVendor,
    };
    approve.mutate({ item, overrides, currencyAccountId });
  };

  const currencyMismatch = ext.currency && defaultCurrency && ext.currency !== defaultCurrency;
  const autoMatched = !!ext.matched_vendor_id && vendorId === ext.matched_vendor_id;
  const matchScorePct = ext.match_score ? Math.round(ext.match_score * 100) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4 space-y-3 border-border/60 bg-card/50 backdrop-blur">
        <div className="flex gap-4">
          {isPending && onToggleSelect && (
            <div className="pt-1">
              <Checkbox
                checked={!!selected}
                onCheckedChange={(v) => onToggleSelect(item.id, !!v)}
                aria-label="Select for bulk action"
              />
            </div>
          )}

          {/* Thumbnail */}
          <div className="w-24 h-24 shrink-0 rounded-md border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center">
            {thumbUrl && item.file_type?.startsWith('image/') ? (
              <img src={thumbUrl} alt={item.file_name} className="w-full h-full object-cover" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{item.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isScanning && <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Scanning</Badge>}
                {isFailed && <Badge variant="destructive">Scan failed</Badge>}
                {isApproved && <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">Approved</Badge>}
                {isRejected && <Badge variant="outline">Rejected</Badge>}
                {isPending && <ConfidenceBadge confidence={item.confidence} handwritten={item.handwriting_detected} />}
              </div>
            </div>

            {isFailed && (
              <div className="text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="break-words">{item.scan_error || 'Could not extract data from this file.'}</span>
              </div>
            )}

            {(item.handwriting_detected || (item.confidence !== null && item.confidence < 0.5)) && isPending && (
              <div className="text-xs flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Review carefully — extracted values may be inaccurate.</span>
              </div>
            )}
            {currencyMismatch && isPending && (
              <div className="text-xs flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Detected currency {ext.currency} differs from business primary {defaultCurrency}.</span>
              </div>
            )}

            {isPending && (
              <div className="space-y-2">
                {/* Vendor row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Vendor</Label>
                    {autoMatched && (
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] h-5">
                        <Sparkles className="h-3 w-3 mr-1" /> Auto-matched{matchScorePct ? ` · ${matchScorePct}%` : ''}
                      </Badge>
                    )}
                    {!vendorId && vendorName && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        <Store className="h-3 w-3 mr-1" /> New vendor
                      </Badge>
                    )}
                  </div>
                  <VendorPicker
                    value={vendorName}
                    vendorId={vendorId}
                    onChange={({ vendor_id, vendor }) => {
                      setVendorId(vendor_id);
                      setVendorName(vendor);
                      if (vendor_id) setCreateVendor(false);
                    }}
                  />
                  {!vendorId && vendorName && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-0.5">
                      <Checkbox
                        checked={createVendor}
                        onCheckedChange={(v) => setCreateVendor(!!v)}
                      />
                      Create vendor "{vendorName}" on approve
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Currency</Label>
                    <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="h-8 uppercase" />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {ext.tax_amount ? (
                    <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground self-end pb-1">
                      Tax: {ext.tax_amount} {currency} {ext.tax_rate ? `(${ext.tax_rate}%)` : ''}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {isApproved && (
              <div className="text-sm text-muted-foreground">
                Created expense · {ext.vendor_name ?? 'vendor'} · {ext.total_amount} {ext.currency}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
          {(isApproved || isRejected || isFailed) && (
            <Button size="sm" variant="ghost" onClick={() => del.mutate(item)} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
          {isPending && (
            <>
              <Button size="sm" variant="ghost" onClick={() => reject.mutate(item)} disabled={reject.isPending}>
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={approve.isPending}>
                {approve.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Approve & create expense
              </Button>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
