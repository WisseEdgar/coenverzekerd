-- Complete PDF Pipeline and Documents Database Cleanup - Final Version
-- Phase 1: Clear all document-related data

-- Delete embeddings first (has foreign key to chunks)
DELETE FROM public.chunk_embeddings;

-- Delete chunks (has foreign key to documents)
DELETE FROM public.chunks;

-- Delete sections (has foreign key to documents)
DELETE FROM public.sections;

-- Delete answer citations
DELETE FROM public.answer_citations;

-- Delete answers
DELETE FROM public.answers;

-- Delete queries
DELETE FROM public.queries;

-- Delete document processing logs
DELETE FROM public.document_processing_logs;

-- Delete documents from both tables
DELETE FROM public.documents_v2;
DELETE FROM public.documents;

-- Clear products and insurers (will be repopulated on new uploads)
DELETE FROM public.products;
DELETE FROM public.insurers;

-- Clear storage buckets contents
DELETE FROM storage.objects WHERE bucket_id IN ('documents', 'policy-pdfs');

-- Log this major cleanup action
INSERT INTO public.admin_audit_log (
  user_id,
  action,
  table_name,
  record_id,
  old_values,
  new_values
) VALUES (
  auth.uid(),
  'COMPLETE_PIPELINE_CLEANUP',
  'multiple_tables',
  'all_documents',
  '{"message": "Deleted all documents, chunks, embeddings, storage files for fresh pipeline start"}'::jsonb,
  jsonb_build_object('cleanup_timestamp', now()::text)
);