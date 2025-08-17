-- Add filename column to documents_v2 table
ALTER TABLE public.documents_v2 
ADD COLUMN filename TEXT;

-- Update existing records to extract filename from file_path (for backwards compatibility)
UPDATE public.documents_v2 
SET filename = SPLIT_PART(file_path, '/', -1)
WHERE filename IS NULL;

-- Make filename NOT NULL after populating existing records
ALTER TABLE public.documents_v2 
ALTER COLUMN filename SET NOT NULL;