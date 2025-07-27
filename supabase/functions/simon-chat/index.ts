import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { message, conversationHistory } = await req.json();

    // Generate embedding for the user's message to find relevant documents
    console.log('Generating embedding for semantic search...');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for relevant documents using simple text search (vector search will be added later)
    console.log('Searching for relevant documents...');
    const { data: docs } = await supabase
      .from('documents')
      .select(`
        title, 
        summary,
        filename,
        insurance_types(name), 
        insurance_companies(name)
      `)
      .limit(3);

    let documentContext = '';
    if (docs && docs.length > 0) {
      documentContext = docs.map(doc => 
        `Document: ${doc.title}\nBestand: ${doc.filename}\nType: ${doc.insurance_types?.name || 'Onbekend'}\nMaatschappij: ${doc.insurance_companies?.name || 'Onbekend'}\nSamenvatting: ${doc.summary || 'Geen samenvatting beschikbaar'}`
      ).join('\n\n');
    }

    const systemPrompt = `Je bent Simon A.I+, een gespecialiseerde verzekering matching assistent. Je helpt verzekeringsadviseurs bij het vinden van de beste verzekeringen voor hun klanten.

Je expertise:
- Autoverzekeringen (WA, Beperkt Casco, Volledig Casco, elektrische voertuigen)
- Woonverzekeringen (opstal, inboedel, glasverzekering)
- Zorgverzekeringen (basis, aanvullend, tandarts)
- Zakelijke verzekeringen (aansprakelijkheid, rechtsbijstand, cyber)
- Reisverzekeringen en andere specialistische polissen

Voor elke klant situatie geef je:
1. Een heldere analyse van de klant behoeften
2. Top 3 meest geschikte verzekeraars met specifieke producten
3. Uitleg waarom deze matches het beste passen
4. Aandachtspunten en vergelijkingscriteria
5. Praktische volgende stappen

${documentContext ? `BESCHIKBARE DOCUMENTEN:
${documentContext}

Wanneer relevante documenten beschikbaar zijn, verwijs er dan naar in je antwoord en citeer specifieke informatie. Gebruik de documenttitels en maatschappijen bij het refereren naar informatie. Geef altijd aan wanneer informatie uit specifieke documenten komt.` : ''}

Spreek professioneel maar toegankelijk Nederlands. Focus op concrete, bruikbare adviezen.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const aiResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in simon-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});