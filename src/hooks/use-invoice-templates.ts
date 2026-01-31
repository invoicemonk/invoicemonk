import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription, SubscriptionTier } from './use-subscription';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  tier_required: SubscriptionTier;
  layout: Record<string, unknown>;
  styles: Record<string, unknown>;
  supports_branding: boolean;
  watermark_required: boolean;
  preview_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TemplateWithAccess extends InvoiceTemplate {
  available: boolean;
  locked_reason?: string;
}

// Tier order for comparison
const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  starter_paid: 1,
  professional: 2,
  business: 3,
};

export function useInvoiceTemplates() {
  const { tier } = useSubscription();

  return useQuery({
    queryKey: ['invoice-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Templates fetch error:', error);
        throw error;
      }

      // Map templates with availability based on user's tier
      return (data || []).map((template): TemplateWithAccess => {
        const available = TIER_ORDER[tier] >= TIER_ORDER[template.tier_required as SubscriptionTier];
        return {
          ...template,
          tier_required: template.tier_required as SubscriptionTier,
          layout: template.layout as Record<string, unknown>,
          styles: template.styles as Record<string, unknown>,
          available,
          locked_reason: available 
            ? undefined 
            : `Requires ${template.tier_required} tier or higher`,
        };
      });
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Admin hook to manage all templates
export function useAdminTemplates() {
  return useQuery({
    queryKey: ['admin-invoice-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('sort_order');

      if (error) {
        console.error('Admin templates fetch error:', error);
        throw error;
      }

      return data as InvoiceTemplate[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      description?: string | null;
      tier_required: SubscriptionTier;
      layout: Record<string, unknown>;
      styles: Record<string, unknown>;
      supports_branding: boolean;
      watermark_required: boolean;
      preview_url?: string | null;
      is_active: boolean;
      sort_order: number;
    }) => {
      const { data, error } = await supabase
        .from('invoice_templates')
        .insert({
          name: template.name,
          description: template.description,
          tier_required: template.tier_required,
          layout: template.layout as unknown as Json,
          styles: template.styles as unknown as Json,
          supports_branding: template.supports_branding,
          watermark_required: template.watermark_required,
          preview_url: template.preview_url,
          is_active: template.is_active,
          sort_order: template.sort_order,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast({
        title: 'Template created',
        description: 'The invoice template has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      layout,
      styles,
      ...updates 
    }: Partial<InvoiceTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (layout) updateData.layout = layout as unknown as Json;
      if (styles) updateData.styles = styles as unknown as Json;

      const { data, error } = await supabase
        .from('invoice_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast({
        title: 'Template updated',
        description: 'The invoice template has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('invoice_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoice-templates'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast({
        title: 'Template deleted',
        description: 'The invoice template has been deactivated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
