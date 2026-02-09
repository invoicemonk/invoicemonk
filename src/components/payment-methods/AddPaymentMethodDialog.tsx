import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PaymentMethodForm } from './PaymentMethodForm';
import { useCreatePaymentMethod, useUpdatePaymentMethod, type PaymentMethod } from '@/hooks/use-payment-methods';

interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  currencyAccountId: string;
  currencyCode?: string;
  editMethod?: PaymentMethod | null;
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  businessId,
  currencyAccountId,
  currencyCode,
  editMethod,
}: AddPaymentMethodDialogProps) {
  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();

  const isEditing = !!editMethod;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (values: {
    provider_type: string;
    display_name: string;
    instructions: Record<string, string>;
    is_default: boolean;
  }) => {
    if (isEditing && editMethod) {
      await updateMutation.mutateAsync({
        id: editMethod.id,
        currency_account_id: currencyAccountId,
        display_name: values.display_name,
        instructions: values.instructions,
        is_default: values.is_default,
      });
    } else {
      await createMutation.mutateAsync({
        business_id: businessId,
        currency_account_id: currencyAccountId,
        provider_type: values.provider_type,
        display_name: values.display_name,
        instructions: values.instructions,
        is_default: values.is_default,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update how you receive payments for this currency.'
              : 'Configure how clients can pay you for this currency.'}
          </DialogDescription>
        </DialogHeader>
        <PaymentMethodForm
          initialValues={
            editMethod
              ? {
                  provider_type: editMethod.provider_type,
                  display_name: editMethod.display_name,
                  instructions: (editMethod.instructions || {}) as Record<string, string>,
                  is_default: editMethod.is_default,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          currencyCode={currencyCode}
        />
      </DialogContent>
    </Dialog>
  );
}
