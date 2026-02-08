import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
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
      const message = error?.message || 'Failed to delete business';
      toast({
        title: 'Cannot delete business',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
