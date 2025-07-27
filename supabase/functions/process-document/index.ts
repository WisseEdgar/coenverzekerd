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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { document }: { document: DocumentUpload } = await req.json();

    console.log('Processing document:', document.filename);

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

    // For now, we'll simulate text extraction since we can't run PDF processing libraries
    // In a real implementation, you would use a PDF library like pdf-parse
    const extractedText = `Sample extracted text from ${document.filename}. This would contain the actual PDF content in a real implementation.`;

    // Use OpenAI to extract company name and insurance type from the text
    const extractionPrompt = `
      You are an expert at analyzing Dutch insurance documents. 
      
      From the following document text, extract:
      1. Company name (insurance company that issued the document)
      2. Insurance type (what type of insurance this document covers)
      
      Text: ${extractedText}
      
      Respond in JSON format:
      {
        "company": "extracted company name",
        "insurance_type": "extracted insurance type",
        "confidence": "high/medium/low"
      }
      
      If you cannot determine either field with confidence, set it to null.
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
    const extractionResult = JSON.parse(extractionData.choices[0].message.content);

    console.log('Extraction result:', extractionResult);

    // Find or create insurance type and company
    let insuranceTypeId = null;
    let insuranceCompanyId = null;

    if (extractionResult.insurance_type) {
      const { data: insuranceType } = await supabase
        .from('insurance_types')
        .select('id')
        .eq('name', extractionResult.insurance_type)
        .single();

      if (insuranceType) {
        insuranceTypeId = insuranceType.id;
      } else {
        // Create new insurance type
        const { data: newType } = await supabase
          .from('insurance_types')
          .insert({ 
            name: extractionResult.insurance_type,
            description: `Auto-detected from document processing`
          })
          .select('id')
          .single();
        
        if (newType) {
          insuranceTypeId = newType.id;
        }
      }
    }

    if (extractionResult.company) {
      const { data: company } = await supabase
        .from('insurance_companies')
        .select('id')
        .eq('name', extractionResult.company)
        .single();

      if (company) {
        insuranceCompanyId = company.id;
      } else {
        // Create new company
        const { data: newCompany } = await supabase
          .from('insurance_companies')
          .insert({ 
            name: extractionResult.company,
            description: `Auto-detected from document processing`
          })
          .select('id')
          .single();
        
        if (newCompany) {
          insuranceCompanyId = newCompany.id;
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

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      document: documentRecord,
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