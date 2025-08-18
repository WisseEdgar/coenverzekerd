import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessTextRequest {
  title: string;
  text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create Supabase client with service role key for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    const { title, text }: ProcessTextRequest = await req.json();

    if (!title?.trim() || !text?.trim()) {
      throw new Error('Title and text are required');
    }

    console.log(`Processing manual text: ${title} (${text.length} characters)`);

    // Clean and normalize text
    const cleanText = text.trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    // Smart chunking - respect paragraph boundaries and markdown structure
    const chunks = createIntelligentChunks(cleanText);
    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks, openaiApiKey);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Create document record first
    const { data: document, error: docError } = await supabase
      .from('documents_v2')
      .insert({
        title: title.trim(),
        filename: `manual-${Date.now()}.txt`,
        file_path: null,
        processing_status: 'completed',
        extracted_text: cleanText,
        page_count: 1,
        token_count: Math.ceil(cleanText.length / 4),
        user_id: user.id,
        summary: generateSummary(cleanText),
      })
      .select()
      .single();

    if (docError) {
      console.error('Document creation error:', docError);
      throw new Error(`Failed to create document: ${docError.message}`);
    }

    console.log(`Created document: ${document.id}`);

    // Insert chunks and embeddings
    const chunksToInsert = chunks.map((chunk, index) => ({
      document_id: document.id,
      text: chunk,
      page: 1,
      token_count: Math.ceil(chunk.length / 4),
      metadata: { chunk_index: index }
    }));

    const { data: insertedChunks, error: chunkError } = await supabase
      .from('chunks')
      .insert(chunksToInsert)
      .select();

    if (chunkError) {
      console.error('Chunk insertion error:', chunkError);
      throw new Error(`Failed to create chunks: ${chunkError.message}`);
    }

    // Insert embeddings
    const embeddingsToInsert = insertedChunks!.map((chunk, index) => ({
      chunk_id: chunk.id,
      embedding: embeddings[index]
    }));

    const { error: embeddingError } = await supabase
      .from('chunk_embeddings')
      .insert(embeddingsToInsert);

    if (embeddingError) {
      console.error('Embedding insertion error:', embeddingError);
      throw new Error(`Failed to create embeddings: ${embeddingError.message}`);
    }

    console.log(`Successfully processed manual text: ${chunks.length} chunks, ${embeddings.length} embeddings`);

    return new Response(JSON.stringify({
      success: true,
      documentId: document.id,
      chunkCount: chunks.length,
      characterCount: cleanText.length,
      tokenCount: Math.ceil(cleanText.length / 4)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process manual text error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createIntelligentChunks(text: string, maxChunkSize = 800): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // If adding this paragraph would exceed max size, save current chunk
    if (currentChunk && (currentChunk.length + trimmedParagraph.length + 2) > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedParagraph;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedParagraph}` : trimmedParagraph;
    }
    
    // If single paragraph exceeds max size, split by sentences
    if (currentChunk.length > maxChunkSize) {
      const sentences = currentChunk.split(/[.!?]+\s+/);
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        if (sentenceChunk && (sentenceChunk.length + sentence.length + 2) > maxChunkSize) {
          if (sentenceChunk.trim()) {
            chunks.push(sentenceChunk.trim());
          }
          sentenceChunk = sentence;
        } else {
          sentenceChunk = sentenceChunk ? `${sentenceChunk}. ${sentence}` : sentence;
        }
      }
      
      currentChunk = sentenceChunk;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.map((item: any) => item.embedding);
}

function generateSummary(text: string): string {
  // Simple extractive summary - take first 2-3 sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const summary = sentences.slice(0, 3).join('. ').trim();
  return summary.length > 300 ? summary.substring(0, 297) + '...' : summary + '.';
}