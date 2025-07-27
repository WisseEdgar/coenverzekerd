import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'moderator' | 'user';

interface UseAdminResult {
  isAdmin: boolean;
  userRoles: UserRole[];
  loading: boolean;
  error: string | null;
  logAdminAction: (action: string, tableName?: string, recordId?: string, oldValues?: any, newValues?: any) => Promise<void>;
}

export const useAdmin = (): UseAdminResult => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setUserRoles([]);
        setLoading(false);
        return;
      }

      // Check if user is admin using our security function
      const { data: adminCheck, error: adminError } = await supabase.rpc('is_admin');
      
      if (adminError) {
        console.error('Error checking admin status:', adminError);
        setError('Failed to check admin status');
        setIsAdmin(false);
      } else {
        setIsAdmin(adminCheck || false);
      }

      // Get user roles
      const { data: rolesData, error: rolesError } = await supabase.rpc('get_user_roles');
      
      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        setError('Failed to fetch user roles');
        setUserRoles([]);
      } else {
        const roles = rolesData?.map((r: any) => r.role_name) || [];
        setUserRoles(roles);
      }

    } catch (err) {
      console.error('Error in checkAdminStatus:', err);
      setError('Failed to check admin status');
      setIsAdmin(false);
      setUserRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const logAdminAction = async (
    action: string,
    tableName?: string,
    recordId?: string,
    oldValues?: any,
    newValues?: any
  ) => {
    try {
      const { error } = await supabase.rpc('log_admin_action', {
        _action: action,
        _table_name: tableName || null,
        _record_id: recordId || null,
        _old_values: oldValues ? JSON.stringify(oldValues) : null,
        _new_values: newValues ? JSON.stringify(newValues) : null,
      });

      if (error) {
        console.error('Error logging admin action:', error);
      }
    } catch (err) {
      console.error('Error in logAdminAction:', err);
    }
  };

  return {
    isAdmin,
    userRoles,
    loading,
    error,
    logAdminAction,
  };
};