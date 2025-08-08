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

    const { message, conversationHistory, clientProfile, intakeData } = await req.json();

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

    console.log('Searching for relevant documents via vector similarity...');
    let documentContext = '';
    let matchedDocs: any[] = [];
    try {
      const { data: matches, error: matchError } = await supabase.rpc('search_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.65,
        match_count: 5,
      });
      if (matchError) throw matchError;
      matchedDocs = matches || [];
    } catch (e) {
      console.warn('Vector search failed, falling back to latest documents:', (e as any)?.message || e);
      const { data: fallbackDocs } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          summary,
          filename,
          insurance_types(name),
          insurance_companies(name)
        `)
        .order('updated_at', { ascending: false })
        .limit(3);
      matchedDocs = fallbackDocs || [];
    }

    if (matchedDocs.length > 0) {
      documentContext = matchedDocs.map((doc: any) => {
        const insuranceType = doc.insurance_type || doc.insurance_types?.name || 'Onbekend';
        const insuranceCompany = doc.insurance_company || doc.insurance_companies?.name || 'Onbekend';
        const sim = typeof doc.similarity === 'number' ? ` (similariteit: ${doc.similarity.toFixed(2)})` : '';
        return [
          `Document: ${doc.title}${sim}`,
          `Bestand: ${doc.filename}`,
          `Type: ${insuranceType}`,
          `Maatschappij: ${insuranceCompany}`,
          `Samenvatting: ${doc.summary || 'Geen samenvatting beschikbaar'}`,
        ].join('\n');
      }).join('\n\n');
    }

    // Build context from client profile and intake data
    let clientContext = "";
    if (clientProfile) {
      clientContext += `\n\nCLIENT PROFIEL:\n`;
      clientContext += `Type: ${clientProfile.client_type === 'private' ? 'Particuliere klant' : 'Zakelijke klant'}\n`;
      if (clientProfile.full_name) clientContext += `Naam: ${clientProfile.full_name}\n`;
      if (clientProfile.company_name) clientContext += `Bedrijf: ${clientProfile.company_name}\n`;
      if (clientProfile.email) clientContext += `Email: ${clientProfile.email}\n`;
      if (clientProfile.phone) clientContext += `Telefoon: ${clientProfile.phone}\n`;
      if (clientProfile.advisor_notes) clientContext += `Adviseur notities: ${clientProfile.advisor_notes}\n`;
    }

    if (intakeData) {
      clientContext += `\n\nINTAKE INFORMATIE:\n`;
      Object.entries(intakeData).forEach(([key, value]) => {
        if (value) {
          const labels: any = {
            client_type: 'Klanttype',
            full_name: 'Naam',
            company_name: 'Bedrijfsnaam',
            email: 'Email',
            phone: 'Telefoon',
            situation_description: 'Situatie',
            insurance_needs: 'Verzekering behoeften',
            current_coverage: 'Huidige verzekeringen',
            budget: 'Budget',
            timeline: 'Tijdslijn'
          };
          clientContext += `${labels[key] || key}: ${value}\n`;
        }
      });
    }

    const systemPrompt = `Je bent Coen A.I+, een gespecialiseerde verzekerings-matching assistent voor adviseurs. Je taak: match klant-eisen en -risico's met polisvoorwaarden in het systeem en bouw een concrete gespreksstrategie voor de adviseur.

Doelen:
- Vind de best passende producten op basis van polisvoorwaarden, uitsluitingen, limieten en bijzonderheden.
- Leg keuzes transparant uit met exacte verwijzingen naar documenten en secties.
- Lever een direct uitvoerbaar advies met vervolgstap.

Beschikbare context:
${clientContext}

Beschikbare documenten (top matches, met overeenkomstscore):
${documentContext || 'Geen relevante documenten gevonden.'}

Strikte werkwijze:
1) Begrijp de klantcontext en doelen (type klant, situatie, budget, tijdslijn, bestaande dekking).
2) Haal relevante voorwaarden uit documenten; vergelijk specifiek dekkingen, limieten, eigen risico, wachttijden, clausules en uitsluitingen.
3) Citeer exact de bepalingen: noem documenttitel, sectie/Artikel/Paragraaf en indien mogelijk pagina; voeg een korte letterlijke quote toe tussen aanhalingstekens.
4) Scoreer elke optie op "fit" (0–100) en motiveer met concrete voorwaarden/uitsluitingen.
5) Formuleer een gespreksstrategie: verhelderende vragen, te benadrukken voordelen, te managen risico's, en documenten die je paraat houdt.
6) Als informatie ontbreekt of tegenstrijdig is: benoem dit expliciet en vraag gerichte verduidelijking of vraag om upload van specifieke polisvoorwaarden.

Outputformaat (houd je hier strikt aan):
- H1: Advies voor verzekeringsmatch
- Sectie "Kernanalyse": 3–6 bullets met belangrijkste behoeften/risico's.
- Sectie "Citaties uit documenten": voor elk relevant document 1–3 bullets in de vorm:
  • [Document: Titel — Maatschappij — Sectie/Artikel — Pagina (indien bekend)]
    "Exacte quote..."
- Sectie "Top 3 opties — vergelijking":
  | # | Maatschappij / Product | Dekking (kern) | Belangrijkste voorwaarden/limieten | Pluspunten | Minpunten | Indicatieve premie (indien bekend) | Beste voor | Bron (Titel — Sectie) |
  Voeg onder de tabel per optie 1–2 regels motivatie toe.
- Sectie "Adviesstrategie voor het gesprek": concrete stappen, volgorde en formuleringen (bulletlist).
- Sectie "Volgende stap": stel 1 concrete vraag aan de klant en doe een voorstel (bijv. "Zullen we product X aanvragen?" of "Zal ik offerte Y opvragen en de polisvergelijking mailen?").

Stijl en regels:
- Schrijf in professioneel, toegankelijk Nederlands. Kort, feitelijk en bruikbaar.
- Verwijs alleen naar documenten die in context staan. Als sectie/pagina onbekend is, noteer: "sectie onbekend".
- Gebruik geen algemene claims zonder bron; citeer voorwaarden waar relevant.
- Als er onvoldoende documenten zijn, geef tijdelijk best-effort advies met duidelijke beperkingen en vraag om ontbrekende documenten/secties.

Gebruik de beschikbare clientinformatie om het advies te personaliseren.`;

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
        temperature: 0.3,
        max_tokens: 1200,
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
    console.error('Error in coen-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});