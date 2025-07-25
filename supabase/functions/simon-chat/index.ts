import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { message, conversationHistory } = await req.json();

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