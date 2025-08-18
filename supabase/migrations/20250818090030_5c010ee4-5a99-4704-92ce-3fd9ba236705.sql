-- PHASE 1: COMPLETE DATABASE CLEANUP - THOROUGH VERSION
-- Clear all document-related data in the correct order to respect foreign keys

-- First, clear all message feedback and related chat data
DELETE FROM public.message_feedback;
DELETE FROM public.messages;
DELETE FROM public.conversations;

-- Clear all document processing and analysis data
DELETE FROM public.chunk_embeddings;
DELETE FROM public.chunks;
DELETE FROM public.sections;
DELETE FROM public.answer_citations;
DELETE FROM public.answers;
DELETE FROM public.queries;

-- Clear document processing logs
DELETE FROM public.document_processing_logs;

-- Clear all documents (both legacy and new)
DELETE FROM public.documents_v2;
DELETE FROM public.documents;

-- Clear insurance structure (will be rebuilt)
DELETE FROM public.products;
DELETE FROM public.insurers;

-- Clear legacy insurance data
DELETE FROM public.insurance_companies;
DELETE FROM public.insurance_types;

-- Clear all storage objects from both buckets
DELETE FROM storage.objects WHERE bucket_id = 'documents';
DELETE FROM storage.objects WHERE bucket_id = 'policy-pdfs';

-- Reset any sequences that might exist (check if they exist first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'documents_id_seq') THEN
        PERFORM setval('public.documents_id_seq', 1, false);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'documents_v2_id_seq') THEN
        PERFORM setval('public.documents_v2_id_seq', 1, false);
    END IF;
END $$;

-- Log this comprehensive cleanup
INSERT INTO public.admin_audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
) VALUES (
    auth.uid(),
    'COMPLETE_SYSTEM_RESET',
    'all_document_tables',
    'comprehensive_cleanup',
    jsonb_build_object('phase', 1, 'action', 'thorough_database_cleanup'),
    jsonb_build_object('timestamp', now(), 'cleared_tables', array[
        'chunk_embeddings', 'chunks', 'sections', 'answer_citations', 'answers', 
        'queries', 'document_processing_logs', 'documents_v2', 'documents', 
        'products', 'insurers', 'insurance_companies', 'insurance_types',
        'message_feedback', 'messages', 'conversations', 'storage_objects'
    ])
);