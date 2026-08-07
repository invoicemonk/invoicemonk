import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TourProgressRow {
  tour_id: string;
  status: string;
  last_step: number;
}

/** All tour progress rows for the signed-in user, keyed by tour id. */
export function useTourProgress() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tour-progress', user?.id],
    queryFn: async (): Promise<Record<string, TourProgressRow>> => {
      if (!user) return {};
      const { data, error } = await supabase
        .from('user_tour_progress')
        .select('tour_id, status, last_step')
        .eq('user_id', user.id);
      if (error) throw error;
      const map: Record<string, TourProgressRow> = {};
      for (const row of data ?? []) map[row.tour_id] = row as TourProgressRow;
      return map;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveTourProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      tourId: string;
      status: 'completed' | 'skipped';
      lastStep: number;
    }) => {
      if (!user) return;
      const { error } = await supabase.from('user_tour_progress').upsert(
        {
          user_id: user.id,
          tour_id: input.tourId,
          status: input.status,
          last_step: input.lastStep,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tour_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-progress', user?.id] });
    },
    onError: (err) => {
      // Progress tracking must never break the tour itself.
      console.warn('[tours] failed to save progress:', err);
    },
  });
}

export function useResetTourProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tourId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from('user_tour_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('tour_id', tourId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-progress', user?.id] });
    },
  });
}
