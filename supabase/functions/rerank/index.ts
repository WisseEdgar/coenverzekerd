import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Candidate = { 
  id: string; 
  text: string; 
  meta?: Record<string, unknown>;
  score?: number;
};

type RerankRequest = {
  query: string;
  candidates: Candidate[];
  topK?: number;
  truncate?: number;
};

// Using Hugging Face Inference API for bge-reranker-v2-m3
const HF_ENDPOINT = "https://api-inference.huggingface.co/models/BAAI/bge-reranker-v2-m3";

async function rerank(query: string, texts: string[]): Promise<number[]> {
  const HF_TOKEN = Deno.env.get("HF_TOKEN");
  if (!HF_TOKEN) {
    console.log("No HF_TOKEN found, using fallback scoring");
    // Fallback: return original order with declining scores
    return texts.map((_, i) => 1 - (i * 0.01));
  }

  try {
    const batchSize = 32; // Reduced batch size for stability
    const scores: number[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const payload = {
        inputs: {
          query,
          texts: batch,
        },
      };

      const resp = await fetch(HF_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`Rerank API error ${resp.status}: ${errorText}`);
        // Fallback: use declining scores for this batch
        scores.push(...batch.map((_, idx) => 1 - ((i + idx) * 0.01)));
        continue;
      }

      const data = await resp.json();
      
      // Handle different response formats
      let batchScores: number[] = [];
      if (Array.isArray(data) && typeof data[0] === "number") {
        batchScores = data as number[];
      } else if (Array.isArray(data) && typeof (data as any[])[0]?.score === "number") {
        batchScores = (data as any[]).map((x) => x.score);
      } else if (typeof (data as any)?.scores !== "undefined") {
        batchScores = (data as any).scores as number[];
      } else {
        console.warn("Unexpected reranker response format:", data);
        batchScores = batch.map(() => 0.5);
      }

      scores.push(...batchScores);
    }
    
    return scores;
  } catch (error) {
    console.error("Rerank error:", error);
    // Fallback: return declining scores
    return texts.map((_, i) => 1 - (i * 0.01));
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    
    const { query, candidates, topK = 10, truncate = 2000 } = await req.json() as RerankRequest;

    if (!query || !Array.isArray(candidates) || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Reranking ${candidates.length} candidates for query: "${query.slice(0, 100)}..."`);

    // Truncate text for reranking
    const texts = candidates.map(c => 
      c.text.length > truncate ? c.text.slice(0, truncate) : c.text
    );
    
    const scores = await rerank(query, texts);

    const ranked = candidates
      .map((c, i) => ({ ...c, score: scores[i] ?? 0 }))
      .sort((a, b) => (b.score! - a.score!))
      .slice(0, topK);

    console.log(`Reranking completed: top score ${ranked[0]?.score?.toFixed(3)}, bottom score ${ranked[ranked.length - 1]?.score?.toFixed(3)}`);

    return new Response(JSON.stringify({ results: ranked }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("Rerank function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});