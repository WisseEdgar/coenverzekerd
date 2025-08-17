import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryFilters {
  line_of_business?: string;
  insurer?: string;
  version_date_from?: string;
  version_date_to?: string;
}

interface SearchResult {
  chunk_id: string;
  document_id: string;
  section_id?: string;
  chunk_text: string;
  page: number;
  similarity: number;
  insurer_name: string;
  product_name: string;
  document_title: string;
  version_label?: string;
  metadata: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, filters = {}, k = 12 } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing query: "${query}" with filters:`, filters);

    // Generate query embedding
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.json();
      console.error('OpenAI embedding error:', errorData);
      throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('Generated query embedding, searching database...');

    // Perform semantic search with filters
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_insurance_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: k,
        line_of_business_filter: filters.line_of_business || null,
        insurer_filter: filters.insurer || null
      });

    if (searchError) {
      console.error('Search error:', searchError);
      throw new Error(`Search failed: ${searchError.message}`);
    }

    console.log(`Found ${searchResults?.length || 0} matching chunks`);

    // Additional filtering by date if specified
    let filteredResults = searchResults || [];
    
    if (filters.version_date_from || filters.version_date_to) {
      filteredResults = filteredResults.filter((result: any) => {
        if (!result.version_date) return true; // Include if no version date
        
        const versionDate = new Date(result.version_date);
        
        if (filters.version_date_from) {
          const fromDate = new Date(filters.version_date_from);
          if (versionDate < fromDate) return false;
        }
        
        if (filters.version_date_to) {
          const toDate = new Date(filters.version_date_to);
          if (versionDate > toDate) return false;
        }
        
        return true;
      });
    }

    // Rerank results (simple scoring based on similarity and text length)
    const rerankedResults = filteredResults
      .map((result: any) => ({
        ...result,
        rerank_score: result.similarity * 0.8 + (result.chunk_text.length > 300 ? 0.2 : 0.1)
      }))
      .sort((a: any, b: any) => b.rerank_score - a.rerank_score)
      .slice(0, k);

    // Log the query for analytics
    try {
      await supabase
        .from('queries')
        .insert({
          user_id: user.id,
          query: query,
          filters: filters
        });
    } catch (logError) {
      console.warn('Failed to log query:', logError);
    }

    // Prepare response with grouped results
    const groupedResults = groupResultsByDocument(rerankedResults);

    return new Response(JSON.stringify({
      success: true,
      query: query,
      filters: filters,
      total_chunks: rerankedResults.length,
      total_documents: Object.keys(groupedResults).length,
      results: rerankedResults,
      grouped_by_document: groupedResults,
      processing_time_ms: Date.now() - (req as any).start_time || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in query-index function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.name || 'Search failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function groupResultsByDocument(results: SearchResult[]): Record<string, any> {
  const grouped: Record<string, any> = {};
  
  for (const result of results) {
    const docKey = result.document_id;
    
    if (!grouped[docKey]) {
      grouped[docKey] = {
        document_id: result.document_id,
        document_title: result.document_title,
        insurer_name: result.insurer_name,
        product_name: result.product_name,
        version_label: result.version_label,
        chunks: [],
        max_similarity: 0,
        total_chunks: 0
      };
    }
    
    grouped[docKey].chunks.push({
      chunk_id: result.chunk_id,
      text: result.chunk_text,
      page: result.page,
      similarity: result.similarity,
      metadata: result.metadata
    });
    
    grouped[docKey].max_similarity = Math.max(grouped[docKey].max_similarity, result.similarity);
    grouped[docKey].total_chunks++;
  }
  
  return grouped;
}