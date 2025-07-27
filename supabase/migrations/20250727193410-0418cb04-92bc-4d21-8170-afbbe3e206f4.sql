-- Create insurance types table
CREATE TABLE public.insurance_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insurance companies table
CREATE TABLE public.insurance_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  insurance_type_id UUID REFERENCES public.insurance_types(id) ON DELETE CASCADE,
  insurance_company_id UUID REFERENCES public.insurance_companies(id) ON DELETE CASCADE,
  extracted_text TEXT,
  summary TEXT,
  embedding VECTOR(1536), -- For OpenAI embeddings
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document processing logs table
CREATE TABLE public.document_processing_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  message TEXT,
  extracted_company TEXT,
  extracted_insurance_type TEXT,
  processing_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.insurance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_processing_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for insurance_types (read-only for authenticated users)
CREATE POLICY "Authenticated users can view insurance types"
ON public.insurance_types
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage insurance types"
ON public.insurance_types
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS policies for insurance_companies (read-only for authenticated users)
CREATE POLICY "Authenticated users can view insurance companies"
ON public.insurance_companies
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage insurance companies"
ON public.insurance_companies
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS policies for documents
CREATE POLICY "Authenticated users can view all documents"
ON public.documents
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create documents"
ON public.documents
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own documents"
ON public.documents
FOR UPDATE
USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own documents"
ON public.documents
FOR DELETE
USING (auth.uid() = uploaded_by);

-- RLS policies for document_processing_logs
CREATE POLICY "Authenticated users can view processing logs"
ON public.document_processing_logs
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage processing logs"
ON public.document_processing_logs
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create indexes for better performance
CREATE INDEX idx_documents_insurance_type ON public.documents(insurance_type_id);
CREATE INDEX idx_documents_insurance_company ON public.documents(insurance_company_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_embedding ON public.documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_document_processing_logs_document_id ON public.document_processing_logs(document_id);
CREATE INDEX idx_document_processing_logs_status ON public.document_processing_logs(status);

-- Create function to update updated_at timestamps
CREATE TRIGGER update_insurance_types_updated_at
  BEFORE UPDATE ON public.insurance_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_insurance_companies_updated_at
  BEFORE UPDATE ON public.insurance_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default insurance types
INSERT INTO public.insurance_types (name, description) VALUES
('Bedrijfsaansprakelijkheidsverzekering', 'Professional liability insurance for businesses'),
('Autoverzekering', 'Vehicle insurance coverage'),
('Woonhuisverzekering', 'Home insurance coverage'),
('Inboedelverzekering', 'Contents insurance for personal belongings'),
('Reisverzekering', 'Travel insurance coverage'),
('Zorgverzekering', 'Health insurance coverage');

-- Insert some default insurance companies
INSERT INTO public.insurance_companies (name, description) VALUES
('AEGON', 'Dutch insurance company'),
('ASR', 'Dutch insurance company'),
('Nationale Nederlanden', 'Dutch insurance company'),
('Allianz', 'International insurance company'),
('DELA', 'Dutch insurance company'),
('Centraal Beheer', 'Dutch insurance company'),
('FBTO', 'Dutch insurance company'),
('Univé', 'Dutch insurance company');