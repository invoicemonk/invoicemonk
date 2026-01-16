import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface AdminContextType {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminRole = async () => {
      // Wait for auth to finish loading first
      if (authLoading) {
        return;
      }
      
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if user has platform_admin role
        const { data, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'platform_admin')
          .single();

        if (roleError) {
          if (roleError.code === 'PGRST116') {
            // No admin role found
            setIsAdmin(false);
            setError('Access denied. Platform admin privileges required.');
            navigate('/dashboard');
            return;
          }
          throw roleError;
        }

        setIsAdmin(true);
      } catch (err) {
        console.error('Error checking admin role:', err);
        setError('Failed to verify admin access');
        setIsAdmin(false);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [user, authLoading, navigate]);

  return (
    <AdminContext.Provider value={{ isAdmin, loading, error }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
