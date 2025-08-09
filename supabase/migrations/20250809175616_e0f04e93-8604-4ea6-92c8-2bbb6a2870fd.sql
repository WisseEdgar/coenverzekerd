-- Create dedicated schema for extensions and move vector extension
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION IF EXISTS vector SET SCHEMA extensions;

-- Ensure search_path is fixed for custom functions (prevents mutable search_path)
CREATE OR REPLACE FUNCTION public.search_documents(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 3
)
RETURNS TABLE(
  id uuid,
  title text,
  filename text,
  summary text,
  insurance_type text,
  insurance_company text,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.filename,
    d.summary,
    it.name as insurance_type,
    ic.name as insurance_company,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM documents d
  LEFT JOIN insurance_types it ON d.insurance_type_id = it.id
  LEFT JOIN insurance_companies ic ON d.insurance_company_id = ic.id
  WHERE d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;