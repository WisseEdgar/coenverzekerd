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

    const { document_id, delete_file } = await req.json();
    
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting deletion for document: ${document_id}, delete_file: ${delete_file}`);

    // Get document details first
    const { data: document, error: docError } = await supabase
      .from('documents_v2')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError) {
      if (docError.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Failed to fetch document: ${docError.message}`);
    }

    console.log(`Found document: ${document.title}, file_path: ${document.file_path}`);

    // Get all chunks for this document to delete embeddings
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id')
      .eq('document_id', document_id);

    let deletedChunks = 0;
    let deletedEmbeddings = 0;

    if (chunks && chunks.length > 0) {
      const chunkIds = chunks.map(c => c.id);
      
      // Delete embeddings first (due to foreign key constraints)
      const { data: deletedEmbeddingsData, error: embeddingDeleteError } = await supabase
        .from('chunk_embeddings')
        .delete()
        .in('chunk_id', chunkIds)
        .select();

      if (embeddingDeleteError) {
        console.warn('Warning: Failed to delete some embeddings:', embeddingDeleteError);
      } else {
        deletedEmbeddings = deletedEmbeddingsData?.length || 0;
        console.log(`Deleted ${deletedEmbeddings} embeddings`);
      }

      // Delete sections related to this document
      const { error: sectionsDeleteError } = await supabase
        .from('sections')
        .delete()
        .eq('document_id', document_id);

      if (sectionsDeleteError) {
        console.warn('Warning: Failed to delete sections:', sectionsDeleteError);
      }

      // Delete chunks
      const { data: deletedChunksData, error: chunksDeleteError } = await supabase
        .from('chunks')
        .delete()
        .eq('document_id', document_id)
        .select();

      if (chunksDeleteError) {
        console.warn('Warning: Failed to delete chunks:', chunksDeleteError);
      } else {
        deletedChunks = deletedChunksData?.length || 0;
        console.log(`Deleted ${deletedChunks} chunks`);
      }
    }

    // Delete citations if any exist
    const { error: citationsDeleteError } = await supabase
      .from('answer_citations')
      .delete()
      .eq('document_id', document_id);

    if (citationsDeleteError) {
      console.warn('Warning: Failed to delete citations:', citationsDeleteError);
    }

    // Delete the document record
    const { error: documentDeleteError } = await supabase
      .from('documents_v2')
      .delete()
      .eq('id', document_id);

    if (documentDeleteError) {
      throw new Error(`Failed to delete document record: ${documentDeleteError.message}`);
    }

    console.log('Document record deleted successfully');

    // Delete the physical file if requested
    let fileDeleted = false;
    if (delete_file && document.file_path) {
      try {
        const { error: fileDeleteError } = await supabase.storage
          .from('policy-pdfs')
          .remove([document.file_path]);

        if (fileDeleteError) {
          console.warn(`Warning: Failed to delete file ${document.file_path}:`, fileDeleteError);
        } else {
          fileDeleted = true;
          console.log(`File ${document.file_path} deleted successfully`);
        }
      } catch (error) {
        console.warn(`Warning: Error deleting file:`, error);
      }
    }

    // Log the deletion action
    await supabase.rpc('log_admin_action', {
      _action: `Document deleted: ${document.title} (${deletedChunks} chunks, ${deletedEmbeddings} embeddings${fileDeleted ? ', file deleted' : ''})`,
      _table_name: 'documents_v2',
      _record_id: document_id,
      _old_values: document
    });

    return new Response(JSON.stringify({
      success: true,
      document_id: document_id,
      document_title: document.title,
      deleted_chunks: deletedChunks,
      deleted_embeddings: deletedEmbeddings,
      file_deleted: fileDeleted,
      file_path: document.file_path
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in delete-document function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.name || 'Document deletion failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});