import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action = 'list', document_ids = [] } = body;

    if (action === 'list') {
      // Find all documents with failed text extraction (multiple patterns)
      const { data: failedChunks, error } = await supabase
        .from('chunks')
        .select(`
          id,
          document_id,
          text,
          documents_v2!inner(
            id,
            title,
            filename,
            file_path,
            processing_status
          )
        `)
        .or('text.ilike.%PDF text extraction failed%,text.ilike.%Sample extracted text%,text.ilike.%lorem ipsum%,text.ilike.%this is a sample%');

      // Also find documents with failed processing status
      const { data: failedStatusDocs, error: statusError } = await supabase
        .from('documents_v2')
        .select('id, title, filename, file_path, processing_status')
        .eq('processing_status', 'failed');

      if (error) {
        console.warn('Error querying failed chunks:', error);
      }
      
      if (statusError) {
        console.warn('Error querying failed status docs:', statusError);
      }

      // Group by document and get total chunks
      const failedDocs = new Map();
      
      // Process chunks with failed content
      for (const chunk of failedChunks || []) {
        const doc = chunk.documents_v2;
        if (!failedDocs.has(doc.id)) {
          // Get total chunks for this document
          const { data: totalChunksData } = await supabase
            .from('chunks')
            .select('id', { count: 'exact' })
            .eq('document_id', doc.id);
          
          failedDocs.set(doc.id, {
            document_id: doc.id,
            title: doc.title,
            filename: doc.filename,
            file_path: doc.file_path,
            processing_status: doc.processing_status,
            failed_chunks: 0,
            total_chunks: totalChunksData?.length || 0,
            failure_reason: 'Content extraction failed'
          });
        }
        failedDocs.get(doc.id).failed_chunks++;
      }
      
      // Process documents with failed status (may have no chunks yet)
      for (const doc of failedStatusDocs || []) {
        if (!failedDocs.has(doc.id)) {
          const { data: totalChunksData } = await supabase
            .from('chunks')
            .select('id', { count: 'exact' })
            .eq('document_id', doc.id);
          
          failedDocs.set(doc.id, {
            document_id: doc.id,
            title: doc.title,
            filename: doc.filename,
            file_path: doc.file_path,
            processing_status: doc.processing_status,
            failed_chunks: 0,
            total_chunks: totalChunksData?.length || 0,
            failure_reason: 'Processing failed'
          });
        }
      }

      // Also check for documents with insufficient content (very short chunks)
      const { data: shortContentDocs, error: shortError } = await supabase
        .from('chunks')
        .select(`
          document_id,
          documents_v2!inner(id, title, filename, file_path, processing_status)
        `)
        .lt('char_length(text)', 100);

      if (!shortError && shortContentDocs) {
        const docGroups = new Map();
        shortContentDocs.forEach(chunk => {
          const docId = chunk.document_id;
          if (!docGroups.has(docId)) {
            docGroups.set(docId, { doc: chunk.documents_v2, count: 0 });
          }
          docGroups.get(docId).count++;
        });

        // If more than 80% of chunks are too short, consider it failed
        for (const [docId, info] of docGroups) {
          if (!failedDocs.has(docId)) {
            const { data: totalChunksData } = await supabase
              .from('chunks')
              .select('id', { count: 'exact' })
              .eq('document_id', docId);
            
            const totalChunks = totalChunksData?.length || 0;
            if (totalChunks > 0 && (info.count / totalChunks) > 0.8) {
              failedDocs.set(docId, {
                document_id: docId,
                title: info.doc.title,
                filename: info.doc.filename,
                file_path: info.doc.file_path,
                processing_status: info.doc.processing_status,
                failed_chunks: info.count,
                total_chunks: totalChunks,
                failure_reason: 'Insufficient content extracted'
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        failed_documents: Array.from(failedDocs.values()),
        total_failed: failedDocs.size
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reprocess') {
      if (!Array.isArray(document_ids) || document_ids.length === 0) {
        throw new Error('document_ids array is required for reprocess action');
      }

      const results = [];
      
      for (const documentId of document_ids) {
        try {
          console.log(`Reprocessing document: ${documentId}`);
          
          // Get document info
          const { data: doc, error: docError } = await supabase
            .from('documents_v2')
            .select('id, title, filename, file_path')
            .eq('id', documentId)
            .single();

          if (docError || !doc) {
            results.push({
              document_id: documentId,
              success: false,
              error: `Document not found: ${docError?.message || 'Unknown error'}`
            });
            continue;
          }

          // Delete existing chunks and embeddings
          const { error: deleteEmbeddingsError } = await supabase
            .from('chunk_embeddings')
            .delete()
            .in('chunk_id', 
              supabase
                .from('chunks')
                .select('id')
                .eq('document_id', documentId)
            );

          if (deleteEmbeddingsError) {
            console.warn(`Warning: Could not delete embeddings for ${documentId}:`, deleteEmbeddingsError);
          }

          const { error: deleteChunksError } = await supabase
            .from('chunks')
            .delete()
            .eq('document_id', documentId);

          if (deleteChunksError) {
            console.warn(`Warning: Could not delete chunks for ${documentId}:`, deleteChunksError);
          }

          // Update document status to pending
          await supabase
            .from('documents_v2')
            .update({ processing_status: 'pending' })
            .eq('id', documentId);

          // Call extract-pdf function to reprocess
          const { data: extractResult, error: extractError } = await supabase.functions.invoke('extract-pdf', {
            body: {
              document_id: documentId
            }
          });

          if (extractError) {
            results.push({
              document_id: documentId,
              title: doc.title,
              success: false,
              error: `Extract failed: ${extractError.message}`
            });
          } else {
            results.push({
              document_id: documentId,
              title: doc.title,
              success: true,
              result: extractResult
            });
          }

        } catch (error) {
          console.error(`Error reprocessing ${documentId}:`, error);
          results.push({
            document_id: documentId,
            success: false,
            error: error.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        results,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('Error in reprocess-failed-documents function:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});