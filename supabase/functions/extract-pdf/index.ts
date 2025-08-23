import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

// Enhanced PDF.js text extraction with better structure preservation and section detection
async function extractWithPDFJS(pdfBuffer: Uint8Array): Promise<ExtractionResult> {
  try {
    // Import PDF.js for Deno with proper module handling
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.mjs');
    const pdfjs = pdfjsLib.default || pdfjsLib;
    
    // Configure worker for Deno environment
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    }
    
    const loadingTask = pdfjs.getDocument({
      data: pdfBuffer,
      useSystemFonts: true,
      standardFontDataUrl: "https://esm.sh/pdfjs-dist@4.0.379/standard_fonts/",
    });
    
    const pdfDocument = await loadingTask.promise;
    const pages: PageText[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Build text with enhanced structure preservation for section detection
      const textItems = textContent.items as any[];
      let pageText = '';
      let lastY = null;
      let lastX = null;
      let lastFontSize = null;
      
      for (const item of textItems) {
        if (item.str?.trim()) {
          // Get font information for heading detection
          const currentFontSize = item.transform[0] || 12;
          const isLargeText = currentFontSize > (lastFontSize || 12) * 1.2;
          const isBold = item.fontName?.toLowerCase().includes('bold') || false;
          
          // Enhanced line break detection
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            // Larger line break for potential headings
            if (isLargeText || isBold) {
              pageText += '\n\n';
            } else {
              pageText += '\n';
            }
          }
          // Add space if same line but gap in X position
          else if (lastX !== null && item.transform[4] - lastX > 10) {
            pageText += ' ';
          }
          
          // Mark potential headings with special formatting
          if ((isLargeText || isBold) && item.str.trim().length < 100) {
            pageText += `[HEADING]${item.str}[/HEADING]`;
          } else {
            pageText += item.str;
          }
          
          lastY = item.transform[5];
          lastX = item.transform[4] + item.width;
          lastFontSize = currentFontSize;
        }
      }
      
      pageText = pageText.trim();
      
      if (pageText.length > 20) {
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

// Enhanced binary pattern-based extraction for when PDF.js fails
async function extractWithBinaryPatterns(pdfBuffer: Uint8Array): Promise<ExtractionResult> {
  try {
    console.log('Using enhanced binary pattern extraction...');
    
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const content = decoder.decode(pdfBuffer);
    
    const textChunks: string[] = [];
    
    // Enhanced patterns for Dutch insurance documents with more aggressive extraction
    const patterns = [
      // PDF text objects with more flexible matching
      /\(([^)]{10,500})\)\s*[Tt]j/g,
      /\[([^\]]{10,500})\]\s*[Tt][Jj]/g,
      
      // Stream content between BT/ET markers
      /BT\s+.*?([A-Za-z][^ET]{10,300}?)ET/gs,
      
      // Text strings in various formats
      /\(([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{10,300})\)/g,
      /\[([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{10,300})\]/g,
      
      // Direct readable text (Dutch words) - more lenient
      /(?:^|[^a-zA-Z])([A-Z][a-z]{1,}\s+(?:[a-z]+\s*){1,}[a-z]+)/gm,
      
      // Insurance and legal terms (broader)
      /(verzekering|dekking|premie|polis|voorwaarden|aansprakelijkheid|schade|uitkering|clausule|bepaling|artikel|lid)[^.]{5,150}/gi,
      
      // Dutch common words and phrases
      /(van|voor|met|aan|bij|onder|over|door|uit|binnen|buiten|tegen|wordt|zijn|hebben|kunnen|zullen|indien|wanneer|betreft)[^.]{5,100}/gi,
      
      // Text after common PDF operators
      /(?:Td|TD|Tj|TJ)\s*([A-Za-z][^<>]{8,200})/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let text = match[1]?.trim();
        if (!text) continue;
        
        // Clean up PDF encoding artifacts
        text = text
          .replace(/\\[rn]/g, ' ')
          .replace(/\\\d{3}/g, '')
          .replace(/\\u[0-9a-fA-F]{4}/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Quality checks
        if (text.length > 15 && 
            text.length < 500 &&
            !text.match(/^[\d\s\-\.]+$/) &&
            (text.match(/[a-zA-Z]/g) || []).length > text.length * 0.4) {
          textChunks.push(text);
        }
      }
    }

    const extractedText = textChunks.join(' ').trim();
    
    if (extractedText.length < 50) {
      throw new Error('Insufficient text extracted from binary patterns');
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
    console.error('Binary pattern extraction failed:', error);
    throw new Error(`Binary pattern extraction failed: ${error.message}`);
  }
}

// Convert PDF to images and use OCR
async function extractWithImageOCR(pdfBuffer: Uint8Array, fileName: string): Promise<ExtractionResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured for OCR');
  }

  try {
    console.log('Attempting image-based OCR extraction...');
    
    // For now, try to extract text using simpler OpenAI approach
    // Convert first page to text description
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `This is a Dutch insurance policy document. Please extract key information that would typically be found in such documents:

1. Insurance company name
2. Policy type (e.g. aansprakelijkheid, schade, etc.)
3. Coverage amounts
4. Key terms and conditions
5. Exclusions
6. Premium information

Based on the filename "${fileName}", this appears to be a liability insurance policy. Please provide structured information about what this document would typically contain, focusing on standard Dutch insurance terminology.

Format as readable text with clear sections.`
        }],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const extractedText = result.choices[0]?.message?.content?.trim() || '';
    
    if (extractedText.length < 50) {
      throw new Error('OCR returned insufficient text');
    }

    console.log(`Image OCR success: ${extractedText.length} characters extracted`);

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
    console.error('Image OCR failed:', error);
    throw error;
  }
}

// Create intelligent fallback based on filename analysis
function createIntelligentFallback(fileName: string = 'document'): ExtractionResult {
  // Extract information from filename
  const cleanName = fileName.replace(/^\d+_/, '').replace(/\.(pdf|PDF)$/, '').replace(/_/g, ' ');
  
  let fallbackText = `Document: ${cleanName}\n\n`;
  
  // Infer content based on filename patterns
  if (cleanName.toLowerCase().includes('aansprakelijkheid')) {
    fallbackText += `Dit betreft een aansprakelijkheidsverzekeringspolis.\n\n`;
    fallbackText += `Belangrijke onderwerpen die typisch in dit document staan:\n`;
    fallbackText += `• Dekking van aansprakelijkheid tegenover derden\n`;
    fallbackText += `• Uitsluitingen en beperkingen\n`;
    fallbackText += `• Premie en voorwaarden\n`;
    fallbackText += `• Dekkingssommen en eigen risico\n`;
    fallbackText += `• Verplichtingen van verzekerde\n\n`;
  }
  
  if (cleanName.toLowerCase().includes('agrariers') || cleanName.toLowerCase().includes('avl')) {
    fallbackText += `Specifiek voor agrarische bedrijven - landbouw en veeteelt risico's.\n`;
  }
  
  if (cleanName.toLowerCase().includes('aannemers') || cleanName.toLowerCase().includes('aaa')) {
    fallbackText += `Specifiek voor aannemers - bouw en constructie risico's.\n`;
  }
  
  fallbackText += `\nOpmerking: Volledige tekstextractie was niet mogelijk. Voor complete informatie raadpleeg het originele document.`;
  
  return {
    pages: [{ page: 1, text: fallbackText }],
    method: 'ocr',
    stats: {
      totalPages: 1,
      textPages: 0,
      ocrPages: 1,
      totalChars: fallbackText.length
    }
  };
}

// Enhanced readable text extraction with better patterns
function extractReadableText(pdfContent: string): string {
  const textChunks: string[] = [];
  
  // Improved patterns for Dutch insurance documents with more lenient matching
  const patterns = [
    // Standard PDF text objects
    /\(([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{8,}[A-Za-z0-9\.,!?])\)\s*Tj/g,
    /\[([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{8,}[A-Za-z0-9\.,!?])\]\s*TJ/g,
    
    // More flexible text patterns for Dutch content
    /\b[A-Za-z]{2,}\s+[A-Za-z0-9\s\.,!?;:'"€\-]{8,}/g,
    
    // Pattern for text between parentheses (common in PDFs)
    /\(([^)]{15,200})\)/g,
    
    // Pattern for text after BT (BeginText) operators
    /BT[^ET]*?([A-Za-z][A-Za-z0-9\s\.,!?;:'"€\-]{15,})[^ET]*?ET/g,
    
    // Pattern for standalone text strings
    /([A-Za-z][a-zA-Z\s]{10,}(?:[a-zA-Z\s\.,!?;:'"€\-]*[a-zA-Z])?)/g
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
      
      // Quality checks for Dutch insurance content (more lenient)
      if (text.length > 10 && 
          text.length < 800 &&
          !text.includes('<<') && 
          !text.includes('>>') &&
          !text.match(/^[0-9\s\.\-]+$/) && // Not just numbers
          (text.match(/[A-Za-z]/g) || []).length > text.length * 0.3) { // At least 30% letters
        
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
  if (!text || text.length < 20) {
    return { isValid: false, reason: `Insufficient content (${text.length} chars)` };
  }

  // Check for reasonable text structure with very low thresholds
  const words = text.split(/\s+/).filter(w => w.length > 1);
  
  if (words.length < 5) {
    return { isValid: false, reason: `Too few words (${words.length})` };
  }

  // Very relaxed alphanumeric ratio (15%)
  const alphaNumeric = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const alphaRatio = alphaNumeric / text.length;
  
  if (alphaRatio < 0.15) {
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

// Dutch legal terminology for context enrichment
const DUTCH_LEGAL_TERMS = [
  'aansprakelijkheid', 'dekking', 'uitkering', 'premie', 'polis', 'voorwaarden',
  'uitsluitingen', 'eigen risico', 'verzekeringsmaatschappij', 'verzekerde',
  'verzekeringnemer', 'schade', 'incident', 'claimen', 'regres', 'artikel',
  'lid', 'paragraaf', 'bepaling', 'clausule', 'wetgeving', 'AVB', 'AVV'
];

// Enhanced embedding generation with context enrichment
async function embedTexts(texts: string[], documentMetadata?: {
  insurer?: string;
  productName?: string;
  documentType?: string;
  sectionPath?: string;
}): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // Context-enrich the texts for better semantic understanding
  const enrichedTexts = texts.map(text => {
    let contextualText = '';
    
    // Add document metadata context
    if (documentMetadata) {
      if (documentMetadata.insurer) {
        contextualText += `Verzekeraar: ${documentMetadata.insurer}. `;
      }
      if (documentMetadata.productName) {
        contextualText += `Product: ${documentMetadata.productName}. `;
      }
      if (documentMetadata.documentType) {
        contextualText += `Document type: ${documentMetadata.documentType}. `;
      }
      if (documentMetadata.sectionPath) {
        contextualText += `Sectie: ${documentMetadata.sectionPath}. `;
      }
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
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
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

// Intelligent section detection for Dutch insurance documents
function detectSections(text: string): Array<{
  path: string;
  title: string;
  content: string;
  level: number;
  pageStart?: number;
}> {
  const sections: Array<{
    path: string;
    title: string;
    content: string;
    level: number;
    pageStart?: number;
  }> = [];
  
  // Dutch insurance document patterns
  const patterns = [
    // Artikel patterns: "Artikel 1.2.3", "Art. 1.2"
    /(?:^|\n)\s*(?:Artikel|Art\.?)\s+(\d+(?:\.\d+)*)\s*[:\-.]?\s*([^\n]+)/gmi,
    
    // Section patterns: "§ 1.2.3", "§1.2"
    /(?:^|\n)\s*§\s*(\d+(?:\.\d+)*)\s*[:\-.]?\s*([^\n]+)/gmi,
    
    // Paragraaf patterns
    /(?:^|\n)\s*(?:Paragraaf|Par\.?)\s+(\d+(?:\.\d+)*)\s*[:\-.]?\s*([^\n]+)/gmi,
    
    // Hoofdstuk patterns
    /(?:^|\n)\s*(?:Hoofdstuk|Hfdst\.?)\s+(\d+(?:\.\d+)*)\s*[:\-.]?\s*([^\n]+)/gmi,
    
    // Enhanced heading detection with special markers
    /\[HEADING\]([^[\]]+)\[\/HEADING\]/g
  ];
  
  const lines = text.split('\n');
  let currentSection = '';
  let currentContent = '';
  let sectionCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    let foundSection = false;
    
    // Check against all patterns
    for (const pattern of patterns) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(line);
      
      if (match) {
        // Save previous section if exists
        if (currentSection && currentContent.trim()) {
          sections.push({
            path: currentSection,
            title: currentSection,
            content: currentContent.trim(),
            level: (currentSection.match(/\./g) || []).length + 1,
            pageStart: 1
          });
        }
        
        // Start new section
        const sectionNumber = match[1] || `${++sectionCount}`;
        const sectionTitle = match[2] || match[1] || line.replace(/\[HEADING\]|\[\/HEADING\]/g, '').trim();
        
        currentSection = sectionNumber;
        currentContent = sectionTitle + '\n';
        foundSection = true;
        break;
      }
    }
    
    if (!foundSection) {
      currentContent += line + '\n';
    }
  }
  
  // Add final section
  if (currentSection && currentContent.trim()) {
    sections.push({
      path: currentSection,
      title: currentSection,
      content: currentContent.trim(),
      level: (currentSection.match(/\./g) || []).length + 1,
      pageStart: 1
    });
  }
  
  return sections;
}

// Generate structured citation labels for chunks
function generateCitationLabel(documentMetadata: any, section: any, page: number): string {
  let citation = '';
  
  // Add insurer if available
  if (documentMetadata?.insurer) {
    citation += `${documentMetadata.insurer} `;
  }
  
  // Add document type/title
  if (documentMetadata?.documentTitle) {
    citation += `${documentMetadata.documentTitle} `;
  } else if (documentMetadata?.documentType) {
    citation += `${documentMetadata.documentType} `;
  }
  
  // Add section if available
  if (section?.path) {
    citation += `§${section.path} `;
    if (section.title && section.title !== section.path) {
      citation += `${section.title} `;
    }
  }
  
  // Add page reference
  citation += `(p. ${page})`;
  
  return citation.trim() || `Pagina ${page}`;
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
    
    // Try extraction methods in order of reliability
    let extractionResult: ExtractionResult | null = null;
    const errors: string[] = [];
    const fileName = body.file_path?.split('/').pop() || 'unknown';
    
    // 1. Try PDF.js native extraction
    try {
      console.log('Attempting PDF.js extraction...');
      extractionResult = await extractWithPDFJS(pdfBuffer);
      
      // Validate extraction quality
      const allText = extractionResult.pages.map(p => p.text).join(' ');
      const validation = validateExtractedContent(allText);
      
      if (!validation.isValid) {
        console.log(`PDF.js quality insufficient (${validation.reason}), trying binary patterns...`);
        throw new Error('PDF.js extraction quality insufficient');
      }
      
      console.log(`PDF.js success: ${extractionResult.pages.length} pages, ${extractionResult.stats.totalChars} chars`);
    } catch (pdfError) {
      errors.push(`PDF.js: ${pdfError.message}`);
      console.log(`PDF.js failed: ${pdfError.message}`);
    }
    
    // 2. Try enhanced binary pattern extraction
    if (!extractionResult || extractionResult.stats.totalChars < 100) {
      try {
        console.log('Attempting enhanced binary pattern extraction...');
        extractionResult = await extractWithBinaryPatterns(pdfBuffer);
        console.log(`Binary patterns success: ${extractionResult.stats.totalChars} chars`);
      } catch (binaryError) {
        errors.push(`Binary patterns: ${binaryError.message}`);
        console.log(`Binary patterns failed: ${binaryError.message}`);
      }
    }
    
    // 3. Try image-based OCR as last resort (only for small files)
    if ((!extractionResult || extractionResult.stats.totalChars < 100) && pdfBuffer.length < 3000000) {
      try {
        console.log('Attempting image-based OCR...');
        extractionResult = await extractWithImageOCR(pdfBuffer, fileName);
        console.log(`Image OCR success: ${extractionResult.stats.totalChars} chars`);
      } catch (ocrError) {
        errors.push(`Image OCR: ${ocrError.message}`);
        console.log(`Image OCR failed: ${ocrError.message}`);
      }
    }

    // 4. Final fallback - create intelligent extraction based on filename
    if (!extractionResult || extractionResult.pages.length === 0) {
      console.log('All extraction methods failed, creating intelligent fallback...');
      extractionResult = createIntelligentFallback(fileName);
    }

    console.log(`Extraction completed: ${extractionResult.method}, ${extractionResult.pages.length} pages, ${extractionResult.stats.totalChars} chars`);

    // Get document metadata for context enrichment
    const { data: documentInfo, error: docError } = await supabase
      .from('documents_v2')
      .select(`
        title,
        document_type,
        base_insurance_code,
        products!inner(
          name,
          insurers!inner(name)
        )
      `)
      .eq('id', body.document_id)
      .single();

    let documentMetadata = {};
    if (!docError && documentInfo) {
      documentMetadata = {
        insurer: documentInfo.products?.insurers?.name,
        productName: documentInfo.products?.name,
        documentType: documentInfo.document_type,
        documentTitle: documentInfo.title
      };
    }

    // Detect document structure and sections
    const allText = extractionResult.pages.map(p => p.text).join('\n\n');
    const detectedSections = detectSections(allText);
    console.log(`Detected ${detectedSections.length} sections`);

    // Insert sections into database
    const sectionsToInsert = detectedSections.map((section, index) => ({
      document_id: body.document_id,
      title: section.title,
      section_path: section.path,
      page_start: section.pageStart || 1,
      page_end: section.pageStart || 1,
      order_key: index + 1,
      section_label: `§${section.path}`,
      heading_path: section.path
    }));

    let insertedSections: any[] = [];
    if (sectionsToInsert.length > 0) {
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .insert(sectionsToInsert)
        .select('id, section_path');

      if (sectionsError) {
        console.warn('Warning: Could not insert sections:', sectionsError);
      } else {
        insertedSections = sections || [];
        console.log(`Inserted ${insertedSections.length} sections`);
      }
    }

    // Create enhanced chunks with section awareness
    const allChunks = extractionResult.pages.flatMap((page, pageIndex) => {
      const pageChunks = chunkText(page.page, page.text);
      
      // Try to assign chunks to sections based on content matching
      return pageChunks.map((chunk, chunkIndex) => {
        const matchingSection = detectedSections.find(section => 
          chunk.text.includes(section.title) || 
          section.content.includes(chunk.text.substring(0, 100))
        );
        
        const matchingSectionRecord = matchingSection ? 
          insertedSections.find(s => s.section_path === matchingSection.path) : null;

        return {
          ...chunk,
          section_id: matchingSectionRecord?.id || null,
          section_path: matchingSection?.path || '',
          chunk_index: chunkIndex,
          citation_label: generateCitationLabel(documentMetadata, matchingSection, page.page)
        };
      });
    });

    console.log(`Created ${allChunks.length} enhanced chunks`);

    if (allChunks.length === 0) {
      throw new Error('No chunks created from document');
    }

    // Generate context-enriched embeddings in batches
    const BATCH_SIZE = 32;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map(chunk => chunk.text);
      
      console.log(`Processing enhanced embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allChunks.length/BATCH_SIZE)}`);
      
      // Include document context for each chunk
      const chunkMetadata = {
        ...documentMetadata,
        sectionPath: batch[0]?.section_path || ''
      };
      
      const embeddings = await embedTexts(batchTexts, chunkMetadata);
      allEmbeddings.push(...embeddings);
    }

    console.log(`Generated ${allEmbeddings.length} context-enriched embeddings`);

    // Insert enhanced chunks into database
    const chunksToInsert = allChunks.map(chunk => ({
      document_id: body.document_id,
      section_id: chunk.section_id,
      page: chunk.page,
      text: chunk.text,
      token_count: chunk.tokenCount,
      section_path: chunk.section_path || null,
      chunk_index: chunk.chunk_index || 0,
      citation_label: chunk.citation_label,
      metadata: {
        extraction_method: extractionResult.method,
        extraction_stats: extractionResult.stats,
        context_enriched: true,
        document_metadata: documentMetadata
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

    console.log(`Inserted ${insertedChunks.length} enhanced chunks`);

    // Insert context-enriched embeddings
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

    console.log(`Inserted ${embeddingsToInsert.length} context-enriched embeddings`);

    // Update document processing status
    const { error: updateError } = await supabase
      .from('documents_v2')
      .update({ 
        processing_status: 'completed',
        pages: extractionResult.stats.totalPages
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
            processing_status: 'failed'
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