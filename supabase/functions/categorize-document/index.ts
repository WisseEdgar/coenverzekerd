import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      filePath, 
      categorizeCompany = true, 
      categorizeType = true,
      manualCompanyId = null,
      manualTypeId = null
    } = await req.json();
    
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      throw new Error('Missing required environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert file to base64 for OpenAI
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 safely for large files
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    // Get insurance companies and types from database
    const [companiesResult, typesResult] = await Promise.all([
      supabase.from('insurance_companies').select('id, name'),
      supabase.from('insurance_types').select('id, name')
    ]);

    if (companiesResult.error || typesResult.error) {
      throw new Error('Failed to fetch insurance data from database');
    }

    const companies = companiesResult.data || [];
    const types = typesResult.data || [];

    // Build prompt based on what needs to be categorized
    let prompt = `Analyze this insurance document and categorize it:\n\n`;
    
    if (categorizeCompany) {
      prompt += `1. Determine the insurance company from these options:\n`;
      prompt += companies.map(c => `- ${c.name} (ID: ${c.id})`).join('\n') + '\n\n';
    } else if (manualCompanyId) {
      const company = companies.find(c => c.id === manualCompanyId);
      prompt += `1. Insurance company is already selected: ${company?.name || 'Unknown'}\n\n`;
    }

    if (categorizeType) {
      prompt += `${categorizeCompany ? '2' : '1'}. Determine the type of insurance from these options:\n`;
      prompt += types.map(t => `- ${t.name} (ID: ${t.id})`).join('\n') + '\n\n';
    } else if (manualTypeId) {
      const type = types.find(t => t.id === manualTypeId);
      prompt += `${categorizeCompany ? '2' : '1'}. Insurance type is already selected: ${type?.name || 'Unknown'}\n\n`;
    }

    const responseFields = [];
    if (categorizeCompany) responseFields.push('"insurance_company_id": "uuid-here"');
    if (categorizeType) responseFields.push('"insurance_type_id": "uuid-here"');

    prompt += `Please respond with only a JSON object in this exact format:\n{\n  ${responseFields.join(',\n  ')},\n  "confidence": 0.95,\n  "reasoning": "Brief explanation of your choices"\n}\n\nIf you cannot determine the categories with high confidence, set the confidence below 0.7.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let categorization;
    try {
      categorization = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid response format from AI');
    }

    // Build result object with manually provided values
    const result = {
      insurance_company_id: categorizeCompany ? categorization.insurance_company_id : manualCompanyId,
      insurance_type_id: categorizeType ? categorization.insurance_type_id : manualTypeId,
      confidence: categorization.confidence || 1.0,
      reasoning: categorization.reasoning || 'Manual selection used'
    };

    // Validate that required fields are present
    if (!result.insurance_company_id || !result.insurance_type_id) {
      throw new Error('Missing required categorization data');
    }

    // Check if confidence is high enough for AI categories
    if ((categorizeCompany || categorizeType) && categorization.confidence < 0.7) {
      throw new Error(`AI confidence too low: ${categorization.confidence}`);
    }

    console.log('Categorization result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in categorize-document function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check function logs for more information'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});