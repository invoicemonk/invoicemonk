import { useState, useEffect } from 'react';
import { stripUrls } from '@/lib/utils';
import {
  Building2,
  User,
  Info,
  MapPin,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateClient } from '@/hooks/use-clients';
import { useBusiness } from '@/contexts/BusinessContext';
import { getJurisdictionConfig } from '@/lib/jurisdiction-config';
import { COUNTRY_OPTIONS_WITH_OTHER } from '@/lib/countries';
import { gaEvents } from '@/hooks/use-google-analytics';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated?: (clientId: string) => void;
}

const EMPTY_CLIENT = {
  name: '',
  email: '',
  phone: '',
  tax_id: '',
  client_type: 'company' as 'individual' | 'company',
  cac_number: '',
  contact_person: '',
  notes: '',
  address: {
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  },
};

export function AddClientDialog({ open, onOpenChange, onClientCreated }: AddClientDialogProps) {
  const { currentBusiness } = useBusiness();
  const createClient = useCreateClient();

  const [clientCountry, setClientCountry] = useState(currentBusiness?.jurisdiction || 'NG');
  const jurisdictionConfig = getJurisdictionConfig(clientCountry);

  const [newClient, setNewClient] = useState({ ...EMPTY_CLIENT });
  const [showAddress, setShowAddress] = useState(false);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setClientCountry(currentBusiness?.jurisdiction || 'NG');
      setNewClient({ ...EMPTY_CLIENT });
      setShowAddress(false);
    }
  }, [open, currentBusiness?.jurisdiction]);

  // Auto-fill country name when client country changes
  useEffect(() => {
    if (clientCountry !== 'OTHER') {
      setNewClient(prev => ({
        ...prev,
        address: {
          ...prev.address,
          country: jurisdictionConfig.countryName,
        },
      }));
    }
  }, [clientCountry, jurisdictionConfig.countryName]);

  const handleAddClient = async () => {
    if (!newClient.name) return;

    const hasAddress = Object.values(newClient.address).some(v => v.trim() !== '');
    const addressData = hasAddress ? newClient.address : null;

    const result = await createClient.mutateAsync({
      name: newClient.name,
      email: newClient.email || null,
      phone: newClient.phone || null,
      tax_id: newClient.tax_id || null,
      client_type: newClient.client_type,
      cac_number: newClient.client_type === 'company' ? (newClient.cac_number || null) : null,
      contact_person: newClient.client_type === 'company' ? (newClient.contact_person || null) : null,
      notes: newClient.notes ? stripUrls(newClient.notes) : null,
      address: addressData,
      business_id: currentBusiness?.id,
    });

    gaEvents.clientCreated();

    if (result) {
      onClientCreated?.(result.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Add a new client for compliance-ready invoicing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Client Type */}
          <div className="space-y-3">
            <Label>Client Type</Label>
            <RadioGroup
              value={newClient.client_type}
              onValueChange={(v) => setNewClient({ ...newClient, client_type: v as 'individual' | 'company' })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="company" id="dialog-company" />
                <Label htmlFor="dialog-company" className="flex items-center gap-1.5 cursor-pointer">
                  <Building2 className="h-4 w-4" />
                  Company
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="dialog-individual" />
                <Label htmlFor="dialog-individual" className="flex items-center gap-1.5 cursor-pointer">
                  <User className="h-4 w-4" />
                  Individual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="dialog-name">
              {newClient.client_type === 'company' ? 'Company Name' : 'Full Name'} *
            </Label>
            <Input
              id="dialog-name"
              placeholder={newClient.client_type === 'company' ? 'Acme Corporation Ltd.' : 'John Doe'}
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
          </div>

          {/* Contact Person (for companies) */}
          {newClient.client_type === 'company' && (
            <div className="space-y-2">
              <Label htmlFor="dialog-contact_person">Contact Person</Label>
              <Input
                id="dialog-contact_person"
                placeholder="Jane Smith"
                value={newClient.contact_person}
                onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
              />
            </div>
          )}

          {/* Client Country */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Client Location
            </Label>
            <Select value={clientCountry} onValueChange={setClientCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS_WITH_OTHER.map(country => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-email">Email</Label>
              <Input
                id="dialog-email"
                type="email"
                placeholder="client@example.com"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-phone">Phone</Label>
              <Input
                id="dialog-phone"
                type="tel"
                placeholder={`${jurisdictionConfig.phonePrefix} ...`}
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Tax & Compliance */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-muted-foreground" />
              Tax & Compliance
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-tax_id">{jurisdictionConfig.clientTaxIdLabel}</Label>
              <Input
                id="dialog-tax_id"
                placeholder={jurisdictionConfig.clientTaxIdPlaceholder}
                value={newClient.tax_id}
                onChange={(e) => setNewClient({ ...newClient, tax_id: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {jurisdictionConfig.clientTaxIdHint}
              </p>
            </div>

            {newClient.client_type === 'company' && jurisdictionConfig.showClientReg && (
              <div className="space-y-2">
                <Label htmlFor="dialog-cac_number">{jurisdictionConfig.clientRegLabel}</Label>
                <Input
                  id="dialog-cac_number"
                  placeholder={jurisdictionConfig.clientRegPlaceholder}
                  value={newClient.cac_number}
                  onChange={(e) => setNewClient({ ...newClient, cac_number: e.target.value })}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {jurisdictionConfig.clientRegHint}
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="dialog-notes">Notes</Label>
            <Textarea
              id="dialog-notes"
              placeholder="Add any notes about this client..."
              value={newClient.notes}
              onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Address Section */}
          <Collapsible open={showAddress} onOpenChange={setShowAddress} className="space-y-2 pt-2 border-t">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Address (Optional)
                </div>
                {showAddress ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="dialog-street">Street Address</Label>
                <Input
                  id="dialog-street"
                  placeholder="123 Main Street"
                  value={newClient.address.street}
                  onChange={(e) => setNewClient({
                    ...newClient,
                    address: { ...newClient.address, street: e.target.value },
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dialog-city">City</Label>
                  <Input
                    id="dialog-city"
                    placeholder={jurisdictionConfig.cityPlaceholder}
                    value={newClient.address.city}
                    onChange={(e) => setNewClient({
                      ...newClient,
                      address: { ...newClient.address, city: e.target.value },
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dialog-state">{jurisdictionConfig.stateLabel}</Label>
                  <Input
                    id="dialog-state"
                    placeholder={jurisdictionConfig.statePlaceholder}
                    value={newClient.address.state}
                    onChange={(e) => setNewClient({
                      ...newClient,
                      address: { ...newClient.address, state: e.target.value },
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dialog-postal_code">{jurisdictionConfig.postalCodeLabel}</Label>
                  <Input
                    id="dialog-postal_code"
                    placeholder={jurisdictionConfig.postalCodePlaceholder}
                    value={newClient.address.postal_code}
                    onChange={(e) => setNewClient({
                      ...newClient,
                      address: { ...newClient.address, postal_code: e.target.value },
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dialog-country">Country</Label>
                  <Input
                    id="dialog-country"
                    placeholder={clientCountry === 'OTHER' ? 'Enter country' : jurisdictionConfig.countryName}
                    value={newClient.address.country}
                    onChange={(e) => setNewClient({
                      ...newClient,
                      address: { ...newClient.address, country: e.target.value },
                    })}
                    disabled={clientCountry !== 'OTHER'}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddClient}
            disabled={!newClient.name || createClient.isPending}
          >
            {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
