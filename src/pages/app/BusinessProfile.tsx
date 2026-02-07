import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Save,
  Globe,
  Mail,
  Phone,
  MapPin,
  FileText,
  Shield,
  Loader2,
  Upload,
  X,
  ImageIcon,
  Lock,
  Coins,
  AlertCircle,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateBusiness, useCreateBusiness, useUploadBusinessLogo, useDeleteBusinessLogo } from '@/hooks/use-business';
import { useBusiness } from '@/contexts/BusinessContext';
import { calculateProfileCompletion } from '@/lib/profile-completion';
import { getJurisdictionConfig } from '@/lib/jurisdiction-config';
import { Switch } from '@/components/ui/switch';

const jurisdictions = [
  { value: 'NG', label: 'Nigeria' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

interface AddressData {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [key: string]: string | undefined; // Allow Json indexing
}

export default function BusinessProfile() {
  const { currentBusiness: business, loading: isLoadingBusiness } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const createBusiness = useCreateBusiness();
  const uploadLogo = useUploadBusinessLogo();
  const deleteLogo = useDeleteBusinessLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    jurisdiction: 'NG',
    taxId: '',
    cacNumber: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    invoicePrefix: 'INV',
    defaultCurrency: 'NGN',
    isVatRegistered: false,
    vatRegistrationNumber: '',
    businessType: '',
  });

  // Get jurisdiction-specific configuration
  const jurisdictionConfig = getJurisdictionConfig(formData.jurisdiction);

  const currencies = [
    { value: 'NGN', label: 'Nigerian Naira (₦)' },
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'EUR', label: 'Euro (€)' },
  ];

  // Load business data into form when it arrives
  useEffect(() => {
    if (business) {
      const addressData = business.address as AddressData | null;
      // Cast to include new fields
      const businessExtended = business as typeof business & { 
        is_vat_registered?: boolean; 
        vat_registration_number?: string;
        cac_number?: string;
        business_type?: string;
      };

      setFormData({
        name: business.name || '',
        legalName: business.legal_name || '',
        jurisdiction: business.jurisdiction || 'NG',
        taxId: business.tax_id || '',
        cacNumber: businessExtended.cac_number || '',
        email: business.contact_email || '',
        phone: business.contact_phone || '',
        street: addressData?.street || '',
        city: addressData?.city || '',
        state: addressData?.state || '',
        postalCode: addressData?.postal_code || '',
        country: addressData?.country || '',
        invoicePrefix: business.invoice_prefix || 'INV',
        defaultCurrency: business.default_currency || 'NGN',
        isVatRegistered: businessExtended.is_vat_registered || false,
        vatRegistrationNumber: businessExtended.vat_registration_number || '',
        businessType: businessExtended.business_type || '',
      });
    }
  }, [business]);

  const handleSave = async () => {
    const addressData: AddressData = {
      street: formData.street || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      postal_code: formData.postalCode || undefined,
      country: formData.country || undefined,
    };

    const businessData = {
      name: formData.name,
      legal_name: formData.legalName || null,
      jurisdiction: formData.jurisdiction,
      tax_id: formData.taxId || null,
      cac_number: jurisdictionConfig.showCac ? (formData.cacNumber || null) : null,
      contact_email: formData.email || null,
      contact_phone: formData.phone || null,
      address: Object.values(addressData).some(Boolean) ? addressData : null,
      invoice_prefix: formData.invoicePrefix || 'INV',
      default_currency: formData.defaultCurrency || 'NGN',
      // VAT fields - only save if jurisdiction supports VAT
      is_vat_registered: jurisdictionConfig.showVat ? formData.isVatRegistered : false,
      vat_registration_number: jurisdictionConfig.showVat && formData.isVatRegistered 
        ? formData.vatRegistrationNumber || null 
        : null,
      // Business type
      business_type: formData.businessType || null,
    };

    if (business) {
      await updateBusiness.mutateAsync({
        businessId: business.id,
        updates: businessData as any, // Cast needed until types regenerate
      });
    } else {
      await createBusiness.mutateAsync(businessData as any);
    }
  };

  const isLoading = updateBusiness.isPending || createBusiness.isPending;
  const isUploadingLogo = uploadLogo.isPending;
  const isDeletingLogo = deleteLogo.isPending;
  const nextInvoiceNumber = business?.next_invoice_number || 1;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;
    
    await uploadLogo.mutateAsync({ businessId: business.id, file });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogoDelete = async () => {
    if (!business) return;
    await deleteLogo.mutateAsync(business.id);
  };

  // Calculate profile completion from current form data for real-time updates
  const profileCompletion = useMemo(() => {
    return calculateProfileCompletion({
      name: formData.name,
      legalName: formData.legalName,
      taxId: formData.taxId,
      email: formData.email,
      addressCity: formData.city,
      addressCountry: formData.country,
      // Jurisdiction-specific requirements
      jurisdiction: formData.jurisdiction,
      isVatRegistered: formData.isVatRegistered,
      vatRegistrationNumber: formData.vatRegistrationNumber,
      cacNumber: formData.cacNumber,
    });
  }, [formData]);

  if (isLoadingBusiness) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Profile</h1>
          <p className="text-muted-foreground mt-1">
            Configure your legal business details for invoicing
          </p>
        </div>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Compliance Notice - only show when profile is incomplete */}
      {!profileCompletion.isComplete && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex items-start gap-4">
              <Shield className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Complete your profile for compliance
                </p>
                <p className="text-sm text-muted-foreground">
                  A complete business profile ensures your invoices meet regulatory requirements 
                  and builds trust with your clients.
                </p>
              </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="space-y-2 pl-9">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profile completion</span>
                <span className="font-medium">{profileCompletion.completed} of {profileCompletion.total} fields complete</span>
              </div>
              <Progress value={profileCompletion.percentage} className="h-2" />
              {profileCompletion.missingFields.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Missing: {profileCompletion.missingFields.join(', ')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Logo */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Business Logo
            </CardTitle>
            <CardDescription>
              Upload your business logo to display on invoices (max 500KB, PNG/JPEG/SVG/WebP)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Logo Preview */}
              <div className="shrink-0">
                {business?.logo_url ? (
                  <div className="relative group">
                    <img 
                      src={business.logo_url} 
                      alt="Business Logo" 
                      className="h-24 w-auto max-w-[180px] object-contain rounded-lg border border-border bg-muted/50 p-2"
                    />
                    <button
                      onClick={handleLogoDelete}
                      disabled={isDeletingLogo}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove logo"
                    >
                      {isDeletingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Upload Section */}
              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo || !business}
                  className="w-full sm:w-auto"
                  title={!business ? 'Save your business profile first to enable logo upload' : undefined}
                >
                  {isUploadingLogo ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {isUploadingLogo ? 'Uploading...' : business?.logo_url ? 'Replace Logo' : 'Upload Logo'}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Your logo will appear on generated invoices and PDF exports.
                </p>
                
                {!business && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Fill in your business details and click "Save Changes" to enable logo upload.</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Identity
            </CardTitle>
            <CardDescription>
              Your legal business information as it will appear on invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                placeholder="My Business"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input
                id="legalName"
                placeholder="My Business Ltd."
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The registered legal name of your business entity
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Select 
                value={formData.jurisdiction}
                onValueChange={(value) => setFormData({ ...formData, jurisdiction: value })}
              >
                <SelectTrigger>
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.value} value={j.value}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">
                {jurisdictionConfig.taxIdLabel} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="taxId"
                placeholder={jurisdictionConfig.taxIdPlaceholder}
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {jurisdictionConfig.taxIdHint}
              </p>
            </div>

            {/* CAC/Registration Number - Only for jurisdictions that have it */}
            {jurisdictionConfig.showCac && (
              <div className="space-y-2">
                <Label htmlFor="cacNumber">
                  {jurisdictionConfig.cacLabel}
                </Label>
                <Input
                  id="cacNumber"
                  placeholder={jurisdictionConfig.cacPlaceholder}
                  value={formData.cacNumber}
                  onChange={(e) => setFormData({ ...formData, cacNumber: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {jurisdictionConfig.cacHint}
                </p>
              </div>
            )}

            {/* Business Type */}
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select 
                value={formData.businessType}
                onValueChange={(value) => setFormData({ ...formData, businessType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="freelancer">Freelancer / Solo</SelectItem>
                  <SelectItem value="sme">Small Business / SME</SelectItem>
                  <SelectItem value="agency">Agency / Studio</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Helps tailor insights to your business model
              </p>
            </div>

            {jurisdictionConfig.showVat && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="vatRegistered" className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      {formData.jurisdiction === 'CA' ? 'GST/HST Registered' : 'VAT Registered'}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.jurisdiction === 'NG' 
                        ? 'Toggle on if your business is registered for VAT with FIRS'
                        : formData.jurisdiction === 'CA'
                        ? 'Toggle on if your business is registered for GST/HST'
                        : 'Toggle on if your business is registered for VAT'
                      }
                    </p>
                  </div>
                  <Switch
                    id="vatRegistered"
                    checked={formData.isVatRegistered}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      isVatRegistered: checked,
                      vatRegistrationNumber: checked ? formData.vatRegistrationNumber : ''
                    })}
                  />
                </div>

                {formData.isVatRegistered && (
                  <div className="space-y-2">
                    <Label htmlFor="vatRegNumber">
                      {jurisdictionConfig.vatLabel} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="vatRegNumber"
                      placeholder={jurisdictionConfig.vatPlaceholder}
                      value={formData.vatRegistrationNumber}
                      onChange={(e) => setFormData({ ...formData, vatRegistrationNumber: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {jurisdictionConfig.vatHint || 'This will appear on all invoices.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              How clients can reach your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Business Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="billing@mybusiness.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Business Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  className="pl-9"
                  placeholder="+234 800 000 0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            {/* Structured Address Fields */}
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="street"
                  className="pl-9"
                  placeholder="123 Business Street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="Lagos"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  placeholder="Lagos State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  placeholder="100001"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">
                  Country <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {jurisdictions.map((j) => (
                      <SelectItem key={j.value} value={j.label}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Settings
            </CardTitle>
            <CardDescription>
              Customize how your invoices are generated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                <Input
                  id="invoicePrefix"
                  placeholder="INV"
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Your invoices will be numbered as {formData.invoicePrefix || 'INV'}-0001, {formData.invoicePrefix || 'INV'}-0002, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Next Invoice Number</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg font-mono">
                    {formData.invoicePrefix || 'INV'}-{String(nextInvoiceNumber).padStart(4, '0')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invoice numbers are sequential and cannot be modified
                </p>
              </div>
            </div>

            {/* Default Currency Section */}
            <div className="border-t pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultCurrency" className="flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Default Currency
                    {business?.currency_locked && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </Label>
                  
                  {business?.currency_locked ? (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {currencies.find(c => c.value === formData.defaultCurrency)?.label || formData.defaultCurrency}
                      </span>
                    </div>
                  ) : (
                    <Select 
                      value={formData.defaultCurrency}
                      onValueChange={(value) => setFormData({ ...formData, defaultCurrency: value })}
                    >
                      <SelectTrigger id="defaultCurrency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {business?.currency_locked ? (
                      <>
                        Currency was locked on {business.currency_locked_at ? new Date(business.currency_locked_at).toLocaleDateString() : 'first invoice'}. 
                        Once you issue your first invoice, currency cannot be changed.
                      </>
                    ) : (
                      'Select your default currency for invoices. This will be locked after you issue your first invoice.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
