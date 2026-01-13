import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Tables } from '@/integrations/supabase/types';

type Business = Tables<'businesses'>;
type BusinessMember = Tables<'business_members'>;
type BusinessRole = 'owner' | 'admin' | 'member' | 'auditor';

interface OrganizationMembership extends BusinessMember {
  business: Business;
}

interface OrganizationContextType {
  currentOrg: Business | null;
  currentRole: BusinessRole | null;
  memberships: OrganizationMembership[];
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isAuditor: boolean;
  canManageTeam: boolean;
  canCreateInvoices: boolean;
  canViewReports: boolean;
  canEditSettings: boolean;
  switchOrg: (orgId: string) => void;
  refreshOrg: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [currentOrg, setCurrentOrg] = useState<Business | null>(null);
  const [currentRole, setCurrentRole] = useState<BusinessRole | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemberships = async () => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('business_members')
        .select(`
          *,
          business:businesses(*)
        `)
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const typedData = (data || []).map(item => ({
        ...item,
        business: item.business as unknown as Business,
      })) as OrganizationMembership[];

      setMemberships(typedData);
    } catch (err) {
      console.error('Error fetching memberships:', err);
      setError('Failed to load organizations');
    }
  };

  const fetchCurrentOrg = async () => {
    if (!orgId || !user) {
      setCurrentOrg(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch business details
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', orgId)
        .single();

      if (businessError) {
        if (businessError.code === 'PGRST116') {
          setError('Organization not found');
          navigate('/dashboard');
          return;
        }
        throw businessError;
      }

      // Fetch user's role in this business
      const { data: membership, error: memberError } = await supabase
        .from('business_members')
        .select('role')
        .eq('business_id', orgId)
        .eq('user_id', user.id)
        .single();

      if (memberError) {
        if (memberError.code === 'PGRST116') {
          setError('You are not a member of this organization');
          navigate('/dashboard');
          return;
        }
        throw memberError;
      }

      setCurrentOrg(business);
      setCurrentRole(membership.role as BusinessRole);
    } catch (err) {
      console.error('Error fetching organization:', err);
      setError('Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  const refreshOrg = async () => {
    await Promise.all([fetchMemberships(), fetchCurrentOrg()]);
  };

  const switchOrg = (newOrgId: string) => {
    navigate(`/org/${newOrgId}/dashboard`);
  };

  useEffect(() => {
    fetchMemberships();
  }, [user]);

  useEffect(() => {
    fetchCurrentOrg();
  }, [orgId, user]);

  // Role-based permissions
  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin' || isOwner;
  const isMember = currentRole === 'member' || isAdmin;
  const isAuditor = currentRole === 'auditor';

  // Permission helpers
  const canManageTeam = isOwner || isAdmin;
  const canCreateInvoices = isMember && !isAuditor;
  const canViewReports = true; // All roles can view reports
  const canEditSettings = isOwner || isAdmin;

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        currentRole,
        memberships,
        loading,
        error,
        isOwner,
        isAdmin,
        isMember,
        isAuditor,
        canManageTeam,
        canCreateInvoices,
        canViewReports,
        canEditSettings,
        switchOrg,
        refreshOrg,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
