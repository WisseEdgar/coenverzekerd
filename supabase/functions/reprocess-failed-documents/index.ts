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
      // Find all documents with failed text extraction
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
        .like('text', '%PDF text extraction failed%');

      if (error) {
        throw new Error(`Error querying failed chunks: ${error.message}`);
      }

      // Group by document
      const failedDocs = new Map();
      failedChunks?.forEach(chunk => {
        const doc = chunk.documents_v2;
        if (!failedDocs.has(doc.id)) {
          failedDocs.set(doc.id, {
            id: doc.id,
            title: doc.title,
            filename: doc.filename,
            file_path: doc.file_path,
            processing_status: doc.processing_status,
            failed_chunks: 0
          });
        }
        failedDocs.get(doc.id).failed_chunks++;
      });

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

          // Call ingest-pdf function to reprocess
          const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-pdf', {
            body: {
              document_id: documentId,
              file_path: doc.file_path
            }
          });

          if (ingestError) {
            results.push({
              document_id: documentId,
              title: doc.title,
              success: false,
              error: `Ingest failed: ${ingestError.message}`
            });
          } else {
            results.push({
              document_id: documentId,
              title: doc.title,
              success: true,
              pages: ingestResult.pages,
              chunks: ingestResult.chunks
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