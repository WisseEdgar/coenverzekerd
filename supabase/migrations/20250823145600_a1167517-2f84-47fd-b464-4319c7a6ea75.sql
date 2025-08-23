-- Enable ltree extension for hierarchical section paths
CREATE EXTENSION IF NOT EXISTS ltree;

-- Upgrade sections table for hierarchical structure
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS section_path ltree;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS section_label text;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS parent_path ltree;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS order_key int;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS title text;

-- Upgrade chunks table for enhanced chunking
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS section_path ltree;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS paragraph_start int;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS paragraph_end int;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS chunk_index int;

-- Create function for section path normalization
CREATE OR REPLACE FUNCTION public.sections_parent_fill()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.section_path IS NOT NULL AND nlevel(NEW.section_path) > 1 THEN
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
   COALESCE(' — art. ' || REPLACE(s.section_path::text, '.', '.'), '') || 
   COALESCE(' ' || s.title, '')
  as citation_label
FROM public.chunks c
LEFT JOIN public.sections s ON s.id = c.section_id
JOIN public.documents_v2 d ON d.id = c.document_id
JOIN public.products p ON d.product_id = p.id
JOIN public.insurers i ON p.insurer_id = i.id;

-- Create indexes for enhanced performance
CREATE INDEX IF NOT EXISTS idx_sections_path ON public.sections USING gist (section_path);
CREATE INDEX IF NOT EXISTS idx_sections_order ON public.sections (order_key);
CREATE INDEX IF NOT EXISTS idx_chunks_section_path ON public.chunks USING gist (section_path);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON public.chunks (section_id, chunk_index);