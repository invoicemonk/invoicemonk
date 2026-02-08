import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Expense {
  id: string;
  userId: string;
  businessId: string | null;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  expenseDate: string;
  vendor: string | null;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Exchange rate fields for multi-currency support
  exchangeRateToPrimary: number | null;
  primaryCurrency: string | null;
}

export interface CreateExpenseInput {
  category: string;
  description?: string;
  amount: number;
  currency?: string;
  expenseDate?: string;
  vendor?: string;
  notes?: string;
  receiptUrl?: string;
  exchangeRateToPrimary?: number;
}

export interface UpdateExpenseInput {
  category?: string;
  description?: string;
  amount?: number;
  currency?: string;
  expenseDate?: string;
  vendor?: string;
  notes?: string;
  receiptUrl?: string;
  exchangeRateToPrimary?: number;
}

// Expense categories
export const EXPENSE_CATEGORIES = [
  { value: 'software', label: 'Software & Tools' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent & Facilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'taxes', label: 'Taxes & Licenses' },
  { value: 'payroll', label: 'Payroll & Benefits' },
  { value: 'other', label: 'Other' },
] as const;

export function useExpenses(businessId?: string, dateRange?: { start: Date; end: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expenses', businessId, user?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<Expense[]> => {
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      // Filter by business or user
      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      // Apply date range filter
      if (dateRange) {
        query = query
          .gte('expense_date', dateRange.start.toISOString().split('T')[0])
          .lte('expense_date', dateRange.end.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(expense => ({
        id: expense.id,
        userId: expense.user_id,
        businessId: expense.business_id,
        category: expense.category,
        description: expense.description,
        amount: Number(expense.amount),
        currency: expense.currency,
        expenseDate: expense.expense_date,
        vendor: expense.vendor,
        receiptUrl: expense.receipt_url,
        notes: expense.notes,
        createdAt: expense.created_at,
        updatedAt: expense.updated_at,
        exchangeRateToPrimary: expense.exchange_rate_to_primary,
        primaryCurrency: expense.primary_currency,
      }));
    },
    enabled: !!user,
  });
}

export function useExpense(expenseId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expense', expenseId],
    queryFn: async (): Promise<Expense | null> => {
      if (!user || !expenseId) return null;

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        businessId: data.business_id,
        category: data.category,
        description: data.description,
        amount: Number(data.amount),
        currency: data.currency,
        expenseDate: data.expense_date,
        vendor: data.vendor,
        receiptUrl: data.receipt_url,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        exchangeRateToPrimary: data.exchange_rate_to_primary,
        primaryCurrency: data.primary_currency,
      };
    },
    enabled: !!user && !!expenseId,
  });
}

export function useCreateExpense(businessId?: string, defaultCurrency?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          business_id: businessId || null,
          category: input.category,
          description: input.description || null,
          amount: input.amount,
          currency: input.currency || defaultCurrency || 'NGN',
          expense_date: input.expenseDate || new Date().toISOString().split('T')[0],
          vendor: input.vendor || null,
          notes: input.notes || null,
          receipt_url: input.receiptUrl || null,
          exchange_rate_to_primary: input.exchangeRateToPrimary || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      toast({
        title: 'Expense created',
        description: 'Your expense has been recorded.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating expense',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateExpenseInput }) => {
      if (!user) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {};
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.currency !== undefined) updateData.currency = updates.currency;
      if (updates.expenseDate !== undefined) updateData.expense_date = updates.expenseDate;
      if (updates.vendor !== undefined) updateData.vendor = updates.vendor;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.receiptUrl !== undefined) updateData.receipt_url = updates.receiptUrl;

      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      toast({
        title: 'Expense updated',
        description: 'Your expense has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating expense',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-stats'] });
      toast({
        title: 'Expense deleted',
        description: 'Your expense has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting expense',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
