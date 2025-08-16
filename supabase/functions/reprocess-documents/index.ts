import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
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

    // Require authenticated user and admin access
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdminResult } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdminResult) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting reprocessing of existing documents...');

    // Get all documents that need reprocessing (missing company or type info)
    const { data: documentsToProcess, error: docsError } = await supabase
      .from('documents')
      .select('id, filename, file_path, extracted_text, insurance_type_id, insurance_company_id')
      .or('insurance_company_id.is.null,insurance_type_id.is.null');

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch documents' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${documentsToProcess?.length || 0} documents to reprocess`);

    let processedCount = 0;
    let updatedCount = 0;
    const results = [];

    for (const doc of documentsToProcess || []) {
      try {
        console.log(`Processing document: ${doc.filename}`);
        
        // Use existing extracted text or extract from filename if no text available
        let textToAnalyze = doc.extracted_text;
        if (!textToAnalyze || textToAnalyze.includes('Sample extracted text')) {
          // Try to download and extract text from the file
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(doc.file_path);

          if (!downloadError && fileData) {
            try {
              const pdfParse = await import('https://esm.sh/pdf-parse@1.1.1');
              const arrayBuffer = await fileData.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              const pdfData = await pdfParse.default(uint8Array);
              textToAnalyze = pdfData.text || `Document filename: ${doc.filename}`;
            } catch (pdfError) {
              console.error('PDF parsing failed for', doc.filename, pdfError);
              textToAnalyze = `Document filename: ${doc.filename}. PDF text extraction failed.`;
            }
          } else {
            textToAnalyze = `Document filename: ${doc.filename}. File not accessible.`;
          }
        }

        // Use OpenAI to extract company name and insurance type
        const extractionPrompt = `
          You are an expert at analyzing Dutch insurance documents. 
          
          From the following document information, extract:
          1. Company name (insurance company that issued the document)
          2. Insurance type (what type of insurance this document covers)
          
          Document info: ${textToAnalyze}
          
          Common Dutch insurance types include:
          - Autoverzekering (car insurance)
          - AOV (Arbeidsongeschiktheidsverzekering) 
          - Bedrijfsaansprakelijkheidsverzekering (business liability)
          - Glasverzekering (glass insurance)
          - Verzuimverzekering (absence insurance)
          - Werkmaterieel verhuurverzekering (equipment rental insurance)
          - Bedrijfswagenverzekering (commercial vehicle insurance)
          
          Common Dutch insurance companies include:
          - Nationale Nederlanden
          - Centraal Beheer
          - ASR
          - Allianz
          - AIG Nederland
          - Klaverblad Verzekeringen
          - TVM Verzekeringen
          - OOM Verzekeringen
          
          Respond in JSON format:
          {
            "company": "extracted company name or null",
            "insurance_type": "extracted insurance type or null",
            "confidence": "high/medium/low"
          }
        `;

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
        
        // Clean the response content
        let contentText = extractionData.choices[0].message.content.trim();
        if (contentText.startsWith('```json')) {
          contentText = contentText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (contentText.startsWith('```')) {
          contentText = contentText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const extractionResult = JSON.parse(contentText);
        console.log(`Extraction result for ${doc.filename}:`, extractionResult);

        // Find or create insurance type and company
        let insuranceTypeId = doc.insurance_type_id;
        let insuranceCompanyId = doc.insurance_company_id;
        let hasUpdates = false;

        // Only update if currently null and we extracted something
        if (!insuranceTypeId && extractionResult.insurance_type) {
          const { data: existingType } = await supabase
            .from('insurance_types')
            .select('id')
            .eq('name', extractionResult.insurance_type)
            .single();

          if (existingType) {
            insuranceTypeId = existingType.id;
          } else {
            // Create new insurance type
            const { data: newType, error: typeError } = await supabase
              .from('insurance_types')
              .insert({
                name: extractionResult.insurance_type,
                description: `Automatisch aangemaakt tijdens herverwerking voor ${extractionResult.insurance_type}`
              })
              .select()
              .single();

            if (!typeError && newType) {
              insuranceTypeId = newType.id;
              console.log(`Created new insurance type: ${extractionResult.insurance_type}`);
            }
          }
          
          if (insuranceTypeId !== doc.insurance_type_id) {
            hasUpdates = true;
          }
        }

        if (!insuranceCompanyId && extractionResult.company) {
          const { data: existingCompany } = await supabase
            .from('insurance_companies')
            .select('id')
            .eq('name', extractionResult.company)
            .single();

          if (existingCompany) {
            insuranceCompanyId = existingCompany.id;
          } else {
            // Create new insurance company
            const { data: newCompany, error: companyError } = await supabase
              .from('insurance_companies')
              .insert({
                name: extractionResult.company,
                description: `Automatisch aangemaakt tijdens herverwerking voor ${extractionResult.company}`
              })
              .select()
              .single();

            if (!companyError && newCompany) {
              insuranceCompanyId = newCompany.id;
              console.log(`Created new insurance company: ${extractionResult.company}`);
            }
          }
          
          if (insuranceCompanyId !== doc.insurance_company_id) {
            hasUpdates = true;
          }
        }

        // Update document if we have new information
        if (hasUpdates) {
          const updateData: any = {};
          if (insuranceTypeId && insuranceTypeId !== doc.insurance_type_id) {
            updateData.insurance_type_id = insuranceTypeId;
          }
          if (insuranceCompanyId && insuranceCompanyId !== doc.insurance_company_id) {
            updateData.insurance_company_id = insuranceCompanyId;
          }
          
          // Also update extracted text if it was improved
          if (textToAnalyze !== doc.extracted_text) {
            updateData.extracted_text = textToAnalyze;
          }

          const { error: updateError } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', doc.id);

          if (!updateError) {
            updatedCount++;
            console.log(`Updated document: ${doc.filename}`);
          } else {
            console.error(`Failed to update document ${doc.filename}:`, updateError);
          }
        }

        results.push({
          filename: doc.filename,
          extracted_company: extractionResult.company,
          extracted_insurance_type: extractionResult.insurance_type,
          confidence: extractionResult.confidence,
          updated: hasUpdates
        });

        processedCount++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing document ${doc.filename}:`, error);
        results.push({
          filename: doc.filename,
          error: error.message,
          updated: false
        });
      }
    }

    console.log(`Reprocessing completed: ${processedCount} processed, ${updatedCount} updated`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total_documents: documentsToProcess?.length || 0,
        processed: processedCount,
        updated: updatedCount
      },
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reprocess-documents function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});