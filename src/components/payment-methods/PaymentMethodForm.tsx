import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROVIDER_TYPES, PROVIDER_INSTRUCTION_FIELDS, type ProviderType } from '@/hooks/use-payment-methods';

interface PaymentMethodFormProps {
  initialValues?: {
    provider_type: string;
    display_name: string;
    instructions: Record<string, string>;
    is_default: boolean;
  };
  onSubmit: (values: {
    provider_type: string;
    display_name: string;
    instructions: Record<string, string>;
    is_default: boolean;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  currencyCode?: string;
}

export function PaymentMethodForm({
  initialValues,
  onSubmit,
  onCancel,
  isLoading,
  currencyCode,
}: PaymentMethodFormProps) {
  const [providerType, setProviderType] = useState<string>(initialValues?.provider_type || '');
  const [displayName, setDisplayName] = useState(initialValues?.display_name || '');
  const [instructions, setInstructions] = useState<Record<string, string>>(
    initialValues?.instructions || {}
  );
  const [isDefault, setIsDefault] = useState(initialValues?.is_default || false);

  const fields = PROVIDER_INSTRUCTION_FIELDS[providerType] || [];

  const handleProviderChange = (value: string) => {
    setProviderType(value);
    setInstructions({});
    // Auto-suggest display name
    const provider = PROVIDER_TYPES.find(p => p.value === value);
    if (provider && !displayName) {
      setDisplayName(`${provider.label}${currencyCode ? ` (${currencyCode})` : ''}`);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setInstructions(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ provider_type: providerType, display_name: displayName, instructions, is_default: isDefault });
  };

  const requiredFields = fields.filter(f => f.required);
  const isValid = providerType && displayName && requiredFields.every(f => instructions[f.key]?.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Provider Type</Label>
        <Select value={providerType} onValueChange={handleProviderChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select how you receive payments" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_TYPES.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Display Name</Label>
        <Input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Bank Transfer (NGN)"
        />
      </div>

      {fields.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground">Payment Details</p>
          {fields.map(field => (
            <div key={field.key} className="space-y-1">
              <Label className="text-sm">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Input
                value={instructions[field.key] || ''}
                onChange={e => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={isDefault} onCheckedChange={setIsDefault} id="is-default" />
        <Label htmlFor="is-default" className="text-sm">Set as default for this currency</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || isLoading}>
          {isLoading ? 'Saving...' : initialValues ? 'Update' : 'Add Payment Method'}
        </Button>
      </div>
    </form>
  );
}
