import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export interface RecurringExpense {
  id: string;
  businessId: string | null;
  currencyAccountId: string | null;
  userId: string;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  vendor: string | null;
  notes: string | null;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  nextExpenseDate: string;
  isActive: boolean;
  lastGeneratedAt: string | null;
  productServiceId: string | null;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringExpenseInput {
  category: string;
  description?: string;
  amount: number;
  vendor?: string;
  notes?: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  receiptUrl?: string;
  productServiceId?: string | null;
}

export interface UpdateRecurringExpenseInput {
  category?: string;
  description?: string;
  amount?: number;
  vendor?: string;
  notes?: string;
  frequency?: RecurringFrequency;
  startDate?: string;
  endDate?: string | null;
  receiptUrl?: string;
  productServiceId?: string | null;
  isActive?: boolean;
}

function mapRow(row: any): RecurringExpense {
  return {
    id: row.id,
    businessId: row.business_id,
    currencyAccountId: row.currency_account_id,
    userId: row.user_id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    vendor: row.vendor,
    notes: row.notes,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    nextExpenseDate: row.next_expense_date,
    isActive: row.is_active,
    lastGeneratedAt: row.last_generated_at,
    productServiceId: row.product_service_id,
    receiptUrl: row.receipt_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useRecurringExpenses(businessId?: string, currencyAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recurring-expenses', businessId, currencyAccountId, user?.id],
    queryFn: async (): Promise<RecurringExpense[]> => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('recurring_expenses')
        .select('*')
        .order('next_expense_date', { ascending: true });

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(mapRow);
    },
    enabled: !!user,
  });
}

export function useCreateRecurringExpense(businessId?: string, currencyAccountId?: string, currency?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRecurringExpenseInput) => {
      if (!user) throw new Error('Not authenticated');
      if (!currencyAccountId) throw new Error('No currency account selected');
      if (!currency) throw new Error('Currency not determined');

      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({
          user_id: user.id,
          business_id: businessId || null,
          currency_account_id: currencyAccountId,
          category: input.category,
          description: input.description || null,
          amount: input.amount,
          currency,
          vendor: input.vendor || null,
          notes: input.notes || null,
          frequency: input.frequency,
          start_date: input.startDate,
          end_date: input.endDate || null,
          next_expense_date: input.startDate,
          receipt_url: input.receiptUrl || null,
          product_service_id: input.productServiceId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast({ title: 'Recurring expense created', description: 'Your recurring expense has been set up.' });
    },
    onError: (error) => {
      captureError(error, { hook: 'useCreateRecurringExpense' });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRecurringExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateRecurringExpenseInput }) => {
      if (!user) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {};
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.vendor !== undefined) updateData.vendor = updates.vendor;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
      if (updates.startDate !== undefined) {
        updateData.start_date = updates.startDate;
        updateData.next_expense_date = updates.startDate;
      }
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.receiptUrl !== undefined) updateData.receipt_url = updates.receiptUrl;
      if (updates.productServiceId !== undefined) updateData.product_service_id = updates.productServiceId ?? null;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { data, error } = await supabase
        .from('recurring_expenses')
        .update(updateData as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast({ title: 'Recurring expense updated' });
    },
    onError: (error) => {
      captureError(error, { hook: 'useUpdateRecurringExpense' });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRecurringExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast({ title: 'Recurring expense deleted' });
    },
    onError: (error) => {
      captureError(error, { hook: 'useDeleteRecurringExpense' });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useToggleRecurringExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      toast({ title: isActive ? 'Recurring expense activated' : 'Recurring expense paused' });
    },
    onError: (error) => {
      captureError(error, { hook: 'useToggleRecurringExpense' });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
