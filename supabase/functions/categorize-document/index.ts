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
    const { filePath } = await req.json();
    
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

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

    // Create prompt for OpenAI
    const prompt = `
    Analyze this insurance document and categorize it by determining:
    1. The insurance company
    2. The type of insurance

    Available Insurance Companies:
    ${companies.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

    Available Insurance Types:
    ${types.map(t => `- ${t.name} (ID: ${t.id})`).join('\n')}

    Please respond with only a JSON object in this exact format:
    {
      "insurance_company_id": "uuid-here",
      "insurance_type_id": "uuid-here",
      "confidence": 0.95,
      "reasoning": "Brief explanation of why you chose these categories"
    }

    If you cannot determine the categories with high confidence, set the confidence below 0.7.
    `;

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

    // Validate the response
    if (!categorization.insurance_company_id || !categorization.insurance_type_id) {
      throw new Error('AI could not determine categories');
    }

    // Check if confidence is high enough
    if (categorization.confidence < 0.7) {
      throw new Error(`AI confidence too low: ${categorization.confidence}`);
    }

    console.log('AI categorization result:', categorization);

    return new Response(JSON.stringify(categorization), {
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