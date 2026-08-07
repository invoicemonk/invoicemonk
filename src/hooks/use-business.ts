import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';
import { sanitizeErrorMessage } from '@/lib/error-utils';
import { requireFreshUserId, SessionExpiredError } from '@/lib/session-guard';
import { prepareLogoFile } from '@/lib/logo-image';


import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

export type Business = Tables<'businesses'>;

// Upload business logo
export function useUploadBusinessLogo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ businessId, file }: { businessId: string; file: File }) => {
      if (!user) throw new Error('Not authenticated');

      // Resolve a live user id first: a stale in-memory user makes the storage
      // write reach the server without a valid token, which comes back as a raw
      // row-level-security error.
      const authedUserId = await requireFreshUserId('upload-business-logo', user.id);

      // Downscales oversized images instead of rejecting them.
      const uploadFile = await prepareLogoFile(file);

      const extByType: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/svg+xml': 'svg',
        'image/webp': 'webp',
      };
      const fileExt = extByType[uploadFile.type] ?? 'png';
      // Business-scoped path — the storage access rule reads the first folder
      // segment as the business id.
      const filePath = `${businessId}/logo.${fileExt}`;

      // Clear anything already stored for this business — including the exact
      // target path. Replace-in-place (`upsert`) fails when a storage record
      // exists whose underlying file is gone, so we always upload into an empty
      // slot instead of relying on it.
      const { data: existing, error: listError } = await supabase.storage
        .from('business-logos')
        .list(businessId);

      if (listError) throw await describeLogoUploadError(listError, businessId, authedUserId);

      const toRemove = new Set<string>([filePath, ...(existing ?? []).map((f) => `${businessId}/${f.name}`)]);
      const { error: removeError } = await supabase.storage
        .from('business-logos')
        .remove([...toRemove]);
      // A removal failure is not fatal on its own (the object may simply not
      // exist), but it must not be silent.
      if (removeError) {
        captureError(removeError, { hook: 'useUploadBusinessLogo', stage: 'cleanup', businessId });
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(filePath, uploadFile, { upsert: true, contentType: uploadFile.type });

      if (uploadError) throw await describeLogoUploadError(uploadError, businessId, authedUserId, 'storage-upload');

      // Get public URL (cache-busted so replacements show up immediately)
      const { data: { publicUrl } } = supabase.storage
        .from('business-logos')
        .getPublicUrl(filePath);
      const versionedUrl = `${publicUrl}?v=${Date.now()}`;

      // Update business with logo URL
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ logo_url: versionedUrl })
        .eq('id', businessId);

      if (updateError) throw await describeLogoUploadError(updateError, businessId, authedUserId, 'business-update');

      return versionedUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses-fallback'] });
      toast({
        title: 'Logo uploaded',
        description: 'Your business logo has been updated.',
      });
    },
    onError: (error) => {
      captureError(error, { hook: 'useUploadBusinessLogo' });
      toast({
        // Only the session guard itself can tell us the session is gone; a
        // server-side policy rejection never means that.
        title: error instanceof SessionExpiredError ? 'Session expired' : "Logo couldn't be uploaded",
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

/**
 * Turns a raw storage/database rejection into something a business owner can
 * act on, while keeping the exact technical detail in diagnostics.
 */
async function describeLogoUploadError(
  error: { message?: string },
  businessId: string,
  userId: string,
  stage = 'unknown',
): Promise<Error> {
  const raw = error?.message ?? '';

  const { data: membership } = await supabase
    .from('business_members')
    .select('role, accepted_at')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle();

  captureError(error, {
    hook: 'useUploadBusinessLogo',
    stage,
    businessId,
    userId,
    raw,
    membershipRole: String(membership?.role ?? 'none'),
    membershipAccepted: String(!!membership?.accepted_at),
  });


  if (/row-level security|not authorized|permission|violates/i.test(raw)) {
    if (!membership || !membership.accepted_at) {
      return new Error(
        "You don't have access to this business, so its logo can't be changed. Ask the business owner to invite you, then try again.",
      );
    }
    if (!['owner', 'admin'].includes(membership.role as string)) {
      return new Error('Only an owner or admin of this business can change its logo.');
    }
    return new Error(
      "We couldn't save the logo — the storage service rejected the request. We've logged the details; please try again, and contact support if it keeps happening.",
    );
  }

  if (/exceeded the maximum allowed size|payload too large/i.test(raw)) {
    return new Error('That image is too large to store. Please upload a smaller logo.');
  }

  return error instanceof Error ? error : new Error(raw || 'Logo upload failed.');
}


// Delete business logo
export function useDeleteBusinessLogo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (businessId: string) => {
      if (!user) throw new Error('Not authenticated');

      await requireFreshUserId('delete-business-logo', user.id);

      // Remove every object stored under this business's folder
      const { data: existing, error: listError } = await supabase.storage
        .from('business-logos')
        .list(businessId);

      if (listError) throw listError;

      if (existing?.length) {
        const { error: removeError } = await supabase.storage
          .from('business-logos')
          .remove(existing.map((f) => `${businessId}/${f.name}`));
        if (removeError) throw removeError;
      }

      // Clear logo URL in database
      const { error } = await supabase
        .from('businesses')
        .update({ logo_url: null })
        .eq('id', businessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      toast({
        title: 'Logo removed',
        description: 'Your business logo has been removed.',
      });
    },
    onError: (error) => {
      captureError(error, { hook: 'useDeleteBusinessLogo' });
      toast({
        title: "Logo couldn't be removed",
        description: sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}


// Fetch the current user's business (via business_members)
// Prioritizes the default business
export function useUserBusiness() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-business', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // First try to find user's default business
      const { data: defaultMembership, error: defaultError } = await supabase
        .from('business_members')
        .select(`
          business_id,
          role,
          business:businesses(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(10);

      if (defaultError) throw defaultError;

      // Find the default business first
      const defaultBiz = defaultMembership?.find(m => {
        const biz = m.business as unknown as Business & { is_default?: boolean };
        return biz?.is_default === true;
      });

      if (defaultBiz?.business) {
        return defaultBiz.business as Business;
      }

      // If no default, return the first membership
      if (defaultMembership && defaultMembership.length > 0 && defaultMembership[0].business) {
        return defaultMembership[0].business as Business;
      }

      // If no membership, check if user owns a business directly
      const { data: ownedBusiness, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('created_by', user.id)
        .order('is_default', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (ownedError) throw ownedError;

      return ownedBusiness as Business | null;
    },
    enabled: !!user,
  });
}

// Fetch all businesses for the current user
export function useUserBusinesses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-businesses', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('business_members')
        .select(`
          business_id,
          role,
          business:businesses(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      return (data || []).map(m => ({
        ...m,
        business: m.business as Business,
      }));
    },
    enabled: !!user,
  });
}

// Create a new business for the user
export function useCreateBusiness() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (business: {
      name: string;
      legal_name?: string | null;
      jurisdiction: string;
      tax_id?: string | null;
      contact_email?: string | null;
      contact_phone?: string | null;
      address?: Record<string, string | undefined> | null;
      invoice_prefix?: string | null;
      business_type?: string | null;
      default_currency?: string | null;
      is_default?: boolean;
    }) => {

      if (!user) throw new Error('Not authenticated');

      // The in-memory user can outlive its token (failed refresh, long-idle tab).
      // Resolve the live user id first so the insert always carries a valid JWT
      // and a `created_by` the RLS policy will accept.
      const authedUserId = await requireFreshUserId('create-business', user.id);

      // Split sensitive fields out — they live in business_sensitive_data, not businesses
      const { tax_id, ...businessCore } = business;

      // Create the business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          ...businessCore,
          created_by: authedUserId,
          is_default: business.is_default ?? false,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Persist sensitive fields if any were provided
      if (tax_id) {
        const { error: sensitiveError } = await supabase
          .from('business_sensitive_data')
          .upsert(
            { business_id: newBusiness.id, tax_id: tax_id || null },
            { onConflict: 'business_id' }
          );
        if (sensitiveError) {
          console.error('Failed to save business sensitive data:', sensitiveError);
        }
      }

      // Note: The database trigger `add_business_creator_as_owner` automatically
      // adds the creator as an owner in business_members, so we don't need to do it here.
      // The database trigger `on_business_created_subscription` automatically creates
      // a starter subscription for the new business.

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'BUSINESS_CREATED',
        _entity_type: 'business',
        _entity_id: newBusiness.id,
        _user_id: authedUserId,
        _new_state: newBusiness,
      });

      return newBusiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      toast({
        title: 'Business created',
        description: 'Your business profile has been created.',
      });
    },
    onError: (error) => {
      captureError(error, { hook: 'useCreateBusiness' });
      const isSessionIssue =
        error instanceof SessionExpiredError ||
        /row-level security policy/i.test(error.message);
      toast({
        title: isSessionIssue ? 'Session expired' : 'Error creating business',
        description: isSessionIssue
          ? "We couldn't create the business because your session expired. Sign in again and retry."
          : sanitizeErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

// Update an existing business
export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      businessId, 
      updates 
    }: { 
      businessId: string; 
      updates: TablesUpdate<'businesses'>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Get current state for audit log and self-declared check
      const { data: currentBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      // Defensively strip sensitive fields — they live in business_sensitive_data,
      // not on businesses. BusinessProfile already routes them separately.
      const SENSITIVE_KEYS = [
        'tax_id', 'government_id_type', 'government_id_value',
        'vat_registration_number', 'cac_number',
        'stripe_connect_account_id', 'paystack_subaccount_code', 'flag_reason',
      ] as const;
      const updatesAny = updates as any;
      for (const k of SENSITIVE_KEYS) delete updatesAny[k];

      // Auto-upgrade to self_declared if legal_name/jurisdiction is being set
      // and business is currently unverified (skip for individuals — they need doc verification)
      const currentVerification = (currentBusiness as any)?.verification_status || 'unverified';
      const currentEntityType = (currentBusiness as any)?.entity_type || 'business';
      if (currentVerification === 'unverified' && currentEntityType !== 'individual') {
        const hasLegalName = updatesAny.legal_name && updatesAny.legal_name.trim();
        if (hasLegalName) {
          updatesAny.verification_status = 'self_declared';
          updatesAny.verification_source = 'none';
        }
      }

      const { data: updatedBusiness, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', businessId)
        .select()
        .single();

      if (error) throw error;

      // Warn user if their verification was downgraded by the DB trigger
      if (currentVerification === 'verified') {
        const sensitiveDiff =
          (currentBusiness as any)?.legal_name !== updatesAny.legal_name ||
          (currentBusiness as any)?.jurisdiction !== updatesAny.jurisdiction;
        if (sensitiveDiff && (updatedBusiness as any)?.verification_status === 'pending_review') {
          toast({
            title: 'Verification status reset',
            description: 'Your verification status has been reset because you changed sensitive fields. It will need to be re-verified.',
            variant: 'destructive',
          });
        }
      }

      // Log audit event
      await supabase.rpc('log_audit_event', {
        _event_type: 'BUSINESS_UPDATED',
        _entity_type: 'business',
        _entity_id: businessId,
        _user_id: user.id,
        _previous_state: currentBusiness,
        _new_state: updatedBusiness,
      });

      return updatedBusiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-business'] });
      queryClient.invalidateQueries({ queryKey: ['user-businesses'] });
      toast({
        title: 'Profile saved',
        description: 'Your business profile has been updated.',
      });
    },
    onError: (error) => {
      captureError(error, { hook: 'useUpdateBusiness' });
      toast({
        title: 'Error saving profile',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
