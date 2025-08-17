import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    const { batchSize = 5 } = await req.json().catch(() => ({}));

    console.log(`Processing batch of ${batchSize} documents...`);

    // Get documents without embeddings
    const { data: documents, error: fetchError } = await supabaseClient
      .rpc('get_documents_without_embeddings', { batch_size: batchSize });

    if (fetchError) {
      console.error('Error fetching documents:', fetchError);
      throw fetchError;
    }

    if (!documents || documents.length === 0) {
      console.log('No documents found without embeddings');
      return new Response(JSON.stringify({ 
        message: 'No documents to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${documents.length} documents to process`);

    let processed = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        console.log(`Processing document: ${doc.title}`);

        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: doc.extracted_text.substring(0, 8000), // Limit to 8k chars
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`OpenAI API error for ${doc.title}:`, errorText);
          errors++;
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Update document with embedding
        const { error: updateError } = await supabaseClient
          .from('documents')
          .update({ embedding })
          .eq('id', doc.id);

        if (updateError) {
          console.error(`Error updating document ${doc.title}:`, updateError);
          errors++;
        } else {
          console.log(`Successfully processed: ${doc.title}`);
          processed++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing document ${doc.title}:`, error);
        errors++;
      }
    }

    console.log(`Batch processing complete: ${processed} processed, ${errors} errors`);

    return new Response(JSON.stringify({
      message: `Batch processing complete`,
      processed,
      errors,
      total: documents.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-process-embeddings function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});