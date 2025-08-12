-- Harden RLS on client_profiles by consolidating into strict, minimal policies
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing overlapping policies to avoid permissive OR combinations
DROP POLICY IF EXISTS "Admins can view all client profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can create client profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can delete their clients" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can delete their own client profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can insert their clients" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can update their clients" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can update their own client profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can view their clients" ON public.client_profiles;
DROP POLICY IF EXISTS "Advisors can view their own client profiles" ON public.client_profiles;

-- Recreate minimal, precise policies
CREATE POLICY "client_profiles_select_owner_or_admin"
ON public.client_profiles
FOR SELECT
USING (
  advisor_id = auth.uid() OR public.is_admin(auth.uid())
);

CREATE POLICY "client_profiles_insert_owner_only"
ON public.client_profiles
FOR INSERT
WITH CHECK (
  advisor_id = auth.uid()
);

CREATE POLICY "client_profiles_update_owner_or_admin"
ON public.client_profiles
FOR UPDATE
USING (
  advisor_id = auth.uid() OR public.is_admin(auth.uid())
)
WITH CHECK (
  advisor_id = auth.uid() OR public.is_admin(auth.uid())
);

CREATE POLICY "client_profiles_delete_owner_or_admin"
ON public.client_profiles
FOR DELETE
USING (
  advisor_id = auth.uid() OR public.is_admin(auth.uid())
);