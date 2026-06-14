import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, User, Building2, Heart, ArrowRight, ArrowLeft, Loader2,
  ShieldCheck, MapPin, Receipt, ImageIcon, CreditCard, Check, Upload,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { COUNTRY_OPTIONS, getCountryByCode, getCountryCurrency } from '@/lib/countries';
import {
  getJurisdictionConfig, isIssuerTaxIdRequired, isIssuerCacRequired,
} from '@/lib/jurisdiction-config';
import { useToast } from '@/hooks/use-toast';
import { useUploadBusinessLogo } from '@/hooks/use-business';
import { useCreatePaymentMethod, PROVIDER_TYPES, getBankTransferFields, PROVIDER_INSTRUCTION_FIELDS } from '@/hooks/use-payment-methods';

type EntityType = 'individual' | 'business' | 'nonprofit';

const STEP_LABELS = [
  'Location',
  'Identity',
  'Address',
  'Tax',
  'Branding',
  'Get paid',
];

export default function OnboardingWizard() {
  const { businessId: paramBusinessId } = useParams<{ businessId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Gate: must have a live subscription. Catches the legacy bug where
  // /checkout/success flipped has_selected_plan without verifying payment.
  const { data: subscriptionGate, isLoading: loadingGate } = useQuery({
    queryKey: ['onboarding-sub-gate', user?.id],
    queryFn: async () => {
      if (!user) return { ok: false };
      const live = ['active', 'trialing', 'past_due'] as const;
      const { data: userSubs } = await supabase
        .from('subscriptions').select('id').eq('user_id', user.id).in('status', live).limit(1);
      if ((userSubs?.length ?? 0) > 0) return { ok: true };
      const { data: memberships } = await supabase
        .from('business_members').select('business_id').eq('user_id', user.id);
      const ids = (memberships ?? []).map(m => m.business_id);
      if (ids.length === 0) return { ok: false };
      const { data: bizSubs } = await supabase
        .from('subscriptions').select('id').in('business_id', ids).in('status', live).limit(1);
      return { ok: (bizSubs?.length ?? 0) > 0 };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loadingGate && subscriptionGate && !subscriptionGate.ok) {
      navigate('/select-plan', { replace: true });
    }
  }, [loadingGate, subscriptionGate, navigate]);

  // Load business (param or default first business)
  const { data: business, isLoading: loadingBusiness } = useQuery({
    queryKey: ['onboarding-business', user?.id, paramBusinessId],
    queryFn: async () => {
      if (!user) return null;
      if (paramBusinessId) {
        const { data } = await supabase.from('businesses').select('*').eq('id', paramBusinessId).maybeSingle();
        return data;
      }
      const { data: m } = await supabase
        .from('business_members')
        .select('business:businesses(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return (m?.business as any) ?? null;
    },
    enabled: !!user && subscriptionGate?.ok === true,
  });

  const businessId = business?.id;

  // Load sensitive
  const { data: sensitive } = useQuery({
    queryKey: ['onboarding-sensitive', businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data } = await supabase
        .from('business_sensitive_data')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      return data;
    },
    enabled: !!businessId,
  });

  // Form state
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    jurisdiction: '',
    currency: '',
    entityType: '' as EntityType | '',
    legalName: '',
    taxId: '',
    cacNumber: '',
    governmentIdValue: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    contactEmail: '',
    contactPhone: '',
    isVatRegistered: false,
    vatRegistrationNumber: '',
    invoicePrefix: 'INV',
    brandColor: '#1d6b5a',
    paymentProviderType: 'bank_transfer',
    paymentDisplayName: '',
    paymentInstructions: {} as Record<string, string>,
  });

  // Initialize from existing business
  useEffect(() => {
    if (!business) return;
    const addr = (business.address as any) || {};
    const detectCountry = () => {
      try {
        const code = (navigator.language || '').split('-').pop()?.toUpperCase();
        if (code && COUNTRY_OPTIONS.some(c => c.code === code)) return code;
      } catch { /* noop */ }
      return '';
    };
    const jurisdiction = business.jurisdiction || detectCountry();
    const currency = business.default_currency || (jurisdiction ? getCountryCurrency(jurisdiction) || '' : '');
    setForm(f => ({
      ...f,
      name: business.name || f.name,
      jurisdiction,
      currency,
      entityType: (business.entity_type as EntityType) || f.entityType,
      legalName: business.legal_name || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postal_code || '',
      contactEmail: business.contact_email || user?.email || '',
      contactPhone: business.contact_phone || '',
      isVatRegistered: !!(business as any).is_vat_registered,
      invoicePrefix: business.invoice_prefix || 'INV',
      brandColor: (business as any).brand_color || '#1d6b5a',
    }));
    // Resume from saved step
    const saved = (business as any).onboarding_step as string | null;
    const idx = saved ? STEP_KEYS.indexOf(saved as any) : -1;
    if (idx >= 0 && idx < STEP_KEYS.length) setStep(idx);
  }, [business, user?.email]);

  // Initialize sensitive once loaded
  useEffect(() => {
    if (!sensitive) return;
    setForm(f => ({
      ...f,
      taxId: sensitive.tax_id || '',
      cacNumber: sensitive.cac_number || '',
      governmentIdValue: sensitive.government_id_value || '',
      vatRegistrationNumber: sensitive.vat_registration_number || '',
    }));
  }, [sensitive]);

  const jurisdictionConfig = useMemo(
    () => (form.jurisdiction ? getJurisdictionConfig(form.jurisdiction) : null),
    [form.jurisdiction],
  );
  const country = form.jurisdiction ? getCountryByCode(form.jurisdiction) : null;
  const taxIdRequired = form.entityType === 'business' || form.entityType === 'nonprofit' || isIssuerTaxIdRequired(form.jurisdiction);
  const cacRequired = form.entityType !== 'individual' && isIssuerCacRequired(form.jurisdiction);
  const showVat = jurisdictionConfig?.showVat ?? false;

  // Mutations
  const uploadLogo = useUploadBusinessLogo();
  const createPayment = useCreatePaymentMethod();
  const [savingStep, setSavingStep] = useState(false);

  const persistAll = async (stepKey: string, completed = false): Promise<void> => {
    if (!businessId) return;
    const address = {
      street: form.street || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      postal_code: form.postalCode || undefined,
      country: form.jurisdiction || undefined,
    };
    const updates: any = {
      name: form.name || business?.name,
      jurisdiction: form.jurisdiction || null,
      default_currency: form.currency || null,
      entity_type: form.entityType || 'business',
      legal_name: form.entityType === 'individual' ? null : (form.legalName || null),
      contact_email: form.contactEmail || null,
      contact_phone: form.contactPhone || null,
      address: Object.values(address).some(Boolean) ? address : null,
      invoice_prefix: form.invoicePrefix || 'INV',
      is_vat_registered: showVat ? form.isVatRegistered : false,
      brand_color: form.brandColor || null,
      onboarding_step: completed ? 'completed' : stepKey,
    };
    if (jurisdictionConfig?.invoiceNumberDigits) {
      updates.invoice_number_digits = jurisdictionConfig.invoiceNumberDigits;
    }
    const { error } = await supabase.from('businesses').update(updates).eq('id', businessId);
    if (error) throw error;

    const sensitivePayload = {
      business_id: businessId,
      tax_id: form.governmentIdValue || form.taxId || null,
      cac_number: cacRequired ? (form.cacNumber || null) : null,
      vat_registration_number: showVat && form.isVatRegistered ? (form.vatRegistrationNumber || null) : null,
      government_id_value: form.governmentIdValue || null,
    };
    const { error: sErr } = await supabase
      .from('business_sensitive_data')
      .upsert(sensitivePayload, { onConflict: 'business_id' });
    if (sErr) throw sErr;

    // Ensure default currency account exists when currency is set
    if (form.currency) {
      const { data: existing } = await supabase
        .from('currency_accounts')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_default', true)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from('currency_accounts').insert({
          business_id: businessId,
          currency: form.currency,
          is_default: true,
          name: `${form.currency} Account`,
        });
      }
    }
  };

  const validateStep = (): string | null => {
    switch (step) {
      case 0:
        if (!form.jurisdiction) return 'Select your country.';
        if (!form.entityType) return 'Pick your entity type.';
        if (!form.currency) return 'A currency is required.';
        if (!form.name?.trim()) return 'Enter your business or trading name.';
        return null;
      case 1:
        if (form.entityType !== 'individual' && !form.legalName?.trim()) return 'Enter your legal / registered name.';
        if (taxIdRequired && !(form.governmentIdValue || form.taxId)?.trim()) {
          return `${jurisdictionConfig?.taxIdLabel || 'Tax ID'} is required.`;
        }
        if (cacRequired && !form.cacNumber?.trim()) {
          return `${jurisdictionConfig?.cacLabel || 'Commercial registration'} is required.`;
        }
        return null;
      case 2:
        if (!form.contactEmail?.trim()) return 'Contact email is required for invoices.';
        if (form.entityType !== 'individual' && !form.city?.trim()) return 'City is required.';
        return null;
      case 3:
        if (showVat && form.isVatRegistered && !form.vatRegistrationNumber?.trim()) {
          return `${jurisdictionConfig?.vatLabel || 'VAT number'} is required.`;
        }
        return null;
      case 4:
        if (!business?.logo_url) return 'Please upload a logo before continuing.';
        return null;
      case 5: {
        const fields = form.paymentProviderType === 'bank_transfer'
          ? getBankTransferFields(form.currency)
          : (PROVIDER_INSTRUCTION_FIELDS[form.paymentProviderType] || []);
        for (const f of fields) {
          if (f.required && !form.paymentInstructions[f.key]?.trim()) return `${f.label} is required.`;
        }
        if (!form.paymentDisplayName?.trim()) return 'Give this payment method a display name.';
        return null;
      }
      default:
        return null;
    }
  };

  const handleNext = async () => {
    const err = validateStep();
    if (err) { toast({ title: 'Missing information', description: err, variant: 'destructive' }); return; }
    if (!businessId) return;
    setSavingStep(true);
    try {
      const isLast = step === STEP_KEYS.length - 1;
      const nextKey = isLast ? 'completed' : STEP_KEYS[step + 1];
      await persistAll(nextKey, isLast);

      // Step-specific side effects
      if (step === 5) {
        // Create payment method (find/create currency account)
        const { data: ca } = await supabase
          .from('currency_accounts')
          .select('id')
          .eq('business_id', businessId)
          .eq('currency', form.currency)
          .limit(1)
          .maybeSingle();
        let currencyAccountId = ca?.id;
        if (!currencyAccountId) {
          const { data: newCa } = await supabase
            .from('currency_accounts')
            .insert({ business_id: businessId, currency: form.currency, is_default: true, name: `${form.currency} Account` })
            .select('id').single();
          currencyAccountId = newCa?.id;
        }
        if (currencyAccountId) {
          await createPayment.mutateAsync({
            business_id: businessId,
            currency_account_id: currencyAccountId,
            provider_type: form.paymentProviderType,
            display_name: form.paymentDisplayName,
            instructions: form.paymentInstructions,
            is_default: true,
          });
        }
      }

      if (isLast) {
        // Must await refetch — BusinessLayout reads user-businesses cache and
        // will bounce back to /onboarding if it still sees the pre-completion value.
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['user-businesses'] }),
          queryClient.refetchQueries({ queryKey: ['business-redirect'] }),
        ]);
        queryClient.invalidateQueries({ queryKey: ['user-business'] });
        queryClient.invalidateQueries({ queryKey: ['onboarding-business'] });
        toast({ title: 'You are all set', description: 'Welcome to your dashboard.' });
        navigate(`/b/${businessId}/dashboard`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['user-business'] });
        queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
        queryClient.invalidateQueries({ queryKey: ['business-redirect'] });
        queryClient.invalidateQueries({ queryKey: ['onboarding-business'] });
        setStep(step + 1);
      }
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message || 'Try again', variant: 'destructive' });
    } finally {
      setSavingStep(false);
    }
  };

  const handleBack = () => setStep(Math.max(0, step - 1));

  const onLogoFile = async (file: File) => {
    if (!businessId) return;
    try {
      await uploadLogo.mutateAsync({ businessId, file });
      queryClient.invalidateQueries({ queryKey: ['onboarding-business'] });
    } catch {/* toast handled in hook */}
  };

  if (loadingBusiness || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progressPct = Math.round(((step + 1) / STEP_KEYS.length) * 100);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              Step {step + 1} of {STEP_KEYS.length} · {STEP_LABELS[step]}
            </Badge>
            <span className="text-xs text-muted-foreground">{progressPct}% complete</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && <StepLocation form={form} setForm={setForm} />}
            {step === 1 && <StepIdentity form={form} setForm={setForm} jurisdictionConfig={jurisdictionConfig} taxIdRequired={taxIdRequired} cacRequired={cacRequired} />}
            {step === 2 && <StepAddress form={form} setForm={setForm} jurisdictionConfig={jurisdictionConfig} />}
            {step === 3 && <StepTax form={form} setForm={setForm} showVat={showVat} jurisdictionConfig={jurisdictionConfig} />}
            {step === 4 && <StepBranding form={form} setForm={setForm} logoUrl={business.logo_url} onLogoFile={onLogoFile} uploading={uploadLogo.isPending} />}
            {step === 5 && <StepGetPaid form={form} setForm={setForm} />}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0 || savingStep}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button onClick={handleNext} disabled={savingStep} size="lg">
            {savingStep ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
            {step === STEP_KEYS.length - 1 ? 'Finish & go to dashboard' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const STEP_KEYS = ['location', 'identity', 'address', 'tax', 'branding', 'payment'] as const;

// ============== Step components ==============

function StepHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="text-center space-y-2 mb-6">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function StepLocation({ form, setForm }: any) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <StepHeader icon={Globe} title="Where does your business operate?" subtitle="We use this to format invoices for your country's compliance requirements." />

        <div className="space-y-2">
          <Label htmlFor="name">Business / trading name</Label>
          <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Studio" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Select value={form.jurisdiction} onValueChange={(v) => {
            const cur = getCountryCurrency(v) || form.currency;
            setForm({ ...form, jurisdiction: v, currency: cur });
          }}>
            <SelectTrigger id="country" className="h-11">
              <SelectValue placeholder="Select your country..." />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Entity type</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: 'individual', l: 'Individual', d: 'Freelancer / sole proprietor', i: User },
              { v: 'business', l: 'Business', d: 'Registered company', i: Building2 },
              { v: 'nonprofit', l: 'Nonprofit', d: 'Charity / NGO', i: Heart },
            ].map(o => {
              const Icon = o.i;
              const active = form.entityType === o.v;
              return (
                <button key={o.v} type="button" onClick={() => setForm({ ...form, entityType: o.v })}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{o.l}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{o.d}</span>
                </button>
              );
            })}
          </div>
        </div>

        {form.currency && (
          <div className="rounded-md bg-muted/40 p-3 text-sm flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            Default currency: <span className="font-medium">{form.currency}</span>
            <span className="text-muted-foreground ml-auto text-xs">Lockable later</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepIdentity({ form, setForm, jurisdictionConfig, taxIdRequired, cacRequired }: any) {
  const isIndividual = form.entityType === 'individual';
  const taxIdLabel = jurisdictionConfig?.taxIdLabel || 'Tax ID';
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <StepHeader icon={ShieldCheck} title="Identify your business" subtitle="These details appear on every invoice and prove who issued it." />

        {!isIndividual && (
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal / registered name</Label>
            <Input id="legalName" value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} placeholder="As shown on registration" />
          </div>
        )}

        {(taxIdRequired || !isIndividual) && (
          <div className="space-y-2">
            <Label htmlFor="taxId">
              {isIndividual ? `${taxIdLabel} / Government ID` : taxIdLabel}
              {taxIdRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id="taxId"
              value={isIndividual ? form.governmentIdValue : form.taxId}
              onChange={e => isIndividual
                ? setForm({ ...form, governmentIdValue: e.target.value })
                : setForm({ ...form, taxId: e.target.value })
              }
              placeholder={jurisdictionConfig?.taxIdPlaceholder || ''}
            />
            {jurisdictionConfig?.taxIdHint && <p className="text-xs text-muted-foreground">{jurisdictionConfig.taxIdHint}</p>}
          </div>
        )}

        {cacRequired && (
          <div className="space-y-2">
            <Label htmlFor="cac">
              {jurisdictionConfig?.cacLabel || 'Commercial Registration'}<span className="text-destructive ml-1">*</span>
            </Label>
            <Input id="cac" value={form.cacNumber} onChange={e => setForm({ ...form, cacNumber: e.target.value })} placeholder={jurisdictionConfig?.cacPlaceholder || ''} />
            {jurisdictionConfig?.cacHint && <p className="text-xs text-muted-foreground">{jurisdictionConfig.cacHint}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepAddress({ form, setForm, jurisdictionConfig }: any) {
  const isIndividual = form.entityType === 'individual';
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <StepHeader icon={MapPin} title="Address & contact" subtitle="Appears as the issuer block on every invoice." />

        <div className="space-y-2">
          <Label htmlFor="email">Contact email <span className="text-destructive">*</span></Label>
          <Input id="email" type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Business phone</Label>
          <Input id="phone" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} placeholder={jurisdictionConfig?.phonePrefix || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="street">Street address</Label>
          <Input id="street" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">City {!isIndividual && <span className="text-destructive">*</span>}</Label>
            <Input id="city" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder={jurisdictionConfig?.cityPlaceholder || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">{jurisdictionConfig?.stateLabel || 'State / Region'}</Label>
            <Input id="state" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder={jurisdictionConfig?.statePlaceholder || ''} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="postal">{jurisdictionConfig?.postalCodeLabel || 'Postal code'}</Label>
          <Input id="postal" value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} placeholder={jurisdictionConfig?.postalCodePlaceholder || ''} />
        </div>
      </CardContent>
    </Card>
  );
}

function StepTax({ form, setForm, showVat, jurisdictionConfig }: any) {
  if (!showVat) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-5">
          <StepHeader icon={Receipt} title="Tax setup" subtitle="Nothing to set up here for your country — we'll handle defaults automatically." />
          <div className="rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">
            Your jurisdiction does not require VAT registration. You can skip this step.
          </div>
        </CardContent>
      </Card>
    );
  }
  const vatLabel = jurisdictionConfig?.vatLabel || 'VAT Registration Number';
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <StepHeader icon={Receipt} title="Tax setup" subtitle={`Tell us if you're registered for ${vatLabel}.`} />

        <div className="flex items-center justify-between rounded-md border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Are you VAT registered?</Label>
            <p className="text-sm text-muted-foreground">Enables VAT lines on your invoices.</p>
          </div>
          <Switch
            checked={form.isVatRegistered}
            onCheckedChange={(v) => setForm({ ...form, isVatRegistered: v })}
          />
        </div>

        {form.isVatRegistered && (
          <div className="space-y-2">
            <Label htmlFor="vat">{vatLabel}<span className="text-destructive ml-1">*</span></Label>
            <Input id="vat" value={form.vatRegistrationNumber} onChange={e => setForm({ ...form, vatRegistrationNumber: e.target.value })} placeholder={jurisdictionConfig?.vatPlaceholder || ''} />
            {jurisdictionConfig?.vatHint && <p className="text-xs text-muted-foreground">{jurisdictionConfig.vatHint}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepBranding({ form, setForm, logoUrl, onLogoFile, uploading }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <StepHeader icon={ImageIcon} title="Branding" subtitle="Make every invoice look like yours." />

        <div className="space-y-3">
          <Label>Business logo <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
            </div>
            <div className="flex-1 space-y-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); }} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPEG, SVG, or WebP. Max 500KB.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prefix">Invoice prefix</Label>
            <Input id="prefix" value={form.invoicePrefix} onChange={e => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} placeholder="INV" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Brand color</Label>
            <div className="flex items-center gap-2">
              <input id="color" type="color" className="h-10 w-12 rounded border" value={form.brandColor} onChange={e => setForm({ ...form, brandColor: e.target.value })} />
              <Input value={form.brandColor} onChange={e => setForm({ ...form, brandColor: e.target.value })} className="font-mono" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepGetPaid({ form, setForm }: any) {
  const fields = form.paymentProviderType === 'bank_transfer'
    ? getBankTransferFields(form.currency)
    : (PROVIDER_INSTRUCTION_FIELDS[form.paymentProviderType] || []);

  const setField = (k: string, v: string) =>
    setForm({ ...form, paymentInstructions: { ...form.paymentInstructions, [k]: v } });

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <StepHeader icon={CreditCard} title="How should clients pay you?" subtitle="At least one payment method is required so your first invoice can be paid." />

        <div className="space-y-2">
          <Label>Payment method</Label>
          <Select value={form.paymentProviderType} onValueChange={(v) => setForm({ ...form, paymentProviderType: v, paymentInstructions: {} })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payname">Display name on invoices</Label>
          <Input id="payname" value={form.paymentDisplayName} onChange={e => setForm({ ...form, paymentDisplayName: e.target.value })}
            placeholder={`${PROVIDER_TYPES.find(p => p.value === form.paymentProviderType)?.label || 'Payment'} (${form.currency || ''})`} />
        </div>

        {fields.map((f: any) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
            <Input
              id={f.key}
              value={form.paymentInstructions[f.key] || ''}
              onChange={e => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              inputMode={f.inputMode}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
