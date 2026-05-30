import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Inbox, Loader2, Image as ImageIcon, Check, X, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  useInboxItems,
  useUploadAndScanInboxItem,
  useBulkApproveInboxItems,
  useRejectInboxItem,
} from '@/hooks/use-expense-inbox';
import { InboxItemCard } from '@/components/accounting/InboxItemCard';
import { cn } from '@/lib/utils';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'failed'] as const;
type Tab = typeof STATUS_TABS[number];

type QueueState = 'uploading' | 'scanning' | 'done' | 'error';
interface QueueItem {
  id: string;
  fileName: string;
  state: QueueState;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ExpenseInbox() {
  const { businessId } = useParams<{ businessId: string }>();
  const { currentBusiness } = useBusiness();
  const [tab, setTab] = useState<Tab>('pending');
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useInboxItems(businessId);
  const upload = useUploadAndScanInboxItem();
  const bulkApprove = useBulkApproveInboxItems();
  const reject = useRejectInboxItem();

  const updateQueueItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  // Auto-collapse queue 5s after all items reach a terminal state
  useEffect(() => {
    if (queue.length === 0) return;
    const allDone = queue.every((q) => q.state === 'done' || q.state === 'error');
    if (!allDone) return;
    const t = setTimeout(() => setQueue([]), 5000);
    return () => clearTimeout(t);
  }, [queue]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!businessId) return;
      const all = Array.from(files);
      const limited = all.slice(0, 20);

      const newQueueItems: QueueItem[] = limited.map((file) => {
        const id = crypto.randomUUID();
        let error: string | undefined;
        if (file.size > MAX_FILE_SIZE) error = 'Exceeds 5MB limit';
        return {
          id,
          fileName: file.name,
          state: error ? 'error' : 'uploading',
          error,
        };
      });
      setQueue((q) => [...newQueueItems, ...q]);

      for (let i = 0; i < limited.length; i++) {
        const file = limited[i];
        const qItem = newQueueItems[i];
        if (qItem.state === 'error') continue;
        try {
          updateQueueItem(qItem.id, { state: 'scanning' });
          await upload.mutateAsync({
            businessId,
            file,
            businessCurrency: currentBusiness?.default_currency,
            businessJurisdiction: currentBusiness?.jurisdiction,
          });
          updateQueueItem(qItem.id, { state: 'done' });
        } catch (err) {
          updateQueueItem(qItem.id, {
            state: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          });
        }
      }
    },
    [businessId, currentBusiness, upload, updateQueueItem]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (tab === 'pending') return it.status === 'pending' || it.status === 'scanning';
        return it.status === tab;
      }),
    [items, tab]
  );

  const counts = {
    pending: items.filter((i) => i.status === 'pending' || i.status === 'scanning').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    failed: items.filter((i) => i.status === 'failed').length,
  };

  // Reset selection when switching tabs or items change
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(filtered.filter((i) => i.status === 'pending').map((i) => i.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [filtered]);

  const toggleSelect = useCallback((id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const selectableItems = useMemo(
    () => filtered.filter((i) => i.status === 'pending'),
    [filtered]
  );
  const allSelected = selectableItems.length > 0 && selectedIds.size === selectableItems.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableItems.map((i) => i.id)));
  };

  const handleBulkApprove = () => {
    const toApprove = selectableItems.filter((i) => selectedIds.has(i.id));
    if (toApprove.length === 0) return;
    bulkApprove.mutate(toApprove, {
      onSettled: () => setSelectedIds(new Set()),
    });
  };

  const handleBulkReject = () => {
    const toReject = selectableItems.filter((i) => selectedIds.has(i.id));
    toReject.forEach((item) => reject.mutate(item));
    setSelectedIds(new Set());
  };

  const queueVisible = queue.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Inbox className="h-7 w-7 text-primary" />
            Expense Inbox
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Drop receipts and supplier bills here — including phone photos of handwritten ones. Each file is scanned by AI and queued for your review before becoming an expense.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'border-2 border-dashed transition-colors p-10 text-center cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
        )}
      >
        <label className="flex flex-col items-center gap-3 cursor-pointer">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="font-medium">Drop files or click to upload</div>
            <div className="text-sm text-muted-foreground mt-1">
              JPG, PNG, WEBP, HEIC, PDF · up to 5MB each · max 20 files at once
            </div>
          </div>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </Card>

      {/* Upload progress queue */}
      <AnimatePresence>
        {queueVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-3 space-y-1.5 bg-card/40">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Uploads ({queue.filter((q) => q.state === 'done').length}/{queue.length})
              </div>
              {queue.map((q) => (
                <div key={q.id} className="flex items-center gap-2 text-sm">
                  {q.state === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                  {q.state === 'scanning' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                  {q.state === 'done' && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  {q.state === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className="truncate flex-1">{q.fileName}</span>
                  <span className={cn(
                    'text-xs shrink-0',
                    q.state === 'error' ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {q.state === 'uploading' && 'Uploading…'}
                    {q.state === 'scanning' && 'Scanning…'}
                    {q.state === 'done' && 'Ready for review'}
                    {q.state === 'error' && (q.error || 'Failed')}
                  </span>
                </div>
              ))}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/50">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2 text-sm capitalize border-b-2 -mb-px transition-colors',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t} <Badge variant="outline" className="ml-1">{counts[t]}</Badge>
          </button>
        ))}
      </div>

      {/* Selection bar */}
      {tab === 'pending' && selectableItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-card/40 px-3 py-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={allSelected}
              onChange={toggleSelectAll}
            />
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `Select all (${selectableItems.length})`}
          </label>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs text-muted-foreground">
                Bulk approve uses scanned values as-is
              </span>
              <Button size="sm" variant="ghost" onClick={handleBulkReject} disabled={reject.isPending}>
                <X className="h-4 w-4 mr-1" /> Reject selected
              </Button>
              <Button size="sm" onClick={handleBulkApprove} disabled={bulkApprove.isPending}>
                {bulkApprove.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Approve {selectedIds.size}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inbox…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No {tab} items.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <InboxItemCard
              key={item.id}
              item={item}
              defaultCurrency={currentBusiness?.default_currency}
              selected={selectedIds.has(item.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
