# RAG System Cleanup Plan

## Executive Summary

This document outlines the cleanup of legacy RAG components while preserving the vNext architecture. The analysis identified core vNext components that must be retained and several legacy artifacts that can be safely removed.

## vNext Manifest (Components to Keep)

### Core Database Schema (vNext)
- **Tables**: `documents_v2`, `chunks`, `sections`, `chunk_embeddings`, `products`, `insurers`
- **Functions**: `search_insurance_chunks_enhanced_v2`, `sections_parent_fill`, `get_documents_without_embeddings`
- **Indexes**: `idx_chunk_embeddings_vector`, `chunk_embeddings_vec_hnsw`, `idx_chunks_section_path`, `idx_sections_path`
- **Extensions**: `vector` (pgvector), `ltree`

### Active Edge Functions (vNext)
- `extract-pdf` - PDF ingestion pipeline
- `process-document` - Document processing orchestrator  
- `search-insurance-enhanced` - Enhanced retrieval with reranking
- `reprocess-embeddings` - Context-enriched embedding generation
- `chat-answer` - Grounded generation with citations

### Core Frontend Components (vNext)
- `src/main.tsx` - Application entrypoint
- `src/App.tsx` - Main application router
- `src/components/insurance/InsuranceDocumentUpload.tsx` - Document ingestion UI
- `src/components/insurance/BulkInsuranceDocumentUpload.tsx` - Bulk upload UI
- `src/components/admin/EmbeddingReprocessor.tsx` - Embedding management
- `src/components/insurance/EnhancedInsuranceChat.tsx` - RAG chat interface

## Legacy Components (Candidates for Removal)

### Edge Functions (Legacy)
| Function | Reason for Removal | Last Reference |
|----------|-------------------|----------------|
| `batch-process-embeddings` | Uses old `documents` table, superseded by reprocess-embeddings | Legacy schema |
| `bulk-data-operations` | Generic utility not RAG-specific | No vNext usage |
| `bulk-table-operations` | Database utility not RAG-specific | No vNext usage |
| `data-integrity-check` | Diagnostic tool not part of RAG pipeline | Standalone utility |
| `database-schema` | Schema introspection with errors in logs | Failing function |
| `performance-metrics` | Monitoring utility not RAG-specific | Standalone utility |
| `table-statistics` | Diagnostic tool not part of RAG pipeline | Standalone utility |

### Database Objects (Legacy)
| Object | Type | Reason for Removal |
|--------|------|-------------------|
| `get_documents_without_embeddings` | Function | References old `documents` table |
| Ltree utility functions | Functions | System functions, but many unused by vNext |

### Unused/Legacy Components
| Component | Reason for Removal |
|-----------|-------------------|
| `apps/extractor/` | Standalone CLI tool not integrated with vNext |
| Legacy document processing components | Superseded by current upload workflow |

## Risk Assessment

### High Risk (Manual Review Required)
- **ltree functions**: System extension functions that may have dependencies
- **Vector indexes**: Critical for retrieval performance - MUST NOT DELETE

### Medium Risk  
- **Edge functions**: Some may be used by external integrations
- **Database functions**: May have hidden dependencies

### Low Risk
- **Frontend components**: Already cleaned in previous iteration
- **Unused utilities**: Clear standalone tools

## Rollback Plan

### Database Rollback
```bash
# Create backup before cleanup
supabase db dump -f backups/pre_cleanup_$(date +%Y%m%d_%H%M%S).sql

# Rollback if needed
psql -f backups/pre_cleanup_YYYYMMDD_HHMMSS.sql
```

### Code Rollback
```bash
# Revert file changes
git restore -s HEAD~1 -- .

# Or apply backup patch
git apply CLEANUP_ROLLBACK.patch
```

## Apply Commands

### 1. Pre-cleanup Verification
```bash
# Create database backup
supabase db dump -f backups/pre_cleanup_$(date +%Y%m%d_%H%M%S).sql

# Dry run verification
deno run -A scripts/verify_cleanup.ts --dry-run
```

### 2. Apply Cleanup
```bash
# Apply code changes
git apply CLEANUP_DIFF.patch

# Apply database changes  
supabase db push
# OR: psql -f supabase/migrations/20250123000000_cleanup.sql
```

### 3. Post-cleanup Verification
```bash
# Verify system integrity
deno run -A scripts/verify_cleanup.ts

# Test retrieval pipeline
deno run -A scripts/test_rag_pipeline.ts
```

## Dependencies Preserved

### Critical RAG Pipeline
- ✅ PDF extraction and chunking
- ✅ pgvector embeddings storage  
- ✅ Enhanced search with reranking
- ✅ Citation generation and mapping
- ✅ Frontend upload and chat interfaces

### Authentication & Admin
- ✅ User management and RLS policies
- ✅ Admin interfaces for document management
- ✅ Audit logging for operations

## Post-Cleanup Validation

1. **Schema Integrity**: All foreign keys resolve
2. **Import Graph**: No unresolved imports/exports  
3. **RAG Pipeline**: Full E2E test passes
4. **Citations**: All section references resolve
5. **Edge Functions**: Active functions deploy successfully

---

**Status**: Ready for execution  
**Estimated Cleanup**: ~15 edge functions, ~50 ltree utility functions, ~5 diagnostic utilities  
**Risk Level**: Low-Medium (with proper backups and verification)