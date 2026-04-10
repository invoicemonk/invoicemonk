import { useState, useEffect, useMemo } from 'react';
import { stripUrls } from '@/lib/utils';
import { INPUT_LIMITS } from '@/lib/input-limits';
import {
  Building2,
  User,
  Info,
  MapPin,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useCreateClient, useClients } from '@/hooks/use-clients';
import { useBusiness } from '@/contexts/BusinessContext';
import { getJurisdictionConfig } from '@/lib/jurisdiction-config';
import { COUNTRY_OPTIONS_WITH_OTHER } from '@/lib/countries';
import { gaEvents } from '@/hooks/use-google-analytics';
import { validateClient, validateClientName, validateClientEmail, validateClientPhone, validateClientTaxId } from '@/lib/client-validation';

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
  const { data: existingClients = [] } = useClients(currentBusiness?.id);

  const [clientCountry, setClientCountry] = useState(currentBusiness?.jurisdiction || 'NG');
  const jurisdictionConfig = getJurisdictionConfig(clientCountry);

  const [newClient, setNewClient] = useState({ ...EMPTY_CLIENT });
  const [showAddress, setShowAddress] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setClientCountry(currentBusiness?.jurisdiction || 'NG');
      setNewClient({ ...EMPTY_CLIENT });
      setShowAddress(false);
      setTouched({});
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

  // Validation
  const validation = useMemo(
    () => validateClient(newClient, clientCountry),
    [newClient.name, newClient.email, newClient.phone, newClient.tax_id, newClient.client_type, clientCountry],
  );

  // Duplicate detection
  const duplicateWarning = useMemo(() => {
    const email = newClient.email.trim().toLowerCase();
    if (email) {
      const dup = existingClients.find(c => c.email?.toLowerCase() === email);
      if (dup) return `A client with this email already exists: "${dup.name}"`;
    }
    const name = newClient.name.trim().toLowerCase();
    if (name && name.length >= 3) {
      const dup = existingClients.find(c => c.name.toLowerCase() === name);
      if (dup) return `A client with this exact name already exists`;
    }
    return null;
  }, [newClient.name, newClient.email, existingClients]);

  const allWarnings = [...validation.warnings, ...(duplicateWarning ? [duplicateWarning] : [])];

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const handleAddClient = async () => {
    if (!validation.valid) return;

    const hasAddress = Object.values(newClient.address).some(v => v.trim() !== '');
    const addressData = hasAddress ? newClient.address : null;

    const result = await createClient.mutateAsync({
      name: newClient.name.trim(),
      email: newClient.email.trim() || null,
      phone: newClient.phone.trim() || null,
      tax_id: newClient.tax_id.trim() || null,
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

  const fieldError = (field: string) =>
    touched[field] ? validation.errors[field] : undefined;

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
          {/* Warnings */}
          {allWarnings.length > 0 && (
            <div className="space-y-2">
              {allWarnings.map((w, i) => (
                <Alert key={i} className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-sm">
                    {w}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

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
              onBlur={() => markTouched('name')}
              maxLength={INPUT_LIMITS.NAME}
              className={fieldError('name') ? 'border-destructive' : ''}
            />
            {fieldError('name') && (
              <p className="text-xs text-destructive">{fieldError('name')}</p>
            )}
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
                maxLength={INPUT_LIMITS.NAME}
              />
            </div>
          )}

          {/* Client Country */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Client Location *
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
              <Label htmlFor="dialog-email">Email *</Label>
              <Input
                id="dialog-email"
                type="email"
                placeholder="client@example.com"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                onBlur={() => markTouched('email')}
                maxLength={INPUT_LIMITS.EMAIL}
                className={fieldError('email') ? 'border-destructive' : ''}
              />
              {fieldError('email') && (
                <p className="text-xs text-destructive">{fieldError('email')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-phone">Phone</Label>
              <Input
                id="dialog-phone"
                type="tel"
                placeholder={`${jurisdictionConfig.phonePrefix} ...`}
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                onBlur={() => markTouched('phone')}
                maxLength={INPUT_LIMITS.PHONE}
                className={fieldError('phone') ? 'border-destructive' : ''}
              />
              {fieldError('phone') && (
                <p className="text-xs text-destructive">{fieldError('phone')}</p>
              )}
            </div>
          </div>

          {/* Tax & Compliance */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-muted-foreground" />
              Tax & Compliance
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-tax_id">
                {jurisdictionConfig.clientTaxIdLabel}
                {jurisdictionConfig.clientTaxIdRequired && ' *'}
              </Label>
              <Input
                id="dialog-tax_id"
                placeholder={jurisdictionConfig.clientTaxIdPlaceholder}
                value={newClient.tax_id}
                onChange={(e) => setNewClient({ ...newClient, tax_id: e.target.value })}
                onBlur={() => markTouched('tax_id')}
                className={`font-mono ${fieldError('tax_id') ? 'border-destructive' : ''}`}
                maxLength={INPUT_LIMITS.TAX_ID}
              />
              {fieldError('tax_id') ? (
                <p className="text-xs text-destructive">{fieldError('tax_id')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {jurisdictionConfig.clientTaxIdHint}
                </p>
              )}
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
                  maxLength={INPUT_LIMITS.REG_NUMBER}
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
              maxLength={INPUT_LIMITS.TEXTAREA}
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
                  maxLength={INPUT_LIMITS.ADDRESS_LINE}
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
                      maxLength={INPUT_LIMITS.ADDRESS_LINE}
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
                      maxLength={INPUT_LIMITS.ADDRESS_LINE}
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
                      maxLength={INPUT_LIMITS.POSTAL_CODE}
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
            disabled={!validation.valid || createClient.isPending}
          >
            {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
