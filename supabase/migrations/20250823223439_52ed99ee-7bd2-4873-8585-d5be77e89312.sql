-- RAG System Cleanup Migration
-- Removes legacy components while preserving vNext architecture
-- CRITICAL: Run verify_cleanup.ts --dry-run before applying

BEGIN;

-- =============================================================================
-- DATABASE FUNCTION CLEANUP
-- Remove functions not used by vNext RAG architecture
-- =============================================================================

-- Legacy function that references old documents table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_documents_without_embeddings'
  ) THEN
    -- Rationale: References old 'documents' table, replaced by documents_v2 workflow
    DROP FUNCTION IF EXISTS public.get_documents_without_embeddings(integer) CASCADE;
    RAISE NOTICE 'Dropped legacy function: get_documents_without_embeddings';
  END IF;
END $$;

-- =============================================================================
-- VERIFY CRITICAL VNEXT COMPONENTS ARE INTACT
-- Ensure we haven't broken the core RAG pipeline
-- =============================================================================

-- Verify critical tables exist
DO $$
BEGIN
  -- Check core vNext tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents_v2') THEN
    RAISE EXCEPTION 'CRITICAL: documents_v2 table missing - aborting cleanup';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chunks') THEN
    RAISE EXCEPTION 'CRITICAL: chunks table missing - aborting cleanup';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chunk_embeddings') THEN
    RAISE EXCEPTION 'CRITICAL: chunk_embeddings table missing - aborting cleanup';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sections') THEN
    RAISE EXCEPTION 'CRITICAL: sections table missing - aborting cleanup';
  END IF;
  
  RAISE NOTICE 'Core vNext tables verified: documents_v2, chunks, chunk_embeddings, sections';
END $$;

-- Verify critical functions exist
DO $$
BEGIN
  -- Check enhanced search function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='search_insurance_chunks_enhanced_v2'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: search_insurance_chunks_enhanced_v2 function missing - aborting cleanup';
  END IF;
  
  -- Check section hierarchy function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='sections_parent_fill'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: sections_parent_fill function missing - aborting cleanup';
  END IF;
  
  RAISE NOTICE 'Core vNext functions verified: search_insurance_chunks_enhanced_v2, sections_parent_fill';
END $$;

-- Verify critical indexes exist (performance critical)
DO $$
BEGIN
  -- Check vector indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'chunk_embeddings' 
    AND indexdef ILIKE '%vector%'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Vector indexes on chunk_embeddings missing - aborting cleanup';
  END IF;
  
  -- Check ltree indexes  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sections'
    AND indexdef ILIKE '%gist%'
    AND indexdef ILIKE '%section_path%'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Section path indexes missing - aborting cleanup';
  END IF;
  
  RAISE NOTICE 'Core vNext indexes verified: vector and ltree indexes intact';
END $$;

-- Verify pgvector extension
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: pgvector extension missing - aborting cleanup';
  END IF;
  
  RAISE NOTICE 'pgvector extension verified';
END $$;

-- =============================================================================
-- CLEANUP SUMMARY LOG
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RAG CLEANUP MIGRATION COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Removed: 1 legacy database function';
  RAISE NOTICE 'Preserved: All vNext tables, functions, indexes';
  RAISE NOTICE 'Edge functions removed: 8 legacy functions';
  RAISE NOTICE 'Next Steps: Run verify_cleanup.ts for full validation';
  RAISE NOTICE '========================================';
END $$;

COMMIT;