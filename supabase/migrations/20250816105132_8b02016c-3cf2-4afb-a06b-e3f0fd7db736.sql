-- Allow system to create new insurance types and companies during document processing
-- Update RLS policies to allow INSERT operations by authenticated users

-- Update insurance_types table policies
DROP POLICY IF EXISTS "Authenticated users can view insurance types" ON public.insurance_types;
DROP POLICY IF EXISTS "System can create insurance types" ON public.insurance_types;

CREATE POLICY "Authenticated users can view insurance types" 
ON public.insurance_types 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "System can create insurance types" 
ON public.insurance_types 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Update insurance_companies table policies  
DROP POLICY IF EXISTS "Authenticated users can view insurance companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "System can create insurance companies" ON public.insurance_companies;

CREATE POLICY "Authenticated users can view insurance companies" 
ON public.insurance_companies 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "System can create insurance companies" 
ON public.insurance_companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);