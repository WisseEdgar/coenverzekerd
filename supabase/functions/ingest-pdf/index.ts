import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface PageText {
  page: number;
  text: string;
}

function chunkText(page: number, text: string, maxSize = 4000, overlap = 400): Array<{page: number, text: string, tokenCount: number}> {
  const chunks = [];
  // Simple token estimation: ~4 chars per token
  const estimatedTokens = Math.ceil(text.length / 4);
  
  if (estimatedTokens <= maxSize) {
    return [{
      page,
      text,
      tokenCount: estimatedTokens
    }];
  }
  
  const chunkSize = maxSize * 4; // Convert back to characters
  const overlapSize = overlap * 4;
  
  for (let i = 0; i < text.length; i += (chunkSize - overlapSize)) {
    const chunkText = text.slice(i, i + chunkSize);
    if (chunkText.trim().length > 0) {
      chunks.push({
        page,
        text: chunkText,
        tokenCount: Math.ceil(chunkText.length / 4)
      });
    }
  }
  
  return chunks;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
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

// Simple PDF text extraction fallback (placeholder)
function extractTextFromPDF(buffer: ArrayBuffer): PageText[] {
  // This is a placeholder - in production you'd use a proper PDF parser
  const text = new TextDecoder().decode(buffer);
  
  // Try to extract readable text and split into reasonable pages
  const cleanText = text.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (cleanText.length < 100) {
    throw new Error('Could not extract readable text from PDF');
  }
  
  // Split into chunks that represent "pages" (rough estimation)
  const wordsPerPage = 500;
  const words = cleanText.split(' ');
  const pages: PageText[] = [];
  
  for (let i = 0; i < words.length; i += wordsPerPage) {
    const pageWords = words.slice(i, i + wordsPerPage);
    const pageText = pageWords.join(' ');
    
    if (pageText.trim().length > 0) {
      pages.push({
        page: Math.floor(i / wordsPerPage) + 1,
        text: pageText
      });
    }
  }
  
  return pages.length > 0 ? pages : [{ page: 1, text: cleanText }];
}

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
    
    console.log('Ingest PDF request:', { document_id: body.document_id, has_file_path: !!body.file_path, has_pages: !!body.pages });

    let pages: PageText[] = [];

    if (body.pages && Array.isArray(body.pages)) {
      // Client-side fallback: pages already extracted
      pages = body.pages;
      console.log(`Using client-provided pages: ${pages.length} pages`);
    } else if (body.file_path) {
      // Server-side PDF processing
      console.log(`Downloading PDF from storage: ${body.file_path}`);
      
      const { data: file, error: downloadError } = await supabase.storage
        .from('policy-pdfs')
        .download(body.file_path);
      
      if (downloadError) {
        console.error('Storage download error:', downloadError);
        throw new Error(`Failed to download PDF: ${downloadError.message}`);
      }

      const arrayBuffer = await file.arrayBuffer();
      pages = extractTextFromPDF(arrayBuffer);
      console.log(`Extracted ${pages.length} pages from PDF`);
    } else {
      throw new Error('Either file_path or pages must be provided');
    }

    if (pages.length === 0) {
      throw new Error('No text content found in document');
    }

    // Create chunks from all pages
    const allChunks = pages.flatMap(page => chunkText(page.page, page.text));
    console.log(`Created ${allChunks.length} chunks`);

    if (allChunks.length === 0) {
      throw new Error('No chunks created from document');
    }

    // Generate embeddings in batches to avoid token limits
    const BATCH_SIZE = 32;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map(chunk => chunk.text);
      
      console.log(`Processing embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allChunks.length/BATCH_SIZE)}`);
      
      const embeddings = await embedTexts(batchTexts);
      allEmbeddings.push(...embeddings);
    }

    console.log(`Generated ${allEmbeddings.length} embeddings`);

    // Insert chunks into database
    const chunksToInsert = allChunks.map(chunk => ({
      document_id: body.document_id,
      page: chunk.page,
      text: chunk.text,
      token_count: chunk.tokenCount,
      metadata: {}
    }));

    const { data: insertedChunks, error: chunksError } = await supabase
      .from('chunks')
      .insert(chunksToInsert)
      .select('id');

    if (chunksError) {
      console.error('Error inserting chunks:', chunksError);
      throw new Error(`Failed to insert chunks: ${chunksError.message}`);
    }

    console.log(`Inserted ${insertedChunks.length} chunks`);

    // Insert embeddings
    const embeddingsToInsert = insertedChunks.map((chunk: any, index: number) => ({
      chunk_id: chunk.id,
      embedding: allEmbeddings[index]
    }));

    const { error: embeddingsError } = await supabase
      .from('chunk_embeddings')
      .insert(embeddingsToInsert);

    if (embeddingsError) {
      console.error('Error inserting embeddings:', embeddingsError);
      throw new Error(`Failed to insert embeddings: ${embeddingsError.message}`);
    }

    console.log(`Inserted ${embeddingsToInsert.length} embeddings`);

    // Update document processing status
    const { error: updateError } = await supabase
      .from('documents_v2')
      .update({ 
        processing_status: 'completed',
        pages: pages.length
      })
      .eq('id', body.document_id);

    if (updateError) {
      console.warn('Warning: Could not update document status:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      document_id: body.document_id,
      pages: pages.length,
      chunks: insertedChunks.length,
      embeddings: embeddingsToInsert.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ingest-pdf function:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});