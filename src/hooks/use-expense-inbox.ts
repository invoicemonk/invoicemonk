import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';
import { findVendorMatch, type VendorLike } from '@/lib/vendor-matching';
import { findOrCreateVendor, type Vendor } from '@/hooks/use-vendors';

export type InboxStatus = 'pending' | 'scanning' | 'failed' | 'approved' | 'rejected';

export interface InboxExtraction {
  vendor_name?: string;
  date?: string;
  total_amount?: number;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  currency?: string;
  category?: string;
  description?: string;
  handwritten?: boolean;
  confidence?: number;
  currency_mismatch?: boolean;
  business_currency?: string | null;
  matched_vendor_id?: string | null;
  matched_vendor_name?: string | null;
  match_score?: number | null;
}

export interface InboxItem {
  id: string;
  business_id: string;
  user_id: string;
  status: InboxStatus;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  extracted_data: InboxExtraction | null;
  confidence: number | null;
  handwriting_detected: boolean;
  scan_error: string | null;
  approved_expense_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'application/pdf',
];

export function useInboxItems(businessId?: string) {
  return useQuery({
    queryKey: ['expense-inbox', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('expense_inbox_items')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as InboxItem[];
    },
    enabled: !!businessId,
  });
}

interface UploadArgs {
  businessId: string;
  file: File;
  businessCurrency?: string | null;
  businessJurisdiction?: string | null;
}

export function useUploadAndScanInboxItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ businessId, file, businessCurrency, businessJurisdiction }: UploadArgs) => {
      if (!user) throw new Error('Not authenticated');
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`${file.name}: unsupported file type`);
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`${file.name}: exceeds 5MB limit`);
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const objectId = crypto.randomUUID();
      const storagePath = `${businessId}/${objectId}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('expense-inbox')
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: row, error: insertErr } = await supabase
        .from('expense_inbox_items')
        .insert({
          business_id: businessId,
          user_id: user.id,
          status: 'scanning',
          storage_path: storagePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      try {
        const { data: scan, error: scanErr } = await supabase.functions.invoke('scan-receipt', {
          body: {
            storage_path: storagePath,
            bucket: 'expense-inbox',
            business_currency: businessCurrency ?? undefined,
            business_jurisdiction: businessJurisdiction ?? undefined,
          },
        });
        if (scanErr) throw scanErr;
        if (scan?.error) throw new Error(scan.error);

        const handwritten = !!scan?.handwritten;
        const confidence = typeof scan?.confidence === 'number' ? scan.confidence : null;

        // Fuzzy-match vendor against existing vendors
        let matched: { id: string; name: string } | null = null;
        let matchScore: number | null = null;
        try {
          const cached = queryClient.getQueryData<VendorLike[]>(['vendors', businessId]);
          let vendors: VendorLike[] | null = cached ?? null;
          if (!vendors) {
            const { data: vRows } = await supabase
              .from('vendors')
              .select('id,name')
              .eq('business_id', businessId);
            vendors = (vRows ?? []) as VendorLike[];
          }
          const match = findVendorMatch(scan?.vendor_name, vendors);
          if (match) {
            matched = { id: match.vendor.id, name: match.vendor.name };
            matchScore = match.score;
          }
        } catch {
          // best-effort; ignore matching failures
        }

        const extracted = {
          ...(scan ?? {}),
          matched_vendor_id: matched?.id ?? null,
          matched_vendor_name: matched?.name ?? null,
          match_score: matchScore,
        };

        const { data: updated, error: updateErr } = await supabase
          .from('expense_inbox_items')
          .update({
            status: 'pending',
            extracted_data: extracted,
            confidence,
            handwriting_detected: handwritten,
            scan_error: null,
          })
          .eq('id', row.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        return updated as InboxItem;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scan failed';
        await supabase
          .from('expense_inbox_items')
          .update({ status: 'failed', scan_error: message })
          .eq('id', row.id);
        throw err;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expense-inbox', vars.businessId] });
    },
    onError: (err: Error, vars) => {
      captureError(err, { hook: 'useUploadAndScanInboxItem', businessId: vars.businessId });
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: ['expense-inbox', vars.businessId] });
    },
  });
}

interface ApproveArgs {
  item: InboxItem;
  overrides?: Partial<InboxExtraction> & { vendor_id?: string | null; create_vendor?: boolean };
  currencyAccountId?: string | null;
}

async function approveInboxItemCore(
  args: ApproveArgs & { userId: string }
): Promise<{ expenseId: string; vendor?: Vendor }> {
  const { item, overrides, currencyAccountId, userId } = args;
  const data = { ...(item.extracted_data ?? {}), ...(overrides ?? {}) } as InboxExtraction & {
    vendor_id?: string | null;
    create_vendor?: boolean;
  };

  if (!data.total_amount || data.total_amount <= 0) {
    throw new Error('Amount is required');
  }
  if (!data.category) data.category = 'other';
  if (!data.currency) {
    throw new Error('Currency is required');
  }

  // Resolve vendor: explicit id > pre-matched id > create-on-approve
  let vendorId: string | null =
    (overrides as { vendor_id?: string | null } | undefined)?.vendor_id ??
    (item.extracted_data?.matched_vendor_id ?? null);
  let createdVendor: Vendor | undefined;

  const shouldCreate =
    !vendorId &&
    (overrides?.create_vendor ?? true) &&
    !!data.vendor_name &&
    data.vendor_name.trim().length > 0;

  if (shouldCreate) {
    try {
      createdVendor = await findOrCreateVendor(item.business_id, data.vendor_name!.trim(), userId);
      vendorId = createdVendor.id;
    } catch {
      // Non-fatal: still create the expense with the vendor text snapshot
      vendorId = null;
    }
  }

  const { data: signed } = await supabase.storage
    .from('expense-inbox')
    .createSignedUrl(item.storage_path, 60 * 60 * 24 * 365);

  const { data: expense, error: expErr } = await supabase
    .from('expenses')
    .insert({
      user_id: userId,
      business_id: item.business_id,
      category: data.category,
      description: data.description ?? null,
      amount: data.total_amount,
      tax_amount: data.tax_amount ?? 0,
      tax_rate: data.tax_rate ?? null,
      currency: data.currency,
      expense_date: data.date ?? new Date().toISOString().slice(0, 10),
      vendor: data.vendor_name ?? null,
      vendor_id: vendorId,
      currency_account_id: currencyAccountId ?? null,
      receipt_url: signed?.signedUrl ?? null,
      notes: `Approved from Inbox · file: ${item.file_name}`,
    })
    .select()
    .single();
  if (expErr) throw expErr;

  const { error: updErr } = await supabase
    .from('expense_inbox_items')
    .update({
      status: 'approved',
      approved_expense_id: expense.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      extracted_data: { ...data, matched_vendor_id: vendorId ?? data.matched_vendor_id ?? null } as never,
    })
    .eq('id', item.id);
  if (updErr) throw updErr;

  return { expenseId: expense.id, vendor: createdVendor };
}

export function useApproveInboxItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (args: ApproveArgs) => {
      if (!user) throw new Error('Not authenticated');
      return approveInboxItemCore({ ...args, userId: user.id });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['expense-inbox', vars.item.business_id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: 'Expense created', description: 'Inbox item approved.' });
    },
    onError: (err: Error) => {
      captureError(err, { hook: 'useApproveInboxItem' });
      toast({ title: 'Approval failed', description: err.message, variant: 'destructive' });
    },
  });
}

export interface BulkApproveResult {
  ok: number;
  failed: Array<{ id: string; fileName: string; error: string }>;
}

export function useBulkApproveInboxItems() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (items: InboxItem[]): Promise<BulkApproveResult> => {
      if (!user) throw new Error('Not authenticated');
      const result: BulkApproveResult = { ok: 0, failed: [] };
      for (const item of items) {
        try {
          await approveInboxItemCore({ item, userId: user.id });
          result.ok += 1;
        } catch (err) {
          result.failed.push({
            id: item.id,
            fileName: item.file_name,
            error: err instanceof Error ? err.message : 'Approval failed',
          });
        }
      }
      return result;
    },
    onSuccess: (res, items) => {
      const businessId = items[0]?.business_id;
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ['expense-inbox', businessId] });
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      if (res.failed.length === 0) {
        toast({ title: `${res.ok} expense${res.ok === 1 ? '' : 's'} created` });
      } else {
        toast({
          title: `${res.ok} approved · ${res.failed.length} failed`,
          description: res.failed.slice(0, 3).map((f) => `${f.fileName}: ${f.error}`).join('\n'),
          variant: res.ok === 0 ? 'destructive' : 'default',
        });
      }
    },
    onError: (err: Error) => {
      captureError(err, { hook: 'useBulkApproveInboxItems' });
      toast({ title: 'Bulk approval failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useRejectInboxItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: InboxItem) => {
      if (!user) throw new Error('Not authenticated');
      await supabase.storage.from('expense-inbox').remove([item.storage_path]);
      const { error } = await supabase
        .from('expense_inbox_items')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ['expense-inbox', item.business_id] });
    },
    onError: (err: Error) => {
      toast({ title: 'Reject failed', description: err.message, variant: 'destructive' });
    },
  });
}

export function useDeleteInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: InboxItem) => {
      await supabase.storage.from('expense-inbox').remove([item.storage_path]);
      const { error } = await supabase.from('expense_inbox_items').delete().eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ['expense-inbox', item.business_id] });
    },
  });
}

export function useInboxThumbnailUrl(item: InboxItem | null) {
  return useQuery({
    queryKey: ['inbox-thumb', item?.id, item?.storage_path],
    queryFn: async () => {
      if (!item) return null;
      const { data } = await supabase.storage
        .from('expense-inbox')
        .createSignedUrl(item.storage_path, 60 * 10);
      return data?.signedUrl ?? null;
    },
    enabled: !!item,
    staleTime: 60 * 1000 * 8,
  });
}
