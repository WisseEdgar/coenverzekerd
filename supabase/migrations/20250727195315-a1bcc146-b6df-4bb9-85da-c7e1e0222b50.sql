-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create admin audit log table
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(role_name app_role)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.is_admin());

-- RLS Policies for admin_audit_log
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
USING (public.is_admin());

CREATE POLICY "System can insert audit logs"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (true);

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _table_name TEXT DEFAULT NULL,
  _record_id TEXT DEFAULT NULL,
  _old_values JSONB DEFAULT NULL,
  _new_values JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    _action,
    _table_name,
    _record_id,
    _old_values,
    _new_values
  );
END;
$$;

-- Grant your user admin role (replace with your actual user ID)
-- First, let's get your user ID from the auth logs
INSERT INTO public.user_roles (user_id, role, assigned_by)
SELECT '39fe225b-70e0-4418-8a86-bb9517e7d853', 'admin', '39fe225b-70e0-4418-8a86-bb9517e7d853'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '39fe225b-70e0-4418-8a86-bb9517e7d853' 
  AND role = 'admin'
);