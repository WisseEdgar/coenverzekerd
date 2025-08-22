-- Create enhanced search function with metadata support
CREATE OR REPLACE FUNCTION public.search_insurance_chunks_enhanced(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 12,
  line_of_business_filter text DEFAULT NULL,
  insurer_filter text DEFAULT NULL,
  document_type_filter text DEFAULT NULL,
  base_insurance_code_filter text DEFAULT NULL
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  section_id uuid,
  chunk_text text,
  page integer,
  similarity double precision,
  insurer_name text,
  product_name text,
  document_title text,
  version_label text,
  metadata jsonb,
  document_code text,
  document_type text,
  base_insurance_code text,
  is_primary_document boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as chunk_id,
    c.document_id,
    c.section_id,
    c.text as chunk_text,
    c.page,
    1 - (ce.embedding <=> query_embedding) as similarity,
    i.name as insurer_name,
    p.name as product_name,
    d.title as document_title,
    d.version_label,
    c.metadata,
    d.document_code,
    d.document_type,
    d.base_insurance_code,
    COALESCE(d.is_primary_document, false) as is_primary_document
  FROM public.chunk_embeddings ce
  JOIN public.chunks c ON ce.chunk_id = c.id
  JOIN public.documents_v2 d ON c.document_id = d.id
  JOIN public.products p ON d.product_id = p.id
  JOIN public.insurers i ON p.insurer_id = i.id
  WHERE 
    1 - (ce.embedding <=> query_embedding) > match_threshold
    AND (line_of_business_filter IS NULL OR p.line_of_business = line_of_business_filter)
    AND (insurer_filter IS NULL OR i.name = insurer_filter)
    AND (document_type_filter IS NULL OR d.document_type = document_type_filter)
    AND (base_insurance_code_filter IS NULL OR d.base_insurance_code = base_insurance_code_filter)
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;