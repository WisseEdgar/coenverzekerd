-- Enable ltree extension for hierarchical section paths
CREATE EXTENSION IF NOT EXISTS ltree;

-- Upgrade sections table for hierarchical structure
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS section_path ltree;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS section_label text;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS parent_path ltree;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS order_key int;

-- Upgrade chunks table for enhanced chunking
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS section_path ltree;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS paragraph_start int;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS paragraph_end int;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS chunk_index int;

-- Create function for section path normalization
CREATE OR REPLACE FUNCTION public.sections_parent_fill()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF nlevel(NEW.section_path) > 1 THEN
    NEW.parent_path := subpath(NEW.section_path, 0, nlevel(NEW.section_path)-1);
  ELSE
    NEW.parent_path := NULL;
  END IF;
  RETURN NEW;
END $$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_sections_parent_fill ON public.sections;
CREATE TRIGGER trg_sections_parent_fill
BEFORE INSERT OR UPDATE ON public.sections
FOR EACH ROW EXECUTE FUNCTION public.sections_parent_fill();

-- Create enhanced chunk citation view using existing schema
CREATE OR REPLACE VIEW public.chunk_citations AS
SELECT 
  c.id as chunk_id,
  i.name || ' ' || (d.title || COALESCE(' ' || d.version_label, '')) ||
   ' — art. ' || COALESCE(REPLACE(s.section_path::text, '.', '.'), 'no-section') || ' ' ||
   COALESCE(s.title, '')
  as citation_label
FROM public.chunks c
LEFT JOIN public.sections s ON s.id = c.section_id
JOIN public.documents_v2 d ON d.id = c.document_id
JOIN public.products p ON d.product_id = p.id
JOIN public.insurers i ON p.insurer_id = i.id;

-- Create enhanced search function with structure awareness
CREATE OR REPLACE FUNCTION public.search_insurance_chunks_enhanced_v2(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 24,
  line_of_business_filter text DEFAULT NULL,
  insurer_filter text DEFAULT NULL,
  document_type_filter text DEFAULT NULL,
  base_insurance_code_filter text DEFAULT NULL
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  section_id uuid,
  section_path ltree,
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
  citation_label text,
  section_label text,
  section_title text,
  chunk_index integer,
  paragraph_start integer,
  paragraph_end integer
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
    COALESCE(c.section_path, s.section_path) as section_path,
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
    COALESCE(cc.citation_label, 'No Citation') as citation_label,
    COALESCE(s.section_label, 'No Label') as section_label,
    COALESCE(s.title, 'No Title') as section_title,
    COALESCE(c.chunk_index, 0) as chunk_index,
    COALESCE(c.paragraph_start, 0) as paragraph_start,
    COALESCE(c.paragraph_end, 0) as paragraph_end
  FROM public.chunk_embeddings ce
  JOIN public.chunks c ON ce.chunk_id = c.id
  JOIN public.documents_v2 d ON c.document_id = d.id
  JOIN public.products p ON d.product_id = p.id
  JOIN public.insurers i ON p.insurer_id = i.id
  LEFT JOIN public.sections s ON s.id = c.section_id
  LEFT JOIN public.chunk_citations cc ON cc.chunk_id = c.id
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

-- Create indexes for enhanced performance
CREATE INDEX IF NOT EXISTS idx_sections_path ON public.sections USING gist (section_path);
CREATE INDEX IF NOT EXISTS idx_sections_order ON public.sections (order_key);
CREATE INDEX IF NOT EXISTS idx_chunks_section_path ON public.chunks USING gist (section_path);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON public.chunks (section_id, chunk_index);