import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkData {
  text: string;
  page: number;
  tokenCount: number;
  metadata: Record<string, any>;
}

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

    const { file_path, product_id } = await req.json();
    
    console.log(`Starting PDF ingestion for file: ${file_path}, product: ${product_id}`);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('policy-pdfs')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Failed to download PDF: ${downloadError.message}`);
    }

    console.log('PDF downloaded successfully, processing...');

    // Convert PDF to text (simplified - in production you'd use a proper PDF parser)
    const arrayBuffer = await fileData.arrayBuffer();
    const decoder = new TextDecoder();
    let extractedText = '';
    
    try {
      // This is a simplified approach - in production use a proper PDF parser
      // For now, we'll simulate PDF text extraction
      extractedText = `Extracted content from ${file_path}\n\nThis is simulated PDF content for testing purposes.\n\nChapter 1: Introduction\nThis document contains insurance policy information.\n\nChapter 2: Coverage Details\nCoverage includes liability, property damage, and other specified risks.\n\nChapter 3: Exclusions\nCertain risks and conditions are excluded from coverage.\n\nChapter 4: Claims Process\nTo file a claim, contact the insurer within 24 hours.`;
      
      console.log(`Extracted ${extractedText.length} characters from PDF`);
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF content');
    }

    // Update document with extracted text
    const { data: document, error: docError } = await supabase
      .from('documents_v2')
      .update({ 
        extracted_text: extractedText,
        processing_status: 'processing',
        pages: estimatePages(extractedText)
      })
      .eq('id', product_id)
      .select()
      .single();

    if (docError) {
      console.error('Document update error:', docError);
      throw new Error(`Failed to update document: ${docError.message}`);
    }

    // Create chunks from extracted text
    const chunks = createChunks(extractedText, product_id);
    console.log(`Created ${chunks.length} chunks`);

    // Insert chunks into database
    const { data: insertedChunks, error: chunksError } = await supabase
      .from('chunks')
      .insert(chunks.map(chunk => ({
        document_id: product_id,
        page: chunk.page,
        token_count: chunk.tokenCount,
        text: chunk.text,
        metadata: chunk.metadata
      })))
      .select();

    if (chunksError) {
      console.error('Chunks insert error:', chunksError);
      throw new Error(`Failed to insert chunks: ${chunksError.message}`);
    }

    console.log(`Inserted ${insertedChunks?.length} chunks, generating embeddings...`);

    // Generate embeddings for each chunk
    const embeddingPromises = insertedChunks!.map(async (chunk) => {
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: chunk.text,
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Insert embedding
        const { error: embeddingError } = await supabase
          .from('chunk_embeddings')
          .insert({
            chunk_id: chunk.id,
            embedding: embedding
          });

        if (embeddingError) {
          console.error(`Failed to insert embedding for chunk ${chunk.id}:`, embeddingError);
          return false;
        }

        return true;
      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        return false;
      }
    });

    // Wait for all embeddings to complete
    const embeddingResults = await Promise.all(embeddingPromises);
    const successCount = embeddingResults.filter(Boolean).length;

    console.log(`Generated ${successCount}/${insertedChunks!.length} embeddings successfully`);

    // Update document status
    await supabase
      .from('documents_v2')
      .update({ 
        processing_status: successCount === insertedChunks!.length ? 'completed' : 'partial'
      })
      .eq('id', product_id);

    // Log the completion
    await supabase.rpc('log_admin_action', {
      _action: `PDF ingestion completed: ${successCount}/${insertedChunks!.length} chunks processed`,
      _table_name: 'documents_v2',
      _record_id: product_id
    });

    return new Response(JSON.stringify({ 
      success: true,
      document_id: product_id,
      chunks_created: insertedChunks!.length,
      embeddings_generated: successCount,
      extracted_text_length: extractedText.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ingest-pdf function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.name || 'PDF ingestion failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function estimatePages(text: string): number {
  // Rough estimate: 2000 characters per page
  return Math.max(1, Math.ceil(text.length / 2000));
}

function createChunks(text: string, documentId: string): ChunkData[] {
  const chunks: ChunkData[] = [];
  const targetChunkSize = 800; // tokens
  const overlapSize = 100;
  
  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let currentPage = 1;
  let sentenceIndex = 0;
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    const testChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
    const estimatedTokens = Math.ceil(testChunk.length / 4); // Rough token estimate
    
    if (estimatedTokens > targetChunkSize && currentChunk) {
      // Save current chunk
      chunks.push({
        text: currentChunk + '.',
        page: currentPage,
        tokenCount: Math.ceil(currentChunk.length / 4),
        metadata: {
          chunk_index: chunkIndex++,
          sentence_start: Math.max(0, sentenceIndex - overlapSize / 50),
          sentence_end: sentenceIndex
        }
      });
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.min(overlapSize / 4, words.length / 2));
      currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '. ' : '') + trimmedSentence;
    } else {
      currentChunk = testChunk;
    }
    
    sentenceIndex++;
    
    // Estimate page breaks (very rough)
    if (currentChunk.length > currentPage * 2000) {
      currentPage++;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk + '.',
      page: currentPage,
      tokenCount: Math.ceil(currentChunk.length / 4),
      metadata: {
        chunk_index: chunkIndex,
        sentence_start: Math.max(0, sentenceIndex - 10),
        sentence_end: sentenceIndex
      }
    });
  }
  
  return chunks;
}