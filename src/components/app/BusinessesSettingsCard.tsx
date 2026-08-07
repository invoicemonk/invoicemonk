import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, User, Loader2, Trash2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DeleteBusinessDialog } from '@/components/app/DeleteBusinessDialog';
import { useDeleteBusiness } from '@/hooks/use-delete-business';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface BusinessRow {
  id: string;
  name: string;
  is_default: boolean | null;
  default_currency: string | null;
  business_type: string | null;
}

/**
 * Lists every business the signed-in user belongs to, with switch and delete
 * actions. Lives in Settings so business management isn't hidden inside the
 * sidebar dropdown.
 */
export function BusinessesSettingsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteBusiness = useDeleteBusiness();
  const [toDelete, setToDelete] = useState<BusinessRow | null>(null);

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['settings-businesses', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_members')
        .select('business_id, business:businesses(id, name, is_default, default_currency, business_type)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? [])
        .map((row: any) => row.business)
        .filter(Boolean) as BusinessRow[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Businesses</CardTitle>
        <CardDescription>
          Switch between businesses or remove ones you no longer need.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading businesses...
          </div>
        )}

        {!isLoading && businesses.length === 0 && (
          <p className="text-sm text-muted-foreground">No businesses found.</p>
        )}

        <TooltipProvider>
          {businesses.map((b) => {
            const isPrimary = !!b.is_default;
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
              >
                {isPrimary ? (
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{b.name}</span>
                    {isPrimary && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {b.default_currency
                      ? `Invoices in ${b.default_currency}`
                      : 'No invoicing currency set yet'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => navigate(`/b/${b.id}/dashboard`)}
                >
                  Open <ArrowRight className="h-4 w-4" />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPrimary}
                        aria-label={`Delete ${b.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(b)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPrimary
                      ? 'Your primary business cannot be deleted.'
                      : 'Delete this business (only possible while it has no invoices, credit notes or receipts).'}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </CardContent>

      <DeleteBusinessDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        businessName={toDelete?.name ?? ''}
        isPending={deleteBusiness.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteBusiness.mutateAsync(toDelete.id);
            setToDelete(null);
            await queryClient.invalidateQueries({ queryKey: ['settings-businesses'] });
          } catch {
            // error toast handled in the hook
          }
        }}
      />
    </Card>
  );
}