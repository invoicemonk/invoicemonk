import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Pencil, Trash2, Star } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PaymentMethod } from '@/hooks/use-payment-methods';
import { PROVIDER_TYPES, PROVIDER_INSTRUCTION_FIELDS } from '@/hooks/use-payment-methods';

interface PaymentMethodListProps {
  methods: PaymentMethod[];
  onEdit: (method: PaymentMethod) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
  canManage?: boolean;
  canDelete?: boolean;
}

export function PaymentMethodList({
  methods,
  onEdit,
  onDelete,
  isDeleting,
  canManage = false,
  canDelete = false,
}: PaymentMethodListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (methods.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No payment methods configured for this currency.
      </div>
    );
  }

  const getProviderLabel = (type: string) =>
    PROVIDER_TYPES.find(p => p.value === type)?.label || type;

  const formatInstructions = (providerType: string, instructions: Record<string, string>) => {
    const fields = PROVIDER_INSTRUCTION_FIELDS[providerType] || [];
    return fields
      .filter(f => instructions[f.key])
      .map(f => ({ label: f.label, value: instructions[f.key] }));
  };

  return (
    <>
      <div className="space-y-3">
        {methods.map(method => {
          const instrObj = (method.instructions || {}) as Record<string, string>;
          const formatted = formatInstructions(method.provider_type, instrObj);

          return (
            <Card key={method.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{method.display_name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getProviderLabel(method.provider_type)}
                      </Badge>
                      {method.is_default && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {formatted.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {formatted.map(({ label, value }) => (
                          <div key={label} className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">{label}:</span>
                            <span className="font-mono truncate">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(method)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {canDelete && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(method.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this payment method. It won't affect already-issued invoices (their payment instructions are frozen at issuance).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
