-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create insurers table
CREATE TABLE public.insurers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kvk TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table  
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_id UUID NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  line_of_business TEXT NOT NULL, -- verzekeringssoort
  version_label TEXT,
  version_date DATE,
  jurisdiction TEXT DEFAULT 'NL',
  language TEXT DEFAULT 'nl',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_sha256 TEXT,
  pages INTEGER,
  source_type TEXT DEFAULT 'pdf',
  version_label TEXT,
  version_date DATE,
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sections table
CREATE TABLE public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  page_start INTEGER,
  page_end INTEGER,
  heading_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chunks table
CREATE TABLE public.chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  page INTEGER,
  token_count INTEGER,
  text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chunk_embeddings table with vector support
CREATE TABLE public.chunk_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chunk_id UUID NOT NULL REFERENCES public.chunks(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create queries table for analytics
CREATE TABLE public.queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  query TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create answers table
CREATE TABLE public.answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID NOT NULL REFERENCES public.queries(id) ON DELETE CASCADE,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create answer_citations table
CREATE TABLE public.answer_citations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents_v2(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  page INTEGER,
  score FLOAT,
  start_char INTEGER,
  end_char INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_products_line_of_business ON public.products(line_of_business);
CREATE INDEX idx_documents_version_date ON public.documents_v2(version_date);
CREATE INDEX idx_chunks_metadata ON public.chunks USING GIN(metadata);
CREATE INDEX idx_chunk_embeddings_vector ON public.chunk_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_queries_user_id ON public.queries(user_id);
CREATE INDEX idx_queries_created_at ON public.queries(created_at);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('policy-pdfs', 'policy-pdfs', false);

-- Enable RLS on all tables
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunk_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_citations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reading data (authenticated users can read all insurance data)
CREATE POLICY "Authenticated users can view insurers" ON public.insurers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view documents" ON public.documents_v2 FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view sections" ON public.sections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view chunks" ON public.chunks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view embeddings" ON public.chunk_embeddings FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for queries and answers (users can manage their own)
CREATE POLICY "Users can view their own queries" ON public.queries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create queries" ON public.queries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can view answers" ON public.answers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "System can create answers" ON public.answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view citations" ON public.answer_citations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "System can create citations" ON public.answer_citations FOR INSERT WITH CHECK (true);

-- Admin policies for data management
CREATE POLICY "Admins can manage insurers" ON public.insurers FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage documents" ON public.documents_v2 FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage sections" ON public.sections FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage chunks" ON public.chunks FOR ALL USING (is_admin());
CREATE POLICY "Admins can manage embeddings" ON public.chunk_embeddings FOR ALL USING (is_admin());

-- Storage policies for PDF bucket
CREATE POLICY "Admins can view PDFs" ON storage.objects FOR SELECT USING (bucket_id = 'policy-pdfs' AND is_admin());
CREATE POLICY "Admins can upload PDFs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'policy-pdfs' AND is_admin());
CREATE POLICY "Admins can update PDFs" ON storage.objects FOR UPDATE USING (bucket_id = 'policy-pdfs' AND is_admin());
CREATE POLICY "Admins can delete PDFs" ON storage.objects FOR DELETE USING (bucket_id = 'policy-pdfs' AND is_admin());

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_insurers_updated_at BEFORE UPDATE ON public.insurers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents_v2 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function for semantic search
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