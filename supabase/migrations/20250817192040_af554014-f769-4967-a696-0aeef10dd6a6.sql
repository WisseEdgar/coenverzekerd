-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index on cosine similarity for embeddings
CREATE INDEX IF NOT EXISTS chunk_embeddings_vec_hnsw 
ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);

-- Create fast RPC for cosine retrieval with filters
CREATE OR REPLACE FUNCTION search_chunks_cosine(
  qvec vector,
  k integer DEFAULT 12,
  lob text DEFAULT NULL,
  insurer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  page integer,
  text text,
  metadata jsonb,
  similarity double precision,
  document_title text,
  product_name text,
  insurer_name text,
  version_label text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    c.id, 
    c.document_id, 
    c.page, 
    c.text, 
    c.metadata,
    1 - (ce.embedding <=> qvec) AS similarity,
    d.title as document_title,
    p.name as product_name,
    i.name as insurer_name,
    d.version_label
  FROM chunk_embeddings ce
  JOIN chunks c ON c.id = ce.chunk_id
  JOIN documents_v2 d ON d.id = c.document_id
  JOIN products p ON p.id = d.product_id
  JOIN insurers i ON i.id = p.insurer_id
  WHERE (lob IS NULL OR p.line_of_business = lob)
    AND (insurer_id IS NULL OR p.insurer_id = insurer_id)
  ORDER BY ce.embedding <=> qvec
  LIMIT k;
$$;