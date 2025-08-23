-- Clean up old database schema and functions

-- 1. Drop old database functions
DROP FUNCTION IF EXISTS public.search_documents(extensions.vector, double precision, integer);
DROP FUNCTION IF EXISTS public.search_insurance_chunks(extensions.vector, double precision, integer, text, text);
DROP FUNCTION IF EXISTS public.search_chunks_cosine(extensions.vector, integer, text, uuid);

-- 2. Drop old tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.insurance_companies CASCADE;
DROP TABLE IF EXISTS public.insurance_types CASCADE;

-- 3. Clean up any orphaned references
DELETE FROM public.document_processing_logs WHERE document_id NOT IN (SELECT id FROM public.documents_v2);

-- 4. Update any remaining references to use the new schema
UPDATE public.admin_audit_log 
SET table_name = 'insurers' 
WHERE table_name = 'insurance_companies';

UPDATE public.admin_audit_log 
SET table_name = 'documents_v2' 
WHERE table_name = 'documents';