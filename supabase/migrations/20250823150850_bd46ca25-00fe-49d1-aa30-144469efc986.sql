-- Create enhanced search function with better performance and chunk embeddings
CREATE OR REPLACE FUNCTION public.search_insurance_chunks_enhanced_v2(
  query_embedding extensions.vector, 
  match_threshold double precision DEFAULT 0.1, 
  match_count integer DEFAULT 50, 
  line_of_business_filter text DEFAULT NULL::text, 
  insurer_filter text DEFAULT NULL::text, 
  document_type_filter text DEFAULT NULL::text, 
  base_insurance_code_filter text DEFAULT NULL::text,
  version_date_from date DEFAULT NULL::date,
  version_date_to date DEFAULT NULL::date
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
  is_primary_document boolean,
  section_path ltree,
  section_title text,
  chunk_embedding extensions.vector,
  chunk_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    COALESCE(d.is_primary_document, false) as is_primary_document,
    s.section_path,
    s.title as section_title,
    ce.embedding as chunk_embedding,
    c.chunk_order
  FROM public.chunk_embeddings ce
  JOIN public.chunks c ON ce.chunk_id = c.id
  JOIN public.documents_v2 d ON c.document_id = d.id
  JOIN public.products p ON d.product_id = p.id
  JOIN public.insurers i ON p.insurer_id = i.id
  LEFT JOIN public.sections s ON c.section_id = s.id
  WHERE 
    1 - (ce.embedding <=> query_embedding) > match_threshold
    AND (line_of_business_filter IS NULL OR p.line_of_business = line_of_business_filter)
    AND (insurer_filter IS NULL OR i.name = insurer_filter)
    AND (document_type_filter IS NULL OR d.document_type = document_type_filter)
    AND (base_insurance_code_filter IS NULL OR d.base_insurance_code = base_insurance_code_filter)
    AND (version_date_from IS NULL OR d.version_date >= version_date_from)
    AND (version_date_to IS NULL OR d.version_date <= version_date_to)
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$

-- Add missing chunk_order column to chunks table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chunks' AND column_name = 'chunk_order') THEN
        ALTER TABLE public.chunks ADD COLUMN chunk_order integer DEFAULT 0;
        
        -- Update chunk_order based on existing data
        UPDATE public.chunks 
        SET chunk_order = (
          SELECT COUNT(*) 
          FROM public.chunks c2 
          WHERE c2.document_id = chunks.document_id 
          AND c2.page <= chunks.page 
          AND c2.id <= chunks.id
        );
    END IF;
END $$;