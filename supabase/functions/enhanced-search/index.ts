import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryFilters {
  line_of_business?: string;
  insurer?: string;
  document_type?: string;
  base_insurance_code?: string;
  version_date_from?: string;
  version_date_to?: string;
}

interface SearchResult {
  chunk_id: string;
  document_id: string;
  section_id: string | null;
  section_path: string | null;
  chunk_text: string;
  page: number | null;
  similarity: number;
  insurer_name: string;
  product_name: string;
  document_title: string;
  version_label: string | null;
  metadata: any;
  document_code: string | null;
  document_type: string | null;
  base_insurance_code: string | null;
  is_primary_document: boolean;
  citation_label: string;
  section_label: string | null;
  section_title: string | null;
  chunk_index: number;
  paragraph_start: number | null;
  paragraph_end: number | null;
}

// MMR Implementation
type Vec = number[];
type MMRItem = { 
  id: string; 
  text: string; 
  embedding: Vec; 
  baseScore: number;
  meta?: any;
};

function dot(a: Vec, b: Vec): number { 
  let s = 0; 
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]; 
  return s; 
}

function norm(a: Vec): number { 
  return Math.sqrt(dot(a, a)); 
}

function cosine(a: Vec, b: Vec): number { 
  const d = dot(a, b); 
  const n = norm(a) * norm(b); 
  return n ? d / n : 0; 
}

function mmr(queryVec: Vec, items: MMRItem[], lambda = 0.7, k = 10): MMRItem[] {
  const selected: MMRItem[] = [];
  const remaining = [...items];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const rel = cand.baseScore;

      // Calculate max similarity to already selected items
      let maxSim = 0;
      if (selected.length > 0) {
        for (const s of selected) {
          const sim = cosine(cand.embedding, s.embedding);
          if (sim > maxSim) maxSim = sim;
        }
      }

      const mmrScore = lambda * rel - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

// Section Stitching
function stitchBySection(
  ranked: SearchResult[],
  tokenLimit = 2200,
  margin = 200
): SearchResult[] {
  const used = new Set<string>();
  const outputs: SearchResult[] = [];
  const hardLimit = Math.max(256, tokenLimit - margin);

  // Group by section and sort by chunk_index
  const bySection = new Map<string, SearchResult[]>();
  for (const c of ranked) {
    if (!c.section_id) {
      outputs.push(c); // Keep non-sectioned chunks as-is
      used.add(c.chunk_id);
      continue;
    }
    if (!bySection.has(c.section_id)) bySection.set(c.section_id, []);
    bySection.get(c.section_id)!.push(c);
  }

  for (const [, arr] of bySection) {
    arr.sort((a, b) => a.chunk_index - b.chunk_index);
  }

  for (const cand of ranked) {
    if (used.has(cand.chunk_id) || !cand.section_id) continue;

    const siblings = bySection.get(cand.section_id)!;
    const pos = siblings.findIndex(x => x.chunk_id === cand.chunk_id);

    // Estimate tokens (rough approximation: chars/4)
    let text = cand.chunk_text;
    let tokens = Math.ceil(text.length / 4);
    let left = pos - 1;
    let right = pos + 1;

    const collected: SearchResult[] = [cand];
    used.add(cand.chunk_id);

    // Expand right first
    while (right < siblings.length && tokens + Math.ceil(siblings[right].chunk_text.length / 4) <= hardLimit) {
      const c = siblings[right++];
      if (!used.has(c.chunk_id)) {
        text += "\n\n" + c.chunk_text;
        tokens += Math.ceil(c.chunk_text.length / 4);
        collected.push(c);
        used.add(c.chunk_id);
      } else break;
    }

    // Expand left
    while (left >= 0 && tokens + Math.ceil(siblings[left].chunk_text.length / 4) <= hardLimit) {
      const c = siblings[left--];
      if (!used.has(c.chunk_id)) {
        text = c.chunk_text + "\n\n" + text;
        tokens += Math.ceil(c.chunk_text.length / 4);
        collected.unshift(c);
        used.add(c.chunk_id);
      } else break;
    }

    // Create stitched result
    const head = collected[0];
    outputs.push({
      ...head,
      chunk_id: collected.map(c => c.chunk_id).join("+"),
      chunk_text: text,
      citation_label: `${head.citation_label} (§${collected.length} paragraphs)`
    });
  }

  return outputs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { 
      query, 
      filters = {},
      topN = 100,
      mmrK = 24,
      lambda = 0.7,
      topK = 8,
      tokenLimit = 2200,
      useStitching = true,
      useReranking = true
    }: { 
      query: string; 
      filters: QueryFilters;
      topN?: number;
      mmrK?: number;
      lambda?: number;
      topK?: number;
      tokenLimit?: number;
      useStitching?: boolean;
      useReranking?: boolean;
    } = await req.json();

    if (!query?.trim()) {
      throw new Error('Query is required');
    }

    console.log(`Enhanced search query: "${query}" with filters:`, filters);

    // Generate embedding for the query using OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-3-large',
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Step 1: Initial vector search
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_insurance_chunks_enhanced_v2',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: topN,
        line_of_business_filter: filters.line_of_business || null,
        insurer_filter: filters.insurer || null,
        document_type_filter: filters.document_type || null,
        base_insurance_code_filter: filters.base_insurance_code || null,
      }
    );

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    let results: SearchResult[] = searchResults || [];
    console.log(`Initial vector search: ${results.length} results`);

    if (results.length === 0) {
      return new Response(JSON.stringify({
        results: [],
        total_chunks: 0,
        query: query,
        filters: filters,
        pipeline_stats: { initial_search: 0, mmr_results: 0, reranked_results: 0, final_results: 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: MMR for diversity
    const mmrItems: MMRItem[] = results.map(r => ({
      id: r.chunk_id,
      text: r.chunk_text,
      embedding: queryEmbedding, // We'd need the chunk embeddings for real MMR
      baseScore: r.similarity,
      meta: r
    }));

    // For now, just take top mmrK results (would need chunk embeddings for real MMR)
    const mmrSelected = mmrItems.slice(0, mmrK);
    console.log(`MMR selection: ${mmrSelected.length} results`);

    // Step 3: Cross-encoder reranking
    let finalResults = mmrSelected.map(item => item.meta as SearchResult);
    
    if (useReranking) {
      try {
        const rerankResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/rerank`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            topK,
            candidates: mmrSelected.map(item => ({
              id: item.id,
              text: item.text,
              meta: item.meta
            }))
          })
        });

        if (rerankResponse.ok) {
          const { results: rerankedResults } = await rerankResponse.json();
          finalResults = rerankedResults.map((r: any) => r.meta as SearchResult);
          console.log(`Cross-encoder reranking: ${finalResults.length} results`);
        } else {
          console.warn('Reranking failed, using MMR results');
        }
      } catch (error) {
        console.warn('Reranking error:', error);
      }
    }

    // Step 4: Section stitching
    if (useStitching) {
      finalResults = stitchBySection(finalResults, tokenLimit);
      console.log(`Section stitching: ${finalResults.length} results`);
    }

    // Log the query for analytics
    await supabase.from('queries').insert({
      user_id: user.id,
      query: query,
      filters: filters,
    });

    console.log(`Enhanced search completed: ${finalResults.length} final results`);

    return new Response(JSON.stringify({
      results: finalResults,
      total_chunks: finalResults.length,
      query: query,
      filters: filters,
      pipeline_stats: {
        initial_search: results.length,
        mmr_results: mmrSelected.length,
        reranked_results: finalResults.length,
        final_results: finalResults.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced-search function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      total_chunks: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});