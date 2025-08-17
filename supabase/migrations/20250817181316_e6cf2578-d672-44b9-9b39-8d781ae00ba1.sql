-- Create a function to reprocess documents without embeddings
CREATE OR REPLACE FUNCTION public.get_documents_without_embeddings(batch_size integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  title text,
  filename text,
  file_path text,
  extracted_text text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.id, d.title, d.filename, d.file_path, d.extracted_text
  FROM documents d
  WHERE d.embedding IS NULL 
    AND d.extracted_text IS NOT NULL
    AND length(d.extracted_text) > 100
  ORDER BY d.created_at DESC
  LIMIT batch_size;
$function$