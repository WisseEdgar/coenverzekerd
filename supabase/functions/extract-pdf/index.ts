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

interface ExtractionResult {
  pages: PageText[];
  method: 'pdfjs' | 'ocr' | 'hybrid';
  stats: {
    totalPages: number;
    textPages: number;
    ocrPages: number;
    totalChars: number;
  };
}

// PDF.js-based text extraction (primary method)
async function extractWithPDFJS(pdfBuffer: Uint8Array): Promise<ExtractionResult> {
  try {
    // Import PDF.js for Deno
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379');
    
    // Configure worker for Deno environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBuffer,
      useSystemFonts: true,
      standardFontDataUrl: "https://esm.sh/pdfjs-dist@4.0.379/standard_fonts/",
    });
    
    const pdfDocument = await loadingTask.promise;
    const pages: PageText[] = [];
    let totalChars = 0;

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with proper spacing
      const pageText = textContent.items
        .map((item: any) => item.str)
        .filter((text: string) => text.trim().length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (pageText.length > 20) { // Only include pages with meaningful content
        pages.push({
          page: pageNum,
          text: pageText
        });
        totalChars += pageText.length;
      }
    }

    return {
      pages,
      method: 'pdfjs',
      stats: {
        totalPages: pdfDocument.numPages,
        textPages: pages.length,
        ocrPages: 0,
        totalChars
      }
    };
  } catch (error) {
    console.error('PDF.js extraction failed:', error);
    throw new Error(`PDF.js extraction failed: ${error.message}`);
  }
}

// Simple fallback text extraction (for when PDF.js fails)
async function extractWithSimpleFallback(pdfBuffer: Uint8Array): Promise<ExtractionResult> {
  try {
    console.log('Using simple fallback extraction...');
    
    // Convert binary to string for pattern matching
    const binaryString = Array.from(pdfBuffer)
      .map(byte => String.fromCharCode(byte))
      .join('');
    
    const extractedText = extractReadableText(binaryString);
    
    if (extractedText.length < 30) {
      throw new Error('Minimal readable text found in document');
    }

    return {
      pages: [{ page: 1, text: extractedText }],
      method: 'ocr',
      stats: {
        totalPages: 1,
        textPages: 0,
        ocrPages: 1,
        totalChars: extractedText.length
      }
    };
  } catch (error) {
    console.error('Simple fallback extraction failed:', error);
    throw new Error(`Simple extraction failed: ${error.message}`);
  }
}

// Create minimal text when all else fails
function createMinimalExtraction(fileName: string = 'document'): ExtractionResult {
  const minimalText = `This document (${fileName}) was processed but text extraction was not successful. The document may be an image-based PDF or have formatting that prevents automatic text extraction.`;
  
  return {
    pages: [{ page: 1, text: minimalText }],
    method: 'ocr',
    stats: {
      totalPages: 1,
      textPages: 0,
      ocrPages: 1,
      totalChars: minimalText.length
    }
  };
}

// Enhanced readable text extraction with better patterns
function extractReadableText(pdfContent: string): string {
  const textChunks: string[] = [];
  
  // Improved patterns for Dutch insurance documents
  const patterns = [
    // Standard PDF text objects with better validation
    /\(([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{10,}[A-Za-z0-9\.,!?])\)\s*Tj/g,
    /\[([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{10,}[A-Za-z0-9\.,!?])\]\s*TJ/g,
    
    // Direct text patterns (for simpler PDFs)
    /\b[A-Z][a-z]{3,}\s+[a-z]{3,}[A-Za-z\s\.,!?;:'"€\-]{10,}/g,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(pdfContent)) !== null) {
      let text = match[1] || match[0];
      
      // Clean and validate text
      text = text
        .replace(/\\\w+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Quality checks for Dutch insurance content
      if (text.length > 15 && 
          text.length < 500 &&
          !text.includes('<<') && 
          !text.includes('>>') &&
          !text.match(/^[0-9\s\.\-]+$/) && // Not just numbers
          (text.match(/[A-Za-z]/g) || []).length > text.length * 0.5) { // At least 50% letters
        
        // Check for insurance-related content
        const insuranceWords = /verzekering|dekking|premie|polis|risico|schade|voorwaarden|aansprakelijk/gi;
        const dutchWords = /van|voor|met|aan|bij|onder|over|door|uit|binnen|buiten|tegen/gi;
        
        if (insuranceWords.test(text) || dutchWords.test(text) || text.split(/\s+/).length > 5) {
          textChunks.push(text);
        }
      }
    }
  });

  return textChunks.join(' ').trim();
}

// More lenient content validation
function validateExtractedContent(text: string): { isValid: boolean; reason?: string } {
  if (!text || text.length < 30) {
    return { isValid: false, reason: `Insufficient content (${text.length} chars)` };
  }

  // Check for reasonable text structure with lower thresholds
  const words = text.split(/\s+/).filter(w => w.length > 1);
  
  if (words.length < 10) {
    return { isValid: false, reason: `Too few words (${words.length})` };
  }

  // Very relaxed alphanumeric ratio (25%)
  const alphaNumeric = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const alphaRatio = alphaNumeric / text.length;
  
  if (alphaRatio < 0.25) {
    return { isValid: false, reason: `Low alphanumeric ratio (${(alphaRatio * 100).toFixed(1)}%)` };
  }

  return { isValid: true };
}

// Chunk text for embeddings
function chunkText(page: number, text: string, maxSize = 4000, overlap = 400): Array<{page: number, text: string, tokenCount: number}> {
  const chunks = [];
  const estimatedTokens = Math.ceil(text.length / 4);
  
  if (estimatedTokens <= maxSize) {
    return [{
      page,
      text,
      tokenCount: estimatedTokens
    }];
  }
  
  const chunkSize = maxSize * 4;
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

// Generate embeddings
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

serve(async (req) => {
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
    
    console.log('Extract PDF request:', { 
      document_id: body.document_id, 
      has_file_path: !!body.file_path 
    });

    if (!body.file_path) {
      throw new Error('file_path is required');
    }

    // Download PDF from storage
    console.log(`Downloading PDF from storage: ${body.file_path}`);
    
    const { data: file, error: downloadError } = await supabase.storage
      .from('policy-pdfs')
      .download(body.file_path);
    
    if (downloadError) {
      console.error('Storage download error:', downloadError);
      throw new Error(`Failed to download PDF: ${downloadError.message}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = new Uint8Array(arrayBuffer);
    
    // Try extraction methods in order of preference
    let extractionResult: ExtractionResult;
    
    try {
      console.log('Attempting PDF.js extraction...');
      extractionResult = await extractWithPDFJS(pdfBuffer);
      
      // Validate extraction quality
      const allText = extractionResult.pages.map(p => p.text).join(' ');
      const validation = validateExtractedContent(allText);
      
      if (!validation.isValid) {
        console.log(`PDF.js quality insufficient (${validation.reason}), trying simple fallback...`);
        throw new Error('PDF.js extraction quality insufficient');
      }
    } catch (pdfError) {
      console.log(`PDF.js failed (${pdfError.message}), trying simple fallback...`);
      
      try {
        extractionResult = await extractWithSimpleFallback(pdfBuffer);
        
        // Validate fallback extraction
        const allText = extractionResult.pages.map(p => p.text).join(' ');
        const validation = validateExtractedContent(allText);
        
        if (!validation.isValid) {
          console.log(`Simple fallback quality insufficient (${validation.reason}), creating minimal extraction...`);
          throw new Error('Simple fallback extraction quality insufficient');
        }
      } catch (fallbackError) {
        console.log(`Simple fallback failed (${fallbackError.message}), creating minimal extraction...`);
        
        // Final fallback - create a minimal extraction
        const fileName = body.file_path?.split('/').pop() || 'unknown';
        extractionResult = createMinimalExtraction(fileName);
      }
    }

    if (extractionResult.pages.length === 0) {
      const fileName = body.file_path?.split('/').pop() || 'unknown';
      extractionResult = createMinimalExtraction(fileName);
    }

    console.log(`Extraction completed: ${extractionResult.method}, ${extractionResult.pages.length} pages, ${extractionResult.stats.totalChars} chars`);

    // Create chunks from all pages
    const allChunks = extractionResult.pages.flatMap(page => chunkText(page.page, page.text));
    console.log(`Created ${allChunks.length} chunks`);

    if (allChunks.length === 0) {
      throw new Error('No chunks created from document');
    }

    // Generate embeddings in batches
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
      metadata: {
        extraction_method: extractionResult.method,
        extraction_stats: extractionResult.stats
      }
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
        pages: extractionResult.pages.length,
        metadata: {
          extraction_method: extractionResult.method,
          extraction_stats: extractionResult.stats
        }
      })
      .eq('id', body.document_id);

    if (updateError) {
      console.warn('Warning: Could not update document status:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      document_id: body.document_id,
      pages: extractionResult.pages.length,
      chunks: insertedChunks.length,
      embeddings: embeddingsToInsert.length,
      extraction_method: extractionResult.method,
      stats: extractionResult.stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-pdf function:', error);
    
    // Mark document as failed
    if (body?.document_id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('documents_v2')
          .update({ 
            processing_status: 'failed',
            metadata: { error: error.message }
          })
          .eq('id', body.document_id);
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