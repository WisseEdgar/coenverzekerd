-- Fix search_path security issue for the search function
CREATE OR REPLACE FUNCTION public.search_insurance_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 12,
  line_of_business_filter text DEFAULT NULL,
  insurer_filter text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  section_id uuid,
  chunk_text text,
  page integer,
  similarity float,
  insurer_name text,
  product_name text,
  document_title text,
  version_label text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    c.metadata
  FROM public.chunk_embeddings ce
  JOIN public.chunks c ON ce.chunk_id = c.id
  JOIN public.documents_v2 d ON c.document_id = d.id
  JOIN public.products p ON d.product_id = p.id
  JOIN public.insurers i ON p.insurer_id = i.id
  WHERE 
    1 - (ce.embedding <=> query_embedding) > match_threshold
    AND (line_of_business_filter IS NULL OR p.line_of_business = line_of_business_filter)
    AND (insurer_filter IS NULL OR i.name = insurer_filter)
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Also fix the existing update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;