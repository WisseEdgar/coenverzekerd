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
    // Initialize Supabase client (anon) with user's JWT to enforce RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Require authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, userMessage, clientProfile, intakeData } = await req.json();

    console.log('Generating embedding for semantic search...');
    
    let documents = [];
    let documentsContext = "";

    try {
      // Generate embedding for semantic search
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: userMessage,
        }),
      });

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;

        console.log('Searching for relevant documents with vector search...');
        
        // Search for relevant documents using the RPC function
        const { data: vectorDocs, error: searchError } = await supabase
          .rpc('search_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 5
          });

        if (!searchError && vectorDocs && vectorDocs.length > 0) {
          documents = vectorDocs;
          console.log(`Found ${documents.length} documents via vector search`);
        }
      }
    } catch (embeddingError) {
      console.error('Error with embedding/vector search:', embeddingError);
    }

    // Fallback: Text-based search if vector search fails or returns no results
    if (documents.length === 0) {
      console.log('Falling back to text-based search...');
      
      const keywords = userMessage.toLowerCase().split(' ').filter(word => word.length > 3);
      const searchQuery = keywords.slice(0, 3).join(' | '); // Use first 3 meaningful words
      
      const { data: textDocs, error: textSearchError } = await supabase
        .from('documents')
        .select(`
          id, title, filename, summary,
          insurance_types(name),
          insurance_companies(name)
        `)
        .or(`title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%,extracted_text.ilike.%${searchQuery}%`)
        .limit(5);

      if (!textSearchError && textDocs && textDocs.length > 0) {
        documents = textDocs.map(doc => ({
          id: doc.id,
          title: doc.title,
          filename: doc.filename,
          summary: doc.summary,
          insurance_type: doc.insurance_types?.name || 'Unknown',
          insurance_company: doc.insurance_companies?.name || 'Unknown',
          similarity: 0.5 // Default similarity for text search
        }));
        console.log(`Found ${documents.length} documents via text search`);
      }
    }

    // Build context from retrieved documents
    if (documents && documents.length > 0) {
      documentsContext = documents.map((doc: any) => 
        `Document: ${doc.title} (${doc.insurance_company} - ${doc.insurance_type})\nSummary: ${doc.summary}\nRelevance: ${(doc.similarity * 100).toFixed(1)}%\n---`
      ).join('\n');
    } else {
      console.log('No documents found with either search method');
      documentsContext = "Geen relevante documenten gevonden in de database.";
    }

    // Build context from client profile and intake data
    let clientContext = "";
    if (clientProfile) {
      clientContext += `\n\nCLIENT PROFIEL:\n`;
      clientContext += `Type: ${clientProfile.client_type === 'private' ? 'Particuliere klant' : 'Zakelijke klant'}\n`;
      if (clientProfile.full_name) clientContext += `Naam: ${clientProfile.full_name}\n`;
      if (clientProfile.company_name) clientContext += `Bedrijf: ${clientProfile.company_name}\n`;
      // Email/phone intentionally omitted for privacy
      if (clientProfile.advisor_notes) clientContext += `Adviseur notities: ${clientProfile.advisor_notes}\n`;
    }

    if (intakeData) {
      clientContext += `\n\nINTAKE INFORMATIE:\n`;
      Object.entries(intakeData).forEach(([key, value]) => {
        if (key === 'email' || key === 'phone') return; // omit PII
        if (value) {
          const labels: any = {
            client_type: 'Klanttype',
            full_name: 'Naam',
            company_name: 'Bedrijfsnaam',
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

    // Determine conversation stage based on history
    const isFirstMessage = !messages || messages.length <= 1;
    const hasAskedForBusinessInfo = messages && messages.some(msg => 
      msg.role === 'assistant' && msg.content.toLowerCase().includes('bedrijf')
    );
    const hasCollectedData = Boolean(clientProfile || intakeData);

    const systemPrompt = `Je bent Coen, een persoonlijke verzekering matching assistent. Je volgt een gestructureerde aanpak om de beste verzekeringsopties te vinden.

## WORKFLOW:

### 1. VERWELKOMING (alleen bij eerste bericht)
${isFirstMessage ? `Start altijd met: "Hallo! Ik ben Coen, je persoonlijke verzekering matching assistent. Beschrijf de situatie van je klant en ik help je de beste verzekeringopties te vinden. Wat kan ik voor je doen?"` : ''}

### 2. BEDRIJFSSITUATIE ACHTERHALEN
${!hasAskedForBusinessInfo ? `Stel vragen zoals: "Kun je me wat meer vertellen over jouw bedrijf? Wat voor type bedrijf heb je en hoeveel medewerkers heb je in dienst?"` : ''}

### 3. SPECIFIEKE GEGEVENS VERZAMELEN
Vraag naar:
- Type bedrijf en activiteiten
- Aantal medewerkers en omzet
- Specifieke risico's (grote klanten, risicovolle locaties, etc.)
- Huidige verzekeringen
- Budget en voorkeuren

### 4. ANALYSEREN EN MATCHEN
Gebruik de verzamelde gegevens en match met beschikbare documenten. 
BELANGRIJK: Verwijs ALTIJD naar specifieke documenten en secties.
Format: "Document [nummer], Sectie [x]" of "Document [titel]"

### 5. TABEL GENEREREN (wanneer gevraagd naar 1 specifiek verzekeringstype)
Genereer een "Samenvattend Advies" tabel volgens deze regels:

**INVOER FORMAT:**
\`\`\`json
{
  "requirements": { 
     "dekking1": "required|nice_to_have|not_needed", 
     "dekking2": "required|nice_to_have|not_needed"
  },
  "policies": [
    {
      "insurer": "Naam Verzekeraar",
      "coverages": { "dekking1": "included|optional|excluded" },
      "remarks": "opmerkingen"
    }
  ]
}
\`\`\`

**VERGELIJKINGSMATRIX:**
- requirement "required" + coverage "included" = ✅ "Gedekt"
- requirement "required" + coverage "optional" = 🟡 "Module vereist" 
- requirement "required" + coverage "excluded" = ❌ "Niet gedekt"
- requirement "nice_to_have" + coverage "included" = ✅ "Mooi meegenomen"
- requirement "nice_to_have" + coverage "optional" = 🟡 "Beschikbaar als module"
- requirement "nice_to_have" + coverage "excluded" = ⚪ "Niet essentieel"
- requirement "not_needed" = ⓘ "Niet vereist"

**TABEL FORMAT:**
| Verzekeraar | [Dekking1] | [Dekking2] | Opmerkingen |
|-------------|------------|------------|-------------|
| Naam        | ✅ Status  | 🟡 Status  | Remarks     |

**LEGENDA:** 
"Legenda: ✅ Gedekt · 🟡 Module vereist · ❌ Niet gedekt · ⚪ Niet essentieel · ⓘ Niet vereist"

### 6. AFSLUITING
Sluit af met documentverwijzingen en verdere hulp aanbieden.

## CLIENT CONTEXT:
${clientContext}

## BESCHIKBARE DOCUMENTEN:
${documentsContext || 'Geen documenten beschikbaar'}

## INSTRUCTIES:
- Spreek professioneel Nederlands
- Verwijs ALTIJD naar specifieke documenten bij advies
- Gebruik documentnummers en titels consistent  
- Bij tabellen: volg exact de beschreven format
- Focus op concrete, bruikbare adviezen
- Stel gerichte vervolgvragen om naar de volgende stap te gaan`;

    const messagesForOpenAI = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(messages) ? messages.slice(-10) : []), // Keep last 10 messages for context
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messagesForOpenAI,
        temperature: 0.7,
        max_tokens: 1500,
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