import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateRetentionPolicy,
  useUpdateRetentionPolicy,
  type RetentionPolicy,
} from '@/hooks/use-admin-retention-policies';

const JURISDICTIONS = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
];

const ENTITY_TYPES = [
  { value: 'invoice', label: 'Invoices' },
  { value: 'payment', label: 'Payments' },
  { value: 'credit_note', label: 'Credit Notes' },
  { value: 'audit_log', label: 'Audit Logs' },
  { value: 'export_manifest', label: 'Export Records' },
  { value: 'client', label: 'Clients' },
  { value: 'business', label: 'Businesses' },
];

const formSchema = z.object({
  jurisdiction: z.string().min(2, 'Jurisdiction is required'),
  entity_type: z.string().min(1, 'Entity type is required'),
  retention_years: z.coerce.number().min(1, 'Must be at least 1 year').max(100, 'Cannot exceed 100 years'),
  legal_basis: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RetentionPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: RetentionPolicy | null;
}

export function RetentionPolicyDialog({
  open,
  onOpenChange,
  policy,
}: RetentionPolicyDialogProps) {
  const isEditing = !!policy;
  const createMutation = useCreateRetentionPolicy();
  const updateMutation = useUpdateRetentionPolicy();
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jurisdiction: '',
      entity_type: '',
      retention_years: 7,
      legal_basis: '',
    },
  });

  useEffect(() => {
    if (policy) {
      form.reset({
        jurisdiction: policy.jurisdiction,
        entity_type: policy.entity_type,
        retention_years: policy.retention_years,
        legal_basis: policy.legal_basis || '',
      });
    } else {
      form.reset({
        jurisdiction: '',
        entity_type: '',
        retention_years: 7,
        legal_basis: '',
      });
    }
  }, [policy, form]);

  const handleSubmit = async (values: FormValues) => {
    if (isEditing && policy) {
      await updateMutation.mutateAsync({
        id: policy.id,
        ...values,
        legal_basis: values.legal_basis || null,
      });
    } else {
      await createMutation.mutateAsync({
        entity_type: values.entity_type,
        jurisdiction: values.jurisdiction,
        retention_years: values.retention_years,
        legal_basis: values.legal_basis || undefined,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Retention Policy' : 'Add Retention Policy'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the retention policy details below.'
              : 'Create a new data retention policy for a specific jurisdiction.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="jurisdiction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jurisdiction</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select jurisdiction" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JURISDICTIONS.map((j) => (
                        <SelectItem key={j.code} value={j.code}>
                          {j.flag} {j.name} ({j.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ENTITY_TYPES.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="retention_years"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retention Period (Years)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    How long records must be retained
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legal_basis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Basis (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., FIRS Tax Regulations Section 45, Companies Income Tax Act"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Reference to the specific law or regulation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditing ? (
                  'Update Policy'
                ) : (
                  'Create Policy'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
