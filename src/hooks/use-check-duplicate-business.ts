import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicateBusinessName?: string;
}

export function useCheckDuplicateBusinessName(
  name: string | undefined,
  jurisdiction: string | undefined,
  currentBusinessId?: string
) {
  return useQuery({
    queryKey: ['check-duplicate-business', name?.toLowerCase(), jurisdiction?.toLowerCase(), currentBusinessId],
    queryFn: async (): Promise<DuplicateCheckResult> => {
      if (!name || !jurisdiction) {
        return { hasDuplicate: false };
      }

      let query = supabase
        .from('businesses')
        .select('id, name')
        .ilike('name', name)
        .eq('jurisdiction', jurisdiction);

      // Exclude current business if editing
      if (currentBusinessId) {
        query = query.neq('id', currentBusinessId);
      }

      const { data, error } = await query.limit(1);
      
      if (error) {
        console.error('Error checking duplicate business:', error);
        return { hasDuplicate: false };
      }

      if (data && data.length > 0) {
        return {
          hasDuplicate: true,
          duplicateBusinessName: data[0].name,
        };
      }

      return { hasDuplicate: false };
    },
    enabled: !!name && name.length > 2 && !!jurisdiction,
    staleTime: 5000, // Cache for 5 seconds to avoid excessive queries
  });
}
