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

    const { query, filters = {} }: { query: string; filters: QueryFilters } = await req.json();

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
        model: 'text-embedding-3-small',
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Perform enhanced semantic search with metadata
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_insurance_chunks_enhanced',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 24,
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

    // Apply additional date filtering if specified
    if (filters.version_date_from || filters.version_date_to) {
      const { data: dateFilteredDocs, error: dateError } = await supabase
        .from('documents_v2')
        .select('id')
        .gte('version_date', filters.version_date_from || '1900-01-01')
        .lte('version_date', filters.version_date_to || '2100-12-31');

      if (dateError) {
        console.error('Date filtering error:', dateError);
      } else {
        const validDocIds = new Set(dateFilteredDocs.map(doc => doc.id));
        results = results.filter(result => validDocIds.has(result.document_id));
      }
    }

    // Enhanced reranking based on document metadata
    results = results
      .map(result => ({
        ...result,
        // Boost primary documents
        boosted_similarity: result.is_primary_document 
          ? result.similarity + 0.1 
          : result.similarity,
        // Add document family context
        text_length_score: Math.min(result.chunk_text.length / 1000, 1),
      }))
      .sort((a, b) => {
        // Primary sort by boosted similarity
        if (Math.abs(a.boosted_similarity - b.boosted_similarity) > 0.05) {
          return b.boosted_similarity - a.boosted_similarity;
        }
        // Secondary sort by text quality (length)
        return b.text_length_score - a.text_length_score;
      })
      .slice(0, 12); // Limit final results

    // Log the query for analytics
    await supabase.from('queries').insert({
      user_id: user.id,
      query: query,
      filters: filters,
    });

    // Group results by document for better organization
    const groupedResults = groupResultsByDocument(results);

    console.log(`Enhanced search completed: ${results.length} chunks from ${Object.keys(groupedResults).length} documents`);

    return new Response(JSON.stringify({
      results: results,
      grouped_results: groupedResults,
      total_chunks: results.length,
      total_documents: Object.keys(groupedResults).length,
      query: query,
      filters: filters
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-insurance-enhanced function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      results: [],
      grouped_results: {},
      total_chunks: 0,
      total_documents: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function groupResultsByDocument(results: SearchResult[]): Record<string, any> {
  const grouped: Record<string, any> = {};

  for (const result of results) {
    if (!grouped[result.document_id]) {
      grouped[result.document_id] = {
        document_id: result.document_id,
        document_title: result.document_title,
        insurer_name: result.insurer_name,
        product_name: result.product_name,
        version_label: result.version_label,
        document_code: result.document_code,
        document_type: result.document_type,
        base_insurance_code: result.base_insurance_code,
        is_primary_document: result.is_primary_document,
        max_similarity: result.similarity,
        chunks: []
      };
    }

    // Update max similarity
    if (result.similarity > grouped[result.document_id].max_similarity) {
      grouped[result.document_id].max_similarity = result.similarity;
    }

    // Add chunk
    grouped[result.document_id].chunks.push({
      chunk_id: result.chunk_id,
      chunk_text: result.chunk_text,
      page: result.page,
      similarity: result.similarity,
      metadata: result.metadata
    });
  }

  // Sort documents by max similarity and primary document status
  return Object.fromEntries(
    Object.entries(grouped).sort(([, a], [, b]) => {
      if (a.is_primary_document !== b.is_primary_document) {
        return b.is_primary_document ? 1 : -1;
      }
      return b.max_similarity - a.max_similarity;
    })
  );
}