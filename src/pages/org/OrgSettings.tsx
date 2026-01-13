import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Save, 
  Globe, 
  MapPin, 
  Phone, 
  Mail,
  FileText,
  Shield,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationDetails, useUpdateOrganization } from '@/hooks/use-organization';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const jurisdictions = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
];

export default function OrgSettings() {
  const { orgId } = useParams();
  const { canEditSettings, isAuditor } = useOrganization();
  const { data: org, isLoading } = useOrganizationDetails(orgId);
  const updateOrg = useUpdateOrganization();

  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    tax_id: '',
    jurisdiction: 'NG',
    contact_email: '',
    contact_phone: '',
    invoice_prefix: 'INV',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });

  const [retentionYears, setRetentionYears] = useState(7);
  const [autoBackup, setAutoBackup] = useState(true);

  // Update form when org data loads
  useState(() => {
    if (org) {
      const address = org.address as { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null;
      setFormData({
        name: org.name || '',
        legal_name: org.legal_name || '',
        tax_id: org.tax_id || '',
        jurisdiction: org.jurisdiction || 'NG',
        contact_email: org.contact_email || '',
        contact_phone: org.contact_phone || '',
        invoice_prefix: org.invoice_prefix || 'INV',
        address_line1: address?.line1 || '',
        address_line2: address?.line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        postal_code: address?.postal_code || '',
        country: address?.country || '',
      });
    }
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!orgId || !canEditSettings) return;

    try {
      await updateOrg.mutateAsync({
        orgId,
        updates: {
          name: formData.name,
          legal_name: formData.legal_name,
          tax_id: formData.tax_id,
          jurisdiction: formData.jurisdiction,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          invoice_prefix: formData.invoice_prefix,
          address: {
            line1: formData.address_line1,
            line2: formData.address_line2,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
          },
        },
      });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
          <p className="text-muted-foreground">Manage legal identity and compliance configuration</p>
        </div>
        {canEditSettings && (
          <Button onClick={handleSave} disabled={updateOrg.isPending}>
            {updateOrg.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Read-only notice for auditors */}
      {isAuditor && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">Read-Only Access</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                As an auditor, you can view organization settings but cannot make changes.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Business Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Identity
          </CardTitle>
          <CardDescription>
            Legal information that appears on invoices and compliance documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_name">Legal Name</Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => handleInputChange('legal_name', e.target.value)}
                placeholder="Registered business name"
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => handleInputChange('tax_id', e.target.value)}
                placeholder="e.g., TIN-12345678"
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Select 
                value={formData.jurisdiction} 
                onValueChange={(v) => handleInputChange('jurisdiction', v)}
                disabled={!canEditSettings}
              >
                <SelectTrigger>
                  <Globe className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.code} value={j.code}>{j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            Business contact details for client communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Business Address
          </CardTitle>
          <CardDescription>
            Registered business address for invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              value={formData.address_line1}
              onChange={(e) => handleInputChange('address_line1', e.target.value)}
              placeholder="Street address"
              disabled={!canEditSettings}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              value={formData.address_line2}
              onChange={(e) => handleInputChange('address_line2', e.target.value)}
              placeholder="Suite, floor, etc."
              disabled={!canEditSettings}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State / Region</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => handleInputChange('postal_code', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                disabled={!canEditSettings}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Settings
          </CardTitle>
          <CardDescription>
            Configure invoice numbering and defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
              <Input
                id="invoice_prefix"
                value={formData.invoice_prefix}
                onChange={(e) => handleInputChange('invoice_prefix', e.target.value.toUpperCase())}
                placeholder="INV"
                maxLength={5}
                disabled={!canEditSettings}
              />
              <p className="text-xs text-muted-foreground">
                Example: {formData.invoice_prefix || 'INV'}-00001
              </p>
            </div>
            <div className="space-y-2">
              <Label>Next Invoice Number</Label>
              <Input
                value={org?.next_invoice_number || 1}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Auto-increments with each issued invoice
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Configuration
          </CardTitle>
          <CardDescription>
            Data retention and compliance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Data Retention Period</Label>
              <p className="text-sm text-muted-foreground">
                How long to retain financial records (minimum 7 years for tax compliance)
              </p>
            </div>
            <Select 
              value={String(retentionYears)} 
              onValueChange={(v) => setRetentionYears(Number(v))}
              disabled={!canEditSettings}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 years</SelectItem>
                <SelectItem value="10">10 years</SelectItem>
                <SelectItem value="15">15 years</SelectItem>
                <SelectItem value="0">Indefinite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Backups</Label>
              <p className="text-sm text-muted-foreground">
                Enable daily encrypted backups of all financial data
              </p>
            </div>
            <Switch
              checked={autoBackup}
              onCheckedChange={setAutoBackup}
              disabled={!canEditSettings}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-muted bg-muted/30 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Changes Are Logged</p>
            <p className="text-sm text-muted-foreground">
              All changes to organization settings are recorded in the audit log with timestamps 
              and actor information for compliance purposes.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
