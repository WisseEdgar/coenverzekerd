import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dutch legal terminology for context enrichment
const DUTCH_LEGAL_TERMS = [
  'aansprakelijkheid', 'dekking', 'uitkering', 'premie', 'polis', 'voorwaarden',
  'uitsluitingen', 'eigen risico', 'verzekeringsmaatschappij', 'verzekerde',
  'verzekeringnemer', 'schade', 'incident', 'claimen', 'regres', 'artikel',
  'lid', 'paragraaf', 'bepaling', 'clausule', 'wetgeving', 'AVB', 'AVV'
];

// Enhanced embedding generation with context enrichment
async function createContextEnrichedEmbeddings(texts: string[], documentMetadata: any): Promise<number[][]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Context-enrich the texts for better semantic understanding
  const enrichedTexts = texts.map(text => {
    let contextualText = '';
    
    // Add document metadata context
    if (documentMetadata.insurer) {
      contextualText += `Verzekeraar: ${documentMetadata.insurer}. `;
    }
    if (documentMetadata.productName) {
      contextualText += `Product: ${documentMetadata.productName}. `;
    }
    if (documentMetadata.documentType) {
      contextualText += `Document type: ${documentMetadata.documentType}. `;
    }
    
    // Add relevant legal terminology context
    const relevantTerms = DUTCH_LEGAL_TERMS.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );
    
    if (relevantTerms.length > 0) {
      contextualText += `Juridische context: ${relevantTerms.join(', ')}. `;
    }
    
    // Combine context with original text
    return contextualText + text;
  });

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large', // Upgraded to better model
      input: enrichedTexts,
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((item: any) => item.embedding);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batch_size = 50, force_reprocess = false } = await req.json();

    console.log(`Starting reprocessing of embeddings with batch size ${batch_size}`);

    // Get chunks that need enhanced embeddings
    let query = supabase
      .from('chunk_embeddings')
      .select(`
        id,
        chunk_id,
        chunks!inner(
          id,
          text,
          document_id,
          documents_v2!inner(
            title,
            document_type,
            base_insurance_code,
            products!inner(
              name,
              insurers!inner(name)
            )
          )
        )
      `)
      .limit(batch_size);

    if (!force_reprocess) {
      // Only process chunks that haven't been context-enriched yet
      query = query.or('chunks.metadata->context_enriched.is.null,chunks.metadata->context_enriched.eq.false');
    }

    const { data: embeddingsToUpdate, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching embeddings:', fetchError);
      throw new Error(`Failed to fetch embeddings: ${fetchError.message}`);
    }

    if (!embeddingsToUpdate || embeddingsToUpdate.length === 0) {
      console.log('No embeddings need reprocessing');
      return new Response(JSON.stringify({
        success: true,
        processed_count: 0,
        message: 'No embeddings need reprocessing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${embeddingsToUpdate.length} embeddings to reprocess`);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in smaller batches for embedding API
    const EMBEDDING_BATCH_SIZE = 32;
    
    for (let i = 0; i < embeddingsToUpdate.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = embeddingsToUpdate.slice(i, i + EMBEDDING_BATCH_SIZE);
      
      try {
        // Prepare texts and metadata for this batch
        const batchTexts = batch.map(item => item.chunks.text);
        const documentMetadata = {
          insurer: batch[0]?.chunks?.documents_v2?.products?.insurers?.name,
          productName: batch[0]?.chunks?.documents_v2?.products?.name,
          documentType: batch[0]?.chunks?.documents_v2?.document_type,
          documentTitle: batch[0]?.chunks?.documents_v2?.title
        };

        console.log(`Processing embedding batch ${Math.floor(i/EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(embeddingsToUpdate.length/EMBEDDING_BATCH_SIZE)}`);
        
        // Generate context-enriched embeddings
        const newEmbeddings = await createContextEnrichedEmbeddings(batchTexts, documentMetadata);

        // Update embeddings and chunk metadata
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const newEmbedding = newEmbeddings[j];

          // Update embedding
          const { error: embeddingError } = await supabase
            .from('chunk_embeddings')
            .update({ embedding: newEmbedding })
            .eq('id', item.id);

          if (embeddingError) {
            console.error(`Error updating embedding ${item.id}:`, embeddingError);
            errors.push(`Embedding ${item.id}: ${embeddingError.message}`);
            errorCount++;
            continue;
          }

          // Update chunk metadata to mark as context-enriched
          const { error: chunkError } = await supabase
            .from('chunks')
            .update({
              metadata: {
                ...item.chunks.metadata,
                context_enriched: true,
                reprocessed_at: new Date().toISOString(),
                document_metadata: documentMetadata
              }
            })
            .eq('id', item.chunk_id);

          if (chunkError) {
            console.error(`Error updating chunk metadata ${item.chunk_id}:`, chunkError);
            errors.push(`Chunk ${item.chunk_id}: ${chunkError.message}`);
            errorCount++;
            continue;
          }

          processedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (batchError) {
        console.error(`Error processing batch starting at index ${i}:`, batchError);
        errors.push(`Batch ${i}: ${batchError.message}`);
        errorCount += batch.length;
      }
    }

    console.log(`Reprocessing completed: ${processedCount} embeddings updated, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed_count: processedCount,
      error_count: errorCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      total_found: embeddingsToUpdate.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reprocess-embeddings function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});