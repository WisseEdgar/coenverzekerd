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

// Enhanced PDF text extraction with robust parsing
async function extractTextFromPDF(buffer: ArrayBuffer, filename: string): Promise<PageText[]> {
  console.log(`Starting PDF text extraction for: ${filename}`);
  
  const uint8Array = new Uint8Array(buffer);
  let extractedText = '';
  let extractionMethod = '';
  
  try {
    // Phase 1: Primary extraction using pdf-parse library
    try {
      const pdfParse = await import('https://esm.sh/pdf-parse@1.1.1');
      const pdfData = await pdfParse.default(uint8Array);
      extractedText = pdfData.text || '';
      extractionMethod = 'pdf-parse';
      console.log(`Primary extraction (${extractionMethod}): ${extractedText.length} characters`);
    } catch (pdfParseError) {
      console.warn(`Primary extraction failed: ${pdfParseError.message}, trying fallback`);
      
      // Phase 2: Secondary extraction using JSR pdf-parse
      try {
        const { default: jsrPdfParse } = await import('https://esm.sh/@lino/pdf-parse@1.0.0');
        const pdfData = await jsrPdfParse(uint8Array);
        extractedText = pdfData.text || '';
        extractionMethod = 'jsr-pdf-parse';
        console.log(`Secondary extraction (${extractionMethod}): ${extractedText.length} characters`);
      } catch (jsrError) {
        console.warn(`Secondary extraction failed: ${jsrError.message}, using advanced fallback`);
        
        // Phase 3: Advanced fallback extraction
        extractedText = await extractTextAdvancedFallback(uint8Array);
        extractionMethod = 'advanced-fallback';
        console.log(`Fallback extraction (${extractionMethod}): ${extractedText.length} characters`);
      }
    }
    
    // Phase 2: Content validation and quality checks
    const validationResult = await validateExtractedContent(extractedText, filename);
    if (!validationResult.isValid) {
      throw new Error(`Content validation failed: ${validationResult.reason}`);
    }
    
    // Phase 3: Content preprocessing
    const processedText = preprocessExtractedText(extractedText);
    
    // Phase 4: Intelligent page splitting
    const pages = splitIntoLogicalPages(processedText, extractionMethod);
    
    console.log(`Successfully extracted ${pages.length} pages from ${filename} using ${extractionMethod}`);
    return pages;
    
  } catch (error) {
    console.error(`All PDF extraction methods failed for ${filename}:`, error);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

// Advanced fallback text extraction with better heuristics
async function extractTextAdvancedFallback(uint8Array: Uint8Array): Promise<string> {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
  
  // Method 1: Extract from PDF text objects with improved patterns
  const textObjects: string[] = [];
  
  // Look for different text encoding patterns - more selective
  const patterns = [
    /BT\s+(.*?)\s+ET/gs,                    // Basic text objects (more strict)
    /\(([^)]{4,})\)\s*Tj/g,                 // Simple text showing (min 4 chars)
    /\[([^\]]{10,})\]\s*TJ/g,               // Text array showing (min 10 chars)
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let textContent = match[1]
        .replace(/Tj|TJ|Td|TD|Tm|Tf/g, ' ')
        .replace(/\/F\d+/g, '')
        .replace(/\[|\]/g, '')
        .replace(/\(|\)/g, '')
        .replace(/[0-9\.\-\s]{3,}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // More strict filtering - must contain actual words
      if (textContent.length > 10 && 
          /[a-zA-Z]{3,}/.test(textContent) && 
          textContent.split(/\s+/).filter(w => w.length > 2).length > 2) {
        textObjects.push(textContent);
      }
    }
  });
  
  let combinedText = textObjects.join(' ').trim();
  
  // Method 2: Only attempt if we found some potential text
  if (combinedText.length < 100 && combinedText.length > 0) {
    console.log('Attempting selective character extraction');
    const readableChars = text
      .replace(/[^\x20-\x7E\u00A0-\u017F\u0100-\u024F]/g, ' ') // Keep ASCII + Latin extensions
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word)) // Only pure alphabetic words
      .join(' ')
      .trim();
    
    if (readableChars.length > combinedText.length && readableChars.length > 100) {
      combinedText = readableChars;
    }
  }
  
  // Fail gracefully if we only have binary/metadata
  if (combinedText.length < 50 || 
      combinedText.includes('%PDF') ||
      combinedText.includes('endobj') ||
      combinedText.includes('xref')) {
    throw new Error('PDF contains only binary data or metadata - no readable text found');
  }
  
  return combinedText;
}

// Enhanced content validation
async function validateExtractedContent(text: string, filename: string): Promise<{isValid: boolean, reason?: string}> {
  // Basic length check
  if (!text || text.length < 50) {
    return { isValid: false, reason: `Insufficient content (${text.length} chars)` };
  }
  
  // Check for mock/sample data patterns
  const lowerText = text.toLowerCase();
  const mockPatterns = [
    'sample extracted text',
    'this is a sample',
    'lorem ipsum',
    'pdf text extraction failed',
    'test document',
    'dummy content'
  ];
  
  for (const pattern of mockPatterns) {
    if (lowerText.includes(pattern)) {
      return { isValid: false, reason: `Contains mock data pattern: ${pattern}` };
    }
  }
  
  // Check text quality - should have reasonable word/sentence structure
  const words = text.split(/\s+/).filter(w => w.length > 2);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (words.length < 20) {
    return { isValid: false, reason: `Too few meaningful words (${words.length})` };
  }
  
  if (sentences.length < 3) {
    return { isValid: false, reason: `Too few sentences (${sentences.length})` };
  }
  
  // Check for reasonable character distribution
  const alphaNumeric = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const alphaRatio = alphaNumeric / text.length;
  
  if (alphaRatio < 0.6) {
    return { isValid: false, reason: `Low alphanumeric ratio (${(alphaRatio * 100).toFixed(1)}%)` };
  }
  
  return { isValid: true };
}

// Enhanced text preprocessing
function preprocessExtractedText(text: string): string {
  return text
    // Remove PDF artifacts
    .replace(/\0/g, '')                     // Null characters
    .replace(/\f/g, '\n\n')                 // Form feeds to double newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ') // Control characters
    
    // Normalize spacing
    .replace(/[ \t]+/g, ' ')                // Multiple spaces/tabs to single space
    .replace(/\n\s*\n\s*\n+/g, '\n\n')     // Multiple newlines to double newlines
    .replace(/^\s+|\s+$/gm, '')             // Trim lines
    
    // Fix common PDF extraction issues
    .replace(/([a-z])([A-Z])/g, '$1 $2')    // Add space between camelCase
    .replace(/(\w)(\d)/g, '$1 $2')          // Space between letters and numbers
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')    // Space between numbers and letters
    
    // Clean up
    .trim();
}

// Intelligent page splitting with better logic
function splitIntoLogicalPages(text: string, extractionMethod: string): PageText[] {
  // Method 1: Look for explicit page indicators
  const pageIndicators = [
    /\f/g,                                  // Form feed characters
    /\bpagina\s+\d+\b/gi,                  // Dutch page numbers
    /\bbladzijde\s+\d+\b/gi,               // Dutch page references
    /\bpage\s+\d+\b/gi,                    // English page numbers
    /^\s*\d+\s*$/gm                        // Standalone numbers (potential page numbers)
  ];
  
  let pages: string[] = [];
  let remainingText = text;
  
  // Try to split by page indicators
  for (const indicator of pageIndicators) {
    const splits = remainingText.split(indicator);
    if (splits.length > 1) {
      pages = splits.filter(split => split.trim().length > 100);
      break;
    }
  }
  
  // Method 2: If no clear indicators, split by content patterns
  if (pages.length <= 1) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    
    if (paragraphs.length > 10) {
      // Group paragraphs into logical pages
      const wordsPerPage = 1000;
      pages = [];
      let currentPage = '';
      let currentWordCount = 0;
      
      for (const paragraph of paragraphs) {
        const words = paragraph.trim().split(/\s+/).length;
        
        if (currentWordCount + words > wordsPerPage && currentPage.length > 200) {
          pages.push(currentPage.trim());
          currentPage = paragraph;
          currentWordCount = words;
        } else {
          currentPage += (currentPage ? '\n\n' : '') + paragraph;
          currentWordCount += words;
        }
      }
      
      if (currentPage.trim().length > 100) {
        pages.push(currentPage.trim());
      }
    }
  }
  
  // Method 3: Fallback to simple length-based splitting
  if (pages.length === 0) {
    const wordsPerPage = 800;
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i += wordsPerPage) {
      const pageWords = words.slice(i, i + wordsPerPage);
      const pageText = pageWords.join(' ').trim();
      
      if (pageText.length > 100) {
        pages.push(pageText);
      }
    }
  }
  
  // Convert to PageText objects
  const result = pages.map((pageText, index) => ({
    page: index + 1,
    text: pageText
  }));
  
  // Ensure we have at least one page
  if (result.length === 0) {
    result.push({ page: 1, text: text });
  }
  
  return result;
}


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = null;
  
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    body = await req.json();
    
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
      pages = await extractTextFromPDF(arrayBuffer, body.file_path.split('/').pop() || 'unknown.pdf');
      console.log(`Extracted ${pages.length} pages from PDF`);
    } else {
      throw new Error('Either file_path or pages must be provided');
    }

    if (pages.length === 0) {
      throw new Error('No text content found in document');
    }

    // Enhanced content validation with detailed error tracking
    const allText = pages.map(p => p.text).join(' ');
    const contentValidation = await validateExtractedContent(allText, body.file_path || 'unknown');
    
    if (!contentValidation.isValid) {
      const detailedError = `Content validation failed: ${contentValidation.reason}`;
      console.error('Content validation failed:', contentValidation);
      throw new Error(detailedError);
    }

    console.log(`Content validation passed, ${allText.length} characters extracted`);

    // Create chunks from all pages with improved chunking
    const allChunks = pages.flatMap(page => chunkText(page.page, page.text));
    console.log(`Created ${allChunks.length} chunks from ${pages.length} pages`);

    if (allChunks.length === 0) {
      throw new Error('No chunks created from document - content may be corrupted');
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

    // Update document processing status to completed
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
    
    // Mark document as failed when processing fails
    if (body?.document_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('documents_v2')
          .update({ processing_status: 'failed' })
          .eq('id', body.document_id);
        
        // Create a failed extraction chunk for detection
        const { data: failedChunk } = await supabase
          .from('chunks')
          .insert({
            document_id: body.document_id,
            page: 1,
            text: `PDF text extraction failed: ${error.message}`,
            token_count: 10,
            metadata: { extraction_failed: true }
          });
      } catch (updateError) {
        console.warn('Could not update document status to failed:', updateError);
      }
    }
    
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});