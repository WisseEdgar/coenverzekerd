import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Function started, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const requestBody = await req.json();
    console.log('Request body parsed:', requestBody);
    
    const { 
      filePath, 
      categorizeCompany = true, 
      categorizeType = true,
      manualCompanyId = null,
      manualTypeId = null
    } = requestBody;
    
    console.log('Extracted params:', { filePath, categorizeCompany, categorizeType, manualCompanyId, manualTypeId });
    
    if (!filePath) {
      throw new Error('File path is required');
    }

    console.log('Getting environment variables...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    console.log('Environment variables status:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      hasOpenaiApiKey: !!openaiApiKey
    });
    
    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      throw new Error('Missing required environment variables');
    }
    
    console.log('Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching insurance data...');
    const [companiesResult, typesResult] = await Promise.all([
      supabase.from('insurance_companies').select('id, name'),
      supabase.from('insurance_types').select('id, name')
    ]);

    if (companiesResult.error || typesResult.error) {
      console.error('Database errors:', { companiesResult, typesResult });
      throw new Error('Failed to fetch insurance data from database');
    }

    const companies = companiesResult.data || [];
    const types = typesResult.data || [];
    
    console.log('Insurance data fetched:', { companiesCount: companies.length, typesCount: types.length });

    // Build simplified prompt for filename-based categorization
    const filename = filePath.split('/').pop() || '';
    console.log('Processing filename:', filename);
    
    let prompt = `Categorize this insurance document based on its filename: "${filename}"\n\n`;
    
    if (categorizeCompany) {
      prompt += `Available insurance companies:\n`;
      companies.slice(0, 10).forEach(c => prompt += `- ${c.name} (ID: ${c.id})\n`);
      prompt += '\n';
    }

    if (categorizeType) {
      prompt += `Available insurance types:\n`;
      types.slice(0, 10).forEach(t => prompt += `- ${t.name} (ID: ${t.id})\n`);
      prompt += '\n';
    }

    const responseFields = [];
    if (categorizeCompany) responseFields.push('"insurance_company_id": "uuid-here"');
    if (categorizeType) responseFields.push('"insurance_type_id": "uuid-here"');

    prompt += `Respond with only valid JSON in this format:\n{\n  ${responseFields.join(',\n  ')},\n  "confidence": 0.95,\n  "reasoning": "Brief explanation"\n}`;

    console.log('Making OpenAI request...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 200
      }),
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('OpenAI response received');
    
    const content = aiResponse.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('AI response content:', content);

    let categorization;
    try {
      categorization = JSON.parse(content);
      console.log('Parsed categorization:', categorization);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, 'Content:', content);
      throw new Error('Invalid JSON response from AI');
    }

    // Build result
    const result = {
      insurance_company_id: categorizeCompany ? categorization.insurance_company_id : manualCompanyId,
      insurance_type_id: categorizeType ? categorization.insurance_type_id : manualTypeId,
      confidence: categorization.confidence || 1.0,
      reasoning: categorization.reasoning || 'Manual selection used'
    };

    console.log('Final result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in categorize-document function:', error);
    console.error('Error stack:', error.stack);
    
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