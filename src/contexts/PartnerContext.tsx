import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface PartnerProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  payout_method: string | null;
  payout_details: Record<string, unknown> | null;
  commission_rate: number;
  status: string;
  created_at: string;
}

interface PartnerContextType {
  isPartner: boolean;
  loading: boolean;
  error: string | null;
  partner: PartnerProfile | null;
  refreshPartner: () => Promise<void>;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export const PartnerProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);

  const fetchPartner = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      // Check partner role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'partner')
        .maybeSingle();

      if (roleError) throw roleError;

      // Also allow platform admins to view partner area
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'platform_admin')
        .maybeSingle();

      if (!roleData && !adminRole) {
        setIsPartner(false);
        setError('Access denied. Partner privileges required.');
        navigate('/dashboard');
        return;
      }

      // Fetch partner profile
      const { data: partnerData, error: partnerError } = await supabase
        .from('referral_partners')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (partnerError) throw partnerError;

      if (partnerData) {
        setPartner(partnerData as PartnerProfile);
      }
      setIsPartner(true);
    } catch (err) {
      console.error('Error checking partner role:', err);
      setError('Failed to verify partner access');
      setIsPartner(false);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsPartner(false);
      setLoading(false);
      navigate('/login');
      return;
    }
    fetchPartner();
  }, [user, authLoading]);

  const refreshPartner = async () => {
    await fetchPartner();
  };

  return (
    <PartnerContext.Provider value={{ isPartner, loading, error, partner, refreshPartner }}>
      {children}
    </PartnerContext.Provider>
  );
};

export const usePartnerContext = () => {
  const context = useContext(PartnerContext);
  if (context === undefined) {
    throw new Error('usePartnerContext must be used within a PartnerProvider');
  }
  return context;
};
