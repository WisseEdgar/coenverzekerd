-- Create function for semantic document search
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  filename TEXT,
  summary TEXT,
  insurance_type TEXT,
  insurance_company TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
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
$$;