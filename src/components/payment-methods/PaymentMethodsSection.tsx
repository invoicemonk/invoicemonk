import { useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyAccounts } from '@/hooks/use-currency-accounts';
import {
  usePaymentMethodsByBusiness,
  useDeletePaymentMethod,
  usePaymentMethodLimit,
  type PaymentMethod,
} from '@/hooks/use-payment-methods';
import { PaymentMethodList } from './PaymentMethodList';
import { AddPaymentMethodDialog } from './AddPaymentMethodDialog';

interface PaymentMethodsSectionProps {
  businessId: string;
  canManage: boolean;
  canDelete: boolean;
}

export function PaymentMethodsSection({ businessId, canManage, canDelete }: PaymentMethodsSectionProps) {
  const { data: currencyAccounts, isLoading: loadingAccounts } = useCurrencyAccounts(businessId);
  const { data: allMethods, isLoading: loadingMethods } = usePaymentMethodsByBusiness(businessId);
  const deleteMutation = useDeletePaymentMethod();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);

  const selectedAccount = currencyAccounts?.find(a => a.id === selectedAccountId);

  const handleAdd = (accountId: string) => {
    setSelectedAccountId(accountId);
    setEditMethod(null);
    setDialogOpen(true);
  };

  const handleEdit = (method: PaymentMethod) => {
    setSelectedAccountId(method.currency_account_id);
    setEditMethod(method);
    setDialogOpen(true);
  };

  if (loadingAccounts || loadingMethods) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!currencyAccounts?.length) {
    return null; // No currency accounts configured yet
  }

  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>
            Configure how clients can pay you. Payment instructions appear on invoices and receipts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currencyAccounts.map(account => {
            const methods = allMethods?.filter(m => m.currency_account_id === account.id) || [];

            return (
              <div key={account.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {account.currency}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {account.name || `${account.currency} Account`}
                    </span>
                    {account.is_default && (
                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAdd(account.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                <PaymentMethodList
                  methods={methods}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isDeleting={deleteMutation.isPending}
                  canManage={canManage}
                  canDelete={canDelete}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {selectedAccountId && (
        <AddPaymentMethodDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          businessId={businessId}
          currencyAccountId={selectedAccountId}
          currencyCode={selectedAccount?.currency}
          editMethod={editMethod}
        />
      )}
    </>
  );
}
