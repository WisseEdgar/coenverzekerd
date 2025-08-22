-- Fase 1: Database Foundation
-- Create document codes table for hierarchical structure
CREATE TABLE public.document_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  base_insurance_code VARCHAR(20) NOT NULL,
  document_type VARCHAR(10) NOT NULL,
  variant_code VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create metadata import table for CSV data
CREATE TABLE public.document_metadata_import (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_code VARCHAR(50) NOT NULL,
  stationaire_naam TEXT,
  handelsnaam TEXT,
  verzekeringsmaatschappij TEXT,
  verzekeringscategorie TEXT,
  product_naam TEXT,
  document_type TEXT,
  versie_datum DATE,
  status TEXT DEFAULT 'active',
  source_url TEXT,
  download_priority INTEGER DEFAULT 1,
  notes TEXT,
  import_batch_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document relationships table
CREATE TABLE public.document_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_document_id UUID REFERENCES public.documents_v2(id),
  child_document_id UUID REFERENCES public.documents_v2(id),
  relationship_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extend documents_v2 table with metadata columns
ALTER TABLE public.documents_v2 
ADD COLUMN document_code VARCHAR(50),
ADD COLUMN base_insurance_code VARCHAR(20),
ADD COLUMN document_type VARCHAR(10),
ADD COLUMN variant_code VARCHAR(10),
ADD COLUMN subcategory VARCHAR(100),
ADD COLUMN source_url TEXT,
ADD COLUMN download_priority INTEGER DEFAULT 1,
ADD COLUMN is_primary_document BOOLEAN DEFAULT false;

-- Extend chunks table for enhanced metadata
ALTER TABLE public.chunks 
ADD COLUMN document_code VARCHAR(50),
ADD COLUMN document_type VARCHAR(10),
ADD COLUMN base_insurance_code VARCHAR(20);

-- Create indexes for performance
CREATE INDEX idx_document_codes_base ON public.document_codes(base_insurance_code);
CREATE INDEX idx_documents_v2_document_code ON public.documents_v2(document_code);
CREATE INDEX idx_documents_v2_base_insurance ON public.documents_v2(base_insurance_code);
CREATE INDEX idx_chunks_document_code ON public.chunks(document_code);

-- Enable RLS on new tables
ALTER TABLE public.document_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_metadata_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_codes
CREATE POLICY "Authenticated users can view document codes" 
ON public.document_codes FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage document codes" 
ON public.document_codes FOR ALL 
USING (is_admin());

-- RLS policies for document_metadata_import
CREATE POLICY "Admins can manage metadata imports" 
ON public.document_metadata_import FOR ALL 
USING (is_admin());

-- RLS policies for document_relationships
CREATE POLICY "Authenticated users can view document relationships" 
ON public.document_relationships FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage document relationships" 
ON public.document_relationships FOR ALL 
USING (is_admin());