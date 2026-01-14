import { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserBusiness, useUpdateBusiness, useCreateBusiness } from '@/hooks/use-business';

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
  const { data: business, isLoading: isLoadingBusiness } = useUserBusiness();
  const updateBusiness = useUpdateBusiness();
  const createBusiness = useCreateBusiness();

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    jurisdiction: 'NG',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    invoicePrefix: 'INV',
  });

  // Load business data into form when it arrives
  useEffect(() => {
    if (business) {
      const addressData = business.address as AddressData | null;
      const addressString = addressData 
        ? [addressData.street, addressData.city, addressData.state, addressData.postal_code, addressData.country]
            .filter(Boolean)
            .join('\n')
        : '';

      setFormData({
        name: business.name || '',
        legalName: business.legal_name || '',
        jurisdiction: business.jurisdiction || 'NG',
        taxId: business.tax_id || '',
        email: business.contact_email || '',
        phone: business.contact_phone || '',
        address: addressString,
        invoicePrefix: business.invoice_prefix || 'INV',
      });
    }
  }, [business]);

  const handleSave = async () => {
    // Parse address into structured format
    const addressLines = formData.address.split('\n').filter(Boolean);
    const addressData: AddressData = {
      street: addressLines[0] || undefined,
      city: addressLines[1] || undefined,
      state: addressLines[2] || undefined,
      postal_code: addressLines[3] || undefined,
      country: addressLines[4] || undefined,
    };

    const businessData = {
      name: formData.name,
      legal_name: formData.legalName || null,
      jurisdiction: formData.jurisdiction,
      tax_id: formData.taxId || null,
      contact_email: formData.email || null,
      contact_phone: formData.phone || null,
      address: Object.values(addressData).some(Boolean) ? addressData : null,
      invoice_prefix: formData.invoicePrefix || 'INV',
    };

    if (business) {
      // Update existing business
      await updateBusiness.mutateAsync({
        businessId: business.id,
        updates: businessData,
      });
    } else {
      // Create new business
      await createBusiness.mutateAsync(businessData);
    }
  };

  const isLoading = updateBusiness.isPending || createBusiness.isPending;
  const nextInvoiceNumber = business?.next_invoice_number || 1;

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

      {/* Compliance Notice */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-center gap-4 py-4">
          <Shield className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Complete your profile for compliance
            </p>
            <p className="text-sm text-muted-foreground">
              A complete business profile ensures your invoices meet regulatory requirements 
              and builds trust with your clients.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
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
              <Label htmlFor="taxId">Tax ID / VAT Number</Label>
              <Input
                id="taxId"
                placeholder="Enter your tax identification number"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  className="pl-9 min-h-[100px]"
                  placeholder="123 Business Street&#10;Lagos, Nigeria"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
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
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
