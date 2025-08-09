-- Add intake_questionnaire_md column to store full questionnaire markdown per client
ALTER TABLE public.client_profiles
ADD COLUMN IF NOT EXISTS intake_questionnaire_md text;