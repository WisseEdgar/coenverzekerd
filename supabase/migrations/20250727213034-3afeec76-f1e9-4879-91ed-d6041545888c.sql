-- Create client profiles table for comprehensive client data
CREATE TABLE public.client_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic client information
  client_type TEXT NOT NULL CHECK (client_type IN ('private', 'business')),
  full_name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  
  -- Private client specific fields
  birth_date DATE,
  bsn TEXT,
  marital_status TEXT,
  household_members INTEGER,
  occupation TEXT,
  employment_type TEXT,
  gross_annual_income DECIMAL,
  net_annual_income DECIMAL,
  
  -- Business client specific fields
  company_legal_name TEXT,
  kvk_number TEXT,
  btw_number TEXT,
  legal_form TEXT,
  founding_year INTEGER,
  annual_revenue DECIMAL,
  number_of_employees INTEGER,
  
  -- Insurance and risk information
  current_insurances JSONB,
  insurance_history JSONB,
  risk_assessment JSONB,
  preferences JSONB,
  
  -- Additional notes and data
  intake_responses JSONB,
  advisor_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for client profiles
CREATE POLICY "Advisors can view their own client profiles" 
ON public.client_profiles 
FOR SELECT 
USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can create client profiles" 
ON public.client_profiles 
FOR INSERT 
WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own client profiles" 
ON public.client_profiles 
FOR UPDATE 
USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own client profiles" 
ON public.client_profiles 
FOR DELETE 
USING (auth.uid() = advisor_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_client_profiles_updated_at
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_client_profiles_advisor_id ON public.client_profiles(advisor_id);
CREATE INDEX idx_client_profiles_client_type ON public.client_profiles(client_type);
CREATE INDEX idx_client_profiles_created_at ON public.client_profiles(created_at);