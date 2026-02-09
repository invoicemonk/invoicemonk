import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeErrorMessage } from '@/lib/error-utils';
import type { Tables } from '@/integrations/supabase/types';

export type PaymentMethod = Tables<'payment_methods'>;

export const PROVIDER_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'wise', label: 'Wise' },
  { value: 'payoneer', label: 'Payoneer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe_link', label: 'Stripe Link' },
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'paystack', label: 'Paystack' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
] as const;

export type ProviderType = typeof PROVIDER_TYPES[number]['value'];

// Provider-specific instruction field definitions
export const PROVIDER_INSTRUCTION_FIELDS: Record<string, { key: string; label: string; required?: boolean; placeholder?: string }[]> = {
  bank_transfer: [
    { key: 'account_name', label: 'Account Name', required: true, placeholder: 'e.g. Acme Ltd' },
    { key: 'account_number', label: 'Account Number', required: true, placeholder: 'e.g. 0123456789' },
    { key: 'bank_name', label: 'Bank Name', required: true, placeholder: 'e.g. First Bank' },
    { key: 'routing_number', label: 'Routing / Sort Code', placeholder: 'e.g. 044150149' },
    { key: 'swift_code', label: 'SWIFT / BIC', placeholder: 'e.g. FBNINGLA' },
    { key: 'iban', label: 'IBAN', placeholder: 'e.g. NG...' },
  ],
  wise: [
    { key: 'email', label: 'Wise Email', required: true, placeholder: 'e.g. billing@acme.com' },
    { key: 'account_holder', label: 'Account Holder', placeholder: 'e.g. Acme Ltd' },
    { key: 'wise_tag', label: 'Wise Tag', placeholder: 'e.g. @acmeltd' },
  ],
  payoneer: [
    { key: 'email', label: 'Payoneer Email', required: true, placeholder: 'e.g. billing@acme.com' },
    { key: 'account_holder', label: 'Account Holder', placeholder: 'e.g. Acme Ltd' },
  ],
  paypal: [
    { key: 'email', label: 'PayPal Email', required: true, placeholder: 'e.g. billing@acme.com' },
    { key: 'paypal_me', label: 'PayPal.Me Link', placeholder: 'e.g. https://paypal.me/acme' },
  ],
  stripe_link: [
    { key: 'payment_link', label: 'Stripe Payment Link', required: true, placeholder: 'e.g. https://buy.stripe.com/...' },
  ],
  flutterwave: [
    { key: 'payment_link', label: 'Flutterwave Payment Link', required: true, placeholder: 'e.g. https://flutterwave.com/pay/...' },
    { key: 'account_name', label: 'Account Name', placeholder: 'e.g. Acme Ltd' },
  ],
  paystack: [
    { key: 'payment_link', label: 'Paystack Payment Link', required: true, placeholder: 'e.g. https://paystack.com/pay/...' },
    { key: 'account_name', label: 'Account Name', placeholder: 'e.g. Acme Ltd' },
  ],
  crypto: [
    { key: 'wallet_address', label: 'Wallet Address', required: true, placeholder: 'e.g. 0x...' },
    { key: 'network', label: 'Network', required: true, placeholder: 'e.g. Ethereum, Bitcoin, USDT (TRC20)' },
    { key: 'coin', label: 'Coin / Token', placeholder: 'e.g. USDT, BTC, ETH' },
  ],
  other: [
    { key: 'details', label: 'Payment Details', required: true, placeholder: 'Describe how to pay...' },
  ],
};

export function usePaymentMethods(currencyAccountId: string | undefined) {
  return useQuery({
    queryKey: ['payment-methods', 'currency-account', currencyAccountId],
    queryFn: async () => {
      if (!currencyAccountId) return [];
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('currency_account_id', currencyAccountId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!currencyAccountId,
  });
}

export function usePaymentMethodsByBusiness(businessId: string | undefined) {
  return useQuery({
    queryKey: ['payment-methods', 'business', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('business_id', businessId)
        .order('currency_account_id')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!businessId,
  });
}

export function usePaymentMethodLimit(businessId: string | undefined, currencyAccountId: string | undefined) {
  return useQuery({
    queryKey: ['payment-method-limit', businessId, currencyAccountId],
    queryFn: async () => {
      if (!businessId || !currencyAccountId) return null;
      const { data, error } = await supabase.rpc('check_payment_method_limit', {
        _business_id: businessId,
        _currency_account_id: currencyAccountId,
      });
      if (error) throw error;
      return data as { allowed: boolean; tier: string; current_count: number; limit: number | null; limit_type: string };
    },
    enabled: !!businessId && !!currencyAccountId,
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      business_id: string;
      currency_account_id: string;
      provider_type: string;
      display_name: string;
      instructions: Record<string, string>;
      is_default?: boolean;
    }) => {
      // If setting as default, unset existing defaults first
      if (input.is_default) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('currency_account_id', input.currency_account_id)
          .eq('is_default', true);
      }

      const { data, error } = await supabase
        .from('payment_methods')
        .insert({
          business_id: input.business_id,
          currency_account_id: input.currency_account_id,
          provider_type: input.provider_type,
          display_name: input.display_name,
          instructions: input.instructions,
          is_default: input.is_default ?? false,
        })
        .select()
        .single();
      if (error) throw error;

      // Log audit event
      try {
        await supabase.rpc('log_audit_event', {
          _event_type: 'PAYMENT_METHOD_CREATED' as any,
          _entity_type: 'payment_method',
          _entity_id: data.id,
          _business_id: input.business_id,
          _new_state: { provider_type: input.provider_type, display_name: input.display_name },
          _metadata: { currency_account_id: input.currency_account_id },
        });
      } catch {}

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-method-limit'] });
      toast({ title: 'Payment method added', description: `${data.display_name} has been configured.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      currency_account_id: string;
      display_name?: string;
      instructions?: Record<string, string>;
      is_default?: boolean;
      business_id?: string;
    }) => {
      // If setting as default, unset existing defaults first
      if (input.is_default) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('currency_account_id', input.currency_account_id)
          .eq('is_default', true);
      }

      const updates: Record<string, unknown> = {};
      if (input.display_name !== undefined) updates.display_name = input.display_name;
      if (input.instructions !== undefined) updates.instructions = input.instructions;
      if (input.is_default !== undefined) updates.is_default = input.is_default;

      const { data, error } = await supabase
        .from('payment_methods')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;

      // Log audit event
      try {
        await supabase.rpc('log_audit_event', {
          _event_type: 'PAYMENT_METHOD_UPDATED' as any,
          _entity_type: 'payment_method',
          _entity_id: input.id,
          _business_id: input.business_id || data.business_id,
          _new_state: updates as any,
          _metadata: { currency_account_id: input.currency_account_id },
        });
      } catch {}

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast({ title: 'Payment method updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch before deleting for audit
      const { data: existing } = await supabase
        .from('payment_methods')
        .select('id, business_id, display_name, provider_type, currency_account_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Log audit event
      if (existing) {
        try {
          await supabase.rpc('log_audit_event', {
            _event_type: 'PAYMENT_METHOD_DELETED' as any,
            _entity_type: 'payment_method',
            _entity_id: id,
            _business_id: existing.business_id,
            _previous_state: { display_name: existing.display_name, provider_type: existing.provider_type },
            _metadata: { currency_account_id: existing.currency_account_id },
          });
        } catch {}
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-method-limit'] });
      toast({ title: 'Payment method deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    },
  });
}

