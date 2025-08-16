-- Fix RLS policies for document_processing_logs to allow edge function to create logs
-- This will help with debugging the categorization process

-- Create INSERT policy for system/edge functions to create processing logs
CREATE POLICY "System can insert processing logs" 
ON public.document_processing_logs 
FOR INSERT 
WITH CHECK (true);

-- Create UPDATE policy for system/edge functions to update processing logs
CREATE POLICY "System can update processing logs" 
ON public.document_processing_logs 
FOR UPDATE 
USING (true);