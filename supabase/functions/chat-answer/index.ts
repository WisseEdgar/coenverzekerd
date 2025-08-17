import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface SearchResult {
  id: string;
  document_id: string;
  page: number;
  text: string;
  metadata: any;
  similarity: number;
  document_title: string;
  product_name: string;
  insurer_name: string;
  version_label: string;
}

interface QueryFilters {
  lob?: string; // line of business
  insurer_id?: string;
  insurer_name?: string;
}

async function embedQuery(query: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI embedding error:', error);
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function generateAnswer(query: string, context: string, userContext?: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `Je bent een Nederlandse verzekeringsadviseur. Je helpt bij het vergelijken van verzekeringen.

BELANGRIJKE REGELS:
1. Antwoord ALTIJD in het Nederlands
2. Gebruik ALLEEN informatie uit de gegeven context
3. Citeer ALTIJD je bronnen met [#index] referenties
4. Als informatie ontbreekt of onzeker is: zeg dat expliciet
5. Geef concrete, actionable adviezen
6. Focus op dekkingen, uitsluitingen, eigen risico's en limieten

Wanneer je citeert:
- Gebruik [#1], [#2], etc. voor elke bewering
- Verwijs naar de verzekeraar, product en documentversie
- Vermeld pagina's waar mogelijk

Als de context onvoldoende is voor een volledig antwoord:
- Zeg welke informatie ontbreekt
- Vraag om specifiekere filters of meer documenten`;

  const userMessage = `${userContext ? `Gebruikerscontext: ${userContext}\n\n` : ''}Vraag: ${query}

Context uit verzekeringsdocumenten:
${context}

Geef een gestructureerd antwoord met:
- Korte samenvatting
- Belangrijkste dekkingen/uitsluitingen
- Verschillen tussen opties (indien van toepassing)
- Citaties [#index] bij elke bewering
- Duidelijke aanbeveling of vervolgstappen`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 1500
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI completion error:', error);
    throw new Error(`OpenAI completion failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Geen antwoord gegenereerd.';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { query, filters, userContext } = await req.json();

    console.log('Chat answer request:', { 
      query: query?.substring(0, 100) + '...', 
      filters,
      hasUserContext: !!userContext 
    });

    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    // Step 1: Generate embedding for the query
    console.log('Generating query embedding...');
    const queryEmbedding = await embedQuery(query);

    // Step 2: Search for relevant chunks
    const searchFilters: QueryFilters = filters || {};
    
    // Convert insurer_name to insurer_id if needed
    let insurer_id = searchFilters.insurer_id;
    if (searchFilters.insurer_name && !insurer_id) {
      const { data: insurerData } = await supabase
        .from('insurers')
        .select('id')
        .ilike('name', `%${searchFilters.insurer_name}%`)
        .limit(1)
        .single();
      
      if (insurerData) {
        insurer_id = insurerData.id;
      }
    }

    console.log('Searching chunks with filters:', { 
      lob: searchFilters.lob, 
      insurer_id,
      k: 12 
    });

    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_chunks_cosine', {
        qvec: queryEmbedding,
        k: 12,
        lob: searchFilters.lob || null,
        insurer_id: insurer_id || null
      });

    if (searchError) {
      console.error('Search error:', searchError);
      throw new Error(`Search failed: ${searchError.message}`);
    }

    console.log(`Found ${searchResults?.length || 0} search results from chunks`);

    // Step 2b: If no results from chunks, search the legacy documents table
    let finalResults = searchResults;
    if (!searchResults || searchResults.length === 0) {
      console.log('No results from chunks, searching legacy documents...');
      
      // Build a more sophisticated legacy search with filters
      let legacyQuery = supabase
        .from('documents')
        .select(`
          id, title, filename, summary, similarity,
          insurance_types!inner(name),
          insurance_companies!inner(name)
        `, { count: 'exact' })
        .not('embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8);

      // Apply insurer filter if provided
      if (searchFilters.insurer_name) {
        legacyQuery = legacyQuery.ilike('insurance_companies.name', `%${searchFilters.insurer_name}%`);
      }

      // Apply line of business filter if provided (map to insurance type)
      if (searchFilters.lob) {
        legacyQuery = legacyQuery.ilike('insurance_types.name', `%${searchFilters.lob}%`);
      }

      const { data: legacyDocs, error: legacyError } = await legacyQuery;

      if (legacyError) {
        console.error('Legacy documents query error:', legacyError);
      } else if (legacyDocs && legacyDocs.length > 0) {
        console.log(`Found ${legacyDocs.length} legacy documents, now computing similarity...`);
        
        // Now compute similarity using the search_documents function for these filtered docs
        const { data: legacyResults, error: legacySearchError } = await supabase
          .rpc('search_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 8
          });

        if (!legacySearchError && legacyResults && legacyResults.length > 0) {
          console.log(`Found ${legacyResults.length} results from legacy documents`);
          
          // Transform legacy results to match the expected format
          finalResults = legacyResults.map((doc: any, index: number) => ({
            id: `legacy-${doc.id}`,
            document_id: doc.id,
            page: 1, // Legacy docs don't have page info
            text: doc.summary || `Document: ${doc.title}`,
            metadata: {},
            similarity: doc.similarity,
            document_title: doc.title,
            product_name: doc.insurance_type || 'Algemeen',
            insurer_name: doc.insurance_company || 'Onbekend',
            version_label: doc.filename.split('.')[0]
          }));
        }
      }
    }

    if (!finalResults || finalResults.length === 0) {
      return new Response(JSON.stringify({
        answer: "Ik kon geen relevante informatie vinden in de documentendatabase. Probeer:\n\n• Meer specifieke zoektermen gebruiken\n• Filters aanpassen (verzekeringssoort, verzekeraar)\n• Controleren of de benodigde documenten zijn geüpload\n\nVraag eventueel om hulp bij het uploaden van relevante polisvoorwaarden.",
        passages: [],
        hasResults: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Prepare context for the LLM
    const context = finalResults
      .filter((result: SearchResult) => result.similarity > 0.3) // Filter low-similarity results
      .map((result: SearchResult, index: number) => {
        return `[#${index + 1}] ${result.insurer_name} - ${result.product_name} (${result.document_title}${result.version_label ? ` ${result.version_label}` : ''}) - p.${result.page}
Similarity: ${result.similarity.toFixed(3)}
Content: ${result.text.substring(0, 1000)}${result.text.length > 1000 ? '...' : ''}`;
      })
      .join('\n\n');

    console.log(`Generated context with ${finalResults.length} passages`);

    // Step 4: Check if we have meaningful content
    const hasReadableContent = finalResults.some(result => 
      !result.text.includes('PDF text extraction failed') && 
      result.text.length > 100
    );

    // Step 5: Generate the answer with improved context
    console.log('Generating answer...');
    let answer;
    
    if (!hasReadableContent && finalResults.length > 0) {
      // We found documents but they have extraction failures
      const failedDocs = finalResults.map(r => r.document_title).filter((v, i, a) => a.indexOf(v) === i);
      answer = `Ik heb wel relevante documenten gevonden (${failedDocs.join(', ')}), maar de tekstinhoud is niet leesbaar door problemen met de PDF-extractie. 

**Gevonden documenten met extractieproblemen:**
${failedDocs.map(doc => `• ${doc}`).join('\n')}

**Aanbevelingen:**
1. Deze documenten moeten opnieuw verwerkt worden met verbeterde PDF-extractie
2. Controleer of de originale PDF-bestanden nog beschikbaar zijn
3. Overweeg handmatige tekst-extractie voor belangrijke documenten

Zodra de documenten succesvol zijn herverwerkt, kan ik je gedetailleerde informatie geven over de beschikbare opties en dekkingen.`;
    } else {
      answer = await generateAnswer(query, context, userContext);
    }

    // Step 6: Log the query for analytics
    try {
      await supabase.from('queries').insert({
        user_id: null, // Could get from auth if needed
        query,
        filters: searchFilters
      });
    } catch (logError) {
      console.warn('Failed to log query:', logError);
    }

    // Format passages for frontend
    const passages = finalResults.map((result: SearchResult) => ({
      id: result.id,
      document_id: result.document_id,
      page: result.page,
      text: result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''),
      similarity: result.similarity,
      document_title: result.document_title,
      product_name: result.product_name,
      insurer_name: result.insurer_name,
      version_label: result.version_label,
      has_extraction_failure: result.text.includes('PDF text extraction failed')
    }));

    return new Response(JSON.stringify({
      answer,
      passages,
      hasResults: finalResults.length > 0,
      hasReadableContent,
      queryId: crypto.randomUUID() // Could be used for tracking
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-answer function:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      answer: `Er is een fout opgetreden bij het verwerken van je vraag: ${error.message}. Probeer het opnieuw of neem contact op voor ondersteuning.`,
      passages: [],
      hasResults: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});