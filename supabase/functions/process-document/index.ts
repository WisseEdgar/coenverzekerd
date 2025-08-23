import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentUpload {
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client (anon) with user's JWT to enforce RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    // Require authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { document }: { document: DocumentUpload } = await req.json();

    console.log('Processing document:', document.filename);

    // Enforce user-scoped file path (must be under user's folder)
    if (!document.file_path || !document.file_path.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: 'Invalid file path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create initial processing log
    const { data: logEntry, error: logError } = await supabase
      .from('document_processing_logs')
      .insert({
        document_id: null, // Will be updated once document is created
        status: 'pending',
        message: 'Starting document processing',
        processing_details: { filename: document.filename }
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating processing log:', logError);
    }

    // Download the file from storage to extract text
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download file for processing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract text from PDF using pdf-parse
    let extractedText = '';
    try {
      // Use pdf-parse to extract text from the PDF
      const pdfParse = await import('https://esm.sh/pdf-parse@1.1.1');
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdfData = await pdfParse.default(uint8Array);
      extractedText = pdfData.text || '';
      console.log('Extracted text length:', extractedText.length);
    } catch (pdfError) {
      console.error('Error extracting PDF text:', pdfError);
      // Fallback to filename-based analysis if PDF parsing fails
      extractedText = `Document filename: ${document.filename}. PDF text extraction failed, using filename for analysis.`;
    }

    // Enhanced extraction using OpenAI with better prompting for Dutch insurance documents
    const extractionPrompt = `
      You are an expert at analyzing Dutch insurance documents. 
      
      From the following document text, extract and analyze:
      1. Company name (insurance company that issued the document)
      2. Insurance type (what type of insurance this document covers)
      3. Document structure (identify main sections, articles, or paragraphs)
      4. Key coverage areas mentioned
      
      Text: ${extractedText}
      
      Respond in JSON format:
      {
        "company": "extracted company name",
        "insurance_type": "extracted insurance type", 
        "confidence": "high/medium/low",
        "key_sections": ["list of main sections found"],
        "coverage_areas": ["list of coverage types mentioned"],
        "document_structure": "brief description of document organization"
      }
      
      Focus on Dutch insurance terminology like 'aansprakelijkheid', 'dekking', 'uitkering', etc.
      If you cannot determine any field with confidence, set it to null.
    `;

    console.log('Calling OpenAI for extraction...');
    const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts structured information from insurance documents.' },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.1,
      }),
    });

    const extractionData = await extractionResponse.json();
    
    // Clean the response content to handle markdown code blocks
    let contentText = extractionData.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    if (contentText.startsWith('```json')) {
      contentText = contentText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (contentText.startsWith('```')) {
      contentText = contentText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    console.log('Cleaned content for parsing:', contentText);
    
    const extractionResult = JSON.parse(contentText);

    console.log('Extraction result:', extractionResult);

    // Find or create insurance type and company
    let insuranceTypeId = null;
    let insuranceCompanyId = null;

    if (extractionResult.insurance_type) {
      // First try to find existing insurance type
      const { data: existingType } = await supabase
        .from('insurance_types')
        .select('id')
        .eq('name', extractionResult.insurance_type)
        .single();

      if (existingType) {
        insuranceTypeId = existingType.id;
        console.log('Found existing insurance type:', extractionResult.insurance_type);
      } else {
        // Create new insurance type if it doesn't exist
        console.log('Creating new insurance type:', extractionResult.insurance_type);
        const { data: newType, error: typeError } = await supabase
          .from('insurance_types')
          .insert({
            name: extractionResult.insurance_type,
            description: `Automatisch aangemaakt voor ${extractionResult.insurance_type}`
          })
          .select()
          .single();

        if (typeError) {
          console.error('Error creating insurance type:', typeError);
          insuranceTypeId = null;
        } else {
          insuranceTypeId = newType.id;
          console.log('Created new insurance type with ID:', insuranceTypeId);
        }
      }
    }

    if (extractionResult.company) {
      // First try to find existing insurance company
      const { data: existingCompany } = await supabase
        .from('insurance_companies')
        .select('id')
        .eq('name', extractionResult.company)
        .single();

      if (existingCompany) {
        insuranceCompanyId = existingCompany.id;
        console.log('Found existing insurance company:', extractionResult.company);
      } else {
        // Create new insurance company if it doesn't exist
        console.log('Creating new insurance company:', extractionResult.company);
        const { data: newCompany, error: companyError } = await supabase
          .from('insurance_companies')
          .insert({
            name: extractionResult.company,
            description: `Automatisch aangemaakt voor ${extractionResult.company}`
          })
          .select()
          .single();

        if (companyError) {
          console.error('Error creating insurance company:', companyError);
          insuranceCompanyId = null;
        } else {
          insuranceCompanyId = newCompany.id;
          console.log('Created new insurance company with ID:', insuranceCompanyId);
        }
      }
    }

    // Generate embeddings for semantic search
    console.log('Generating embeddings...');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: extractedText,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Generate summary
    console.log('Generating summary...');
    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert insurance advisor. Summarize the key points of this insurance document in Dutch, focusing on coverage details, conditions, and important information for advisors.' 
          },
          { role: 'user', content: `Please summarize this insurance document:\n\n${extractedText}` }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices[0].message.content;

    // user already retrieved above

    // Create document record
    const { data: documentRecord, error: docError } = await supabase
      .from('documents')
      .insert({
        title: document.filename.replace('.pdf', ''),
        filename: document.filename,
        file_path: document.file_path,
        file_size: document.file_size,
        mime_type: document.mime_type,
        insurance_type_id: insuranceTypeId,
        insurance_company_id: insuranceCompanyId,
        extracted_text: extractedText,
        summary: summary,
        embedding: embedding,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docError) {
      console.error('Error creating document record:', docError);
      return new Response(JSON.stringify({ error: 'Failed to create document record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update processing log
    if (logEntry) {
      await supabase
        .from('document_processing_logs')
        .update({
          document_id: documentRecord.id,
          status: 'completed',
          message: 'Document processed successfully',
          extracted_company: extractionResult.company,
          extracted_insurance_type: extractionResult.insurance_type,
          processing_details: {
            filename: document.filename,
            extraction_confidence: extractionResult.confidence,
            text_length: extractedText.length,
            summary_length: summary.length
          }
        })
        .eq('id', logEntry.id);
    }

    console.log('Document processing completed successfully');

    return new Response(JSON.stringify({
      success: true,
      processing: {
        extracted_company: extractionResult.company,
        extracted_insurance_type: extractionResult.insurance_type,
        confidence: extractionResult.confidence
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-document function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});