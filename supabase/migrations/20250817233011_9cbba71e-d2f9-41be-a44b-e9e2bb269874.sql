-- Clean up corrupted document data
DELETE FROM chunk_embeddings 
WHERE chunk_id IN (
  SELECT c.id FROM chunks c 
  JOIN documents_v2 d ON c.document_id = d.id 
  WHERE d.title LIKE '%Aansprakelijkheid%Aannemers%'
);

DELETE FROM chunks 
WHERE document_id IN (
  SELECT id FROM documents_v2 
  WHERE title LIKE '%Aansprakelijkheid%Aannemers%'
);

DELETE FROM documents_v2 
WHERE title LIKE '%Aansprakelijkheid%Aannemers%';