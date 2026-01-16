import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface UserPreferences {
  user_id: string;
  email_invoice_issued: boolean;
  email_payment_received: boolean;
  email_payment_reminders: boolean;
  email_overdue_alerts: boolean;
  browser_notifications: boolean;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
}

// Default preferences for new users
const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  email_invoice_issued: true,
  email_payment_received: true,
  email_payment_reminders: false,
  email_overdue_alerts: true,
  browser_notifications: false,
  reminder_days_before: 3,
};

// Fetch user preferences
export function useUserPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Try to fetch existing preferences
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching preferences:', error);
        throw error;
      }

      // If no preferences exist, create default ones
      if (!data) {
        const newPreferences = {
          user_id: user.id,
          ...DEFAULT_PREFERENCES,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('user_preferences')
          .insert(newPreferences)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating default preferences:', insertError);
          // Return defaults if insert fails (might be race condition)
          return {
            ...newPreferences,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as UserPreferences;
        }

        return inserted as UserPreferences;
      }

      return data as UserPreferences;
    },
    enabled: !!user,
  });
}

// Update user preferences
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user) throw new Error('Not authenticated');

      // Upsert preferences
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.error('Error updating preferences:', error);
        throw error;
      }

      // Log audit event for settings change
      await supabase.rpc('log_audit_event', {
        _event_type: 'SETTINGS_UPDATED',
        _entity_type: 'user_preferences',
        _entity_id: user.id,
        _user_id: user.id,
        _new_state: JSON.parse(JSON.stringify(data)),
      });

      return data as UserPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving preferences',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
