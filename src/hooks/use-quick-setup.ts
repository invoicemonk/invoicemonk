import { useMemo, useCallback, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { usePaymentMethods } from '@/hooks/use-payment-methods';
import { useClients } from '@/hooks/use-clients';
import { useProductsServices } from '@/hooks/use-products-services';

export interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  complianceTip: string;
  complete: boolean;
  href: string;
}

export interface QuickSetupState {
  items: ChecklistItem[];
  allComplete: boolean;
  dismissed: boolean;
  dismiss: () => void;
  completedCount: number;
  firstIssuedInvoice: { id: string; verification_id: string } | null;
}

const VALID_STATUSES = ['issued', 'sent', 'viewed', 'paid'] as const;

export function useQuickSetup(): QuickSetupState {
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount } = useCurrencyAccount();
  const businessId = currentBusiness?.id;

  const storageKey = businessId ? `quick-setup-dismissed-${businessId}` : null;

  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey) return false;
    return localStorage.getItem(storageKey) === 'true';
  });

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(storageKey) === 'true');
  }, [storageKey]);

  const dismiss = useCallback(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
    setDismissed(true);
  }, [storageKey]);

  // Data queries
  const { data: paymentMethods = [] } = usePaymentMethods(currentCurrencyAccount?.id);
  const { data: clients = [] } = useClients(businessId);
  const { data: products = [] } = useProductsServices(currentCurrencyAccount?.id);

  // Strict invoice query: only count issued/sent/viewed/paid (void-guard)
  const { data: issuedInvoiceData } = useQuery({
    queryKey: ['quick-setup-invoices', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('id, verification_id')
        .eq('business_id', businessId)
        .in('status', ['issued', 'sent', 'viewed', 'paid'])
        .order('issued_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? { id: data[0].id, verification_id: data[0].verification_id || '' } : null;
    },
    enabled: !!businessId,
  });

  const items = useMemo((): ChecklistItem[] => {
    if (!businessId) return [];
    const base = `/b/${businessId}`;
    const address = currentBusiness?.address as { city?: string; country?: string } | null;
    return [
      {
        key: 'country',
        label: 'Confirm business country',
        description: 'Required on every invoice by law in most jurisdictions',
        complianceTip: 'Your country determines tax rules, invoice numbering, and required fields',
        complete: !!currentBusiness?.jurisdiction,
        href: `${base}/settings`,
      },
      {
        key: 'address',
        label: 'Add business address',
        description: 'Your address must appear on every invoice',
        complianceTip: "You'll need: street address, city, and country at minimum",
        complete: !!address?.city && !!address?.country,
        href: `${base}/settings`,
      },
      {
        key: 'tax_id',
        label: 'Enter your Tax ID',
        description: 'Required for tax-compliant invoicing',
        complianceTip: 'Your tax registration number (TIN, VAT, EIN) must appear on B2B invoices',
        complete: !!currentBusiness?.tax_id,
        href: `${base}/settings`,
      },
      {
        key: 'payment_method',
        label: 'Add payment method',
        description: 'Bank details or payment instructions must appear on invoices',
        complianceTip: 'You'll need: bank name, account number/IBAN, and routing/sort code',
        complete: paymentMethods.length > 0,
        href: `${base}/settings`,
      },
      {
        key: 'client',
        label: 'Create first client',
        description: 'Recipient details are legally required on invoices',
        complianceTip: 'Collect from your customer: legal name, address, and tax ID (if B2B)',
        complete: clients.length > 0,
        href: `${base}/clients`,
      },
      {
        key: 'product',
        label: 'Add product or service',
        description: 'Line items need clear descriptions and unit prices',
        complianceTip: 'Include: item name, quantity, unit price, and applicable tax rate',
        complete: products.length > 0,
        href: `${base}/products`,
      },
      {
        key: 'invoice',
        label: 'Issue first invoice',
        description: 'Issue a tamper-evident invoice with a unique number and QR code',
        complianceTip: 'Each invoice gets a verification ID, SHA-256 hash, and public verification page',
        complete: !!issuedInvoiceData,
        href: `${base}/invoices/new`,
      },
    ];
  }, [businessId, currentBusiness, paymentMethods.length, clients.length, products.length, issuedInvoiceData]);

  const completedCount = items.filter(i => i.complete).length;
  const allComplete = items.length > 0 && completedCount === items.length;

  return {
    items,
    allComplete,
    dismissed,
    dismiss,
    completedCount,
    firstIssuedInvoice: allComplete ? (issuedInvoiceData ?? null) : null,
  };
}
