import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';
import { useNavigate } from 'react-router-dom';

export function useDeleteBusiness() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (businessId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('delete_empty_business', {
        _business_id: businessId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      toast({
        title: 'Business deleted',
        description: 'The business has been permanently removed.',
      });
      // Navigate to dashboard — BusinessContext will resolve to the default business
      navigate('/dashboard');
    },
    onError: (error: any) => {
      captureError(error, { hook: 'useDeleteBusiness' });
      const raw = error?.message || '';
      // Raw database permission errors are meaningless to users.
      const message = /permission denied/i.test(raw)
        ? "You don't have permission to delete this business. Only the owner can delete a business, and it can't be your primary one."
        : raw || 'Failed to delete business';
      toast({
        title: 'Cannot delete business',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
