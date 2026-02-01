import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Loader2, 
  Save,
  Building2,
  User,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useClient, useUpdateClient, useClientInvoices } from '@/hooks/use-clients';
import { useUserBusiness } from '@/hooks/use-business';
import { getJurisdictionConfig } from '@/lib/jurisdiction-config';

interface Address {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export default function ClientEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading: clientLoading } = useClient(id);
  const { data: invoices } = useClientInvoices(id);
  const { data: business } = useUserBusiness();
  const updateClient = useUpdateClient();

  // Get jurisdiction config based on user's business
  const jurisdictionConfig = getJurisdictionConfig(business?.jurisdiction || 'NG');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    tax_id: '',
    notes: '',
    client_type: 'company' as 'individual' | 'company',
    cac_number: '',
    contact_person: '',
    address: {
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
    } as Address,
  });

  useEffect(() => {
    if (client) {
      const address = (client.address || {}) as Address;
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        tax_id: client.tax_id || '',
        notes: client.notes || '',
        client_type: (client.client_type as 'individual' | 'company') || 'company',
        cac_number: client.cac_number || '',
        contact_person: client.contact_person || '',
        address: {
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          postal_code: address.postal_code || '',
          country: address.country || '',
        },
      });
    }
  }, [client]);

  // Check if client has any issued invoices (for edit lock)
  const hasIssuedInvoices = invoices?.some(inv => inv.status !== 'draft') || false;

  const handleSave = async () => {
    if (!id) return;
    
    // Clean up empty address fields
    const addressData = Object.fromEntries(
      Object.entries(formData.address).filter(([_, v]) => v.trim() !== '')
    );

    await updateClient.mutateAsync({
      clientId: id,
      updates: {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        tax_id: formData.tax_id || null,
        notes: formData.notes || null,
        client_type: formData.client_type,
        cac_number: formData.client_type === 'company' ? (formData.cac_number || null) : null,
        contact_person: formData.client_type === 'company' ? (formData.contact_person || null) : null,
        address: Object.keys(addressData).length > 0 ? addressData : null,
      },
    });

    navigate(`/clients/${id}`);
  };

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Client Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">This client doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/clients')}>Back to Clients</Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (hasIssuedInvoices) {
    navigate(`/clients/${id}`);
    return null;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Client</h1>
            <p className="text-muted-foreground">{client.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateClient.isPending || !formData.name.trim()}>
            {updateClient.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Client name and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Type */}
            <div className="space-y-3">
              <Label>Client Type</Label>
              <RadioGroup
                value={formData.client_type}
                onValueChange={(v) => setFormData({ ...formData, client_type: v as 'individual' | 'company' })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="company" id="edit-company" />
                  <Label htmlFor="edit-company" className="flex items-center gap-1.5 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Company
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="edit-individual" />
                  <Label htmlFor="edit-individual" className="flex items-center gap-1.5 cursor-pointer">
                    <User className="h-4 w-4" />
                    Individual
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {formData.client_type === 'company' ? 'Company Name' : 'Full Name'} *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.client_type === 'company' ? 'Acme Corporation Ltd.' : 'John Doe'}
              />
            </div>

            {/* Contact Person (for companies) */}
            {formData.client_type === 'company' && (
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={`${jurisdictionConfig.phonePrefix} ...`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tax & Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Tax & Compliance
            </CardTitle>
            <CardDescription>Tax identification for B2B invoicing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tax_id">{jurisdictionConfig.clientTaxIdLabel}</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder={jurisdictionConfig.clientTaxIdPlaceholder}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {jurisdictionConfig.clientTaxIdHint}
              </p>
            </div>

            {formData.client_type === 'company' && jurisdictionConfig.showClientReg && (
              <div className="space-y-2">
                <Label htmlFor="cac_number">{jurisdictionConfig.clientRegLabel}</Label>
                <Input
                  id="cac_number"
                  value={formData.cac_number}
                  onChange={(e) => setFormData({ ...formData, cac_number: e.target.value })}
                  placeholder={jurisdictionConfig.clientRegPlaceholder}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {jurisdictionConfig.clientRegHint}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Client's billing address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={formData.address.street}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  address: { ...formData.address, street: e.target.value } 
                })}
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.address.city}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, city: e.target.value } 
                  })}
                  placeholder="Lagos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.address.state}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, state: e.target.value } 
                  })}
                  placeholder="Lagos"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={formData.address.postal_code}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, postal_code: e.target.value } 
                  })}
                  placeholder="100001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.address.country}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, country: e.target.value } 
                  })}
                  placeholder="Nigeria"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Internal notes about this client</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this client..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
