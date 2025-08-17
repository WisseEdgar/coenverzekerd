-- Add file_size column to documents_v2 table
ALTER TABLE public.documents_v2 
ADD COLUMN file_size integer;