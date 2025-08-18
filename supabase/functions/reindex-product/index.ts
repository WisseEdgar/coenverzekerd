import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization') || '';
    const tempClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user } } = await tempClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: isAdminData } = await tempClient.rpc('is_admin', { _user_id: user.id });
    if (!isAdminData) {
      throw new Error('Admin access required');
    }

    const { product_id } = await req.json();
    
    if (!product_id) {
      return new Response(JSON.stringify({ error: 'product_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting reindexing for product: ${product_id}`);

    // Get all documents for this product
    const { data: documents, error: docsError } = await supabase
      .from('documents_v2')
      .select('*')
      .eq('product_id', product_id);

    if (docsError) {
      throw new Error(`Failed to fetch documents: ${docsError.message}`);
    }

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No documents found for this product',
        product_id: product_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${documents.length} documents to reindex`);

    // Delete existing chunks and embeddings for all documents in this product
    for (const document of documents) {
      // Delete embeddings first (due to foreign key constraints)
      const { data: chunks } = await supabase
        .from('chunks')
        .select('id')
        .eq('document_id', document.id);

      if (chunks && chunks.length > 0) {
        const chunkIds = chunks.map(c => c.id);
        
        // Delete embeddings
        const { error: embeddingDeleteError } = await supabase
          .from('chunk_embeddings')
          .delete()
          .in('chunk_id', chunkIds);

        if (embeddingDeleteError) {
          console.warn(`Warning: Failed to delete embeddings for document ${document.id}:`, embeddingDeleteError);
        }

        // Delete chunks
        const { error: chunksDeleteError } = await supabase
          .from('chunks')
          .delete()
          .eq('document_id', document.id);

        if (chunksDeleteError) {
          console.warn(`Warning: Failed to delete chunks for document ${document.id}:`, chunksDeleteError);
        }
      }

      // Reset document processing status
      await supabase
        .from('documents_v2')
        .update({ processing_status: 'pending' })
        .eq('id', document.id);

      console.log(`Cleaned up document ${document.id}`);
    }

    // Trigger reprocessing for each document using the new extract-pdf function
    const reprocessingPromises = documents.map(async (document) => {
      try {
        console.log(`Reprocessing document ${document.id} with extract-pdf...`);
        
        const { data: extractResult, error: extractError } = await supabase.functions.invoke('extract-pdf', {
          body: {
            document_id: document.id
          }
        });

        if (extractError) {
          throw new Error(`Extract error: ${extractError.message}`);
        }

        console.log(`Successfully reprocessed document ${document.id}:`, extractResult);
        return { document_id: document.id, success: true, result: extractResult };
      } catch (error) {
        console.error(`Failed to reprocess document ${document.id}:`, error);
        return { document_id: document.id, success: false, error: error.message };
      }
    });

    const reprocessingResults = await Promise.all(reprocessingPromises);
    const successCount = reprocessingResults.filter(r => r.success).length;

    // Log the reindexing action
    await supabase.rpc('log_admin_action', {
      _action: `Product reindexing completed with new pipeline: ${successCount}/${documents.length} documents reprocessed`,
      _table_name: 'products',
      _record_id: product_id
    });

    console.log(`Reindexing completed: ${successCount}/${documents.length} documents successfully reprocessed`);

    return new Response(JSON.stringify({
      success: true,
      product_id: product_id,
      total_documents: documents.length,
      successful_reprocessing: successCount,
      failed_reprocessing: documents.length - successCount,
      results: reprocessingResults,
      pipeline: 'extract-pdf'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reindex-product function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.name || 'Reindexing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});