import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IntegrityCheckResult {
  table: string
  issue_type: string
  count: number
  details: any[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !userData.user) {
      throw new Error('Invalid authentication token')
    }

    // Check if user is admin
    const { data: adminCheck, error: adminError } = await supabaseClient
      .rpc('is_admin', { _user_id: userData.user.id })

    if (adminError || !adminCheck) {
      throw new Error('Admin access required')
    }

    const results: IntegrityCheckResult[] = []

    // Check 1: Orphaned chunks (chunks without documents)
    const { data: orphanedChunks, error: chunksError } = await supabaseClient
      .from('chunks')
      .select(`
        id,
        document_id,
        documents_v2!inner(id)
      `)
      .is('documents_v2.id', null)

    if (!chunksError && orphanedChunks) {
      results.push({
        table: 'chunks',
        issue_type: 'orphaned_chunks',
        count: orphanedChunks.length,
        details: orphanedChunks.slice(0, 10) // Limit details to first 10
      })
    }

    // Check 2: Orphaned chunk embeddings
    const { data: orphanedEmbeddings, error: embeddingsError } = await supabaseClient
      .from('chunk_embeddings')
      .select(`
        id,
        chunk_id,
        chunks!inner(id)
      `)
      .is('chunks.id', null)

    if (!embeddingsError && orphanedEmbeddings) {
      results.push({
        table: 'chunk_embeddings',
        issue_type: 'orphaned_embeddings',
        count: orphanedEmbeddings.length,
        details: orphanedEmbeddings.slice(0, 10)
      })
    }

    // Check 3: Documents without products
    const { data: docsWithoutProducts, error: docsError } = await supabaseClient
      .from('documents_v2')
      .select(`
        id,
        title,
        product_id,
        products!inner(id)
      `)
      .is('products.id', null)

    if (!docsError && docsWithoutProducts) {
      results.push({
        table: 'documents_v2',
        issue_type: 'missing_products',
        count: docsWithoutProducts.length,
        details: docsWithoutProducts.slice(0, 10)
      })
    }

    // Check 4: Products without insurers
    const { data: productsWithoutInsurers, error: productsError } = await supabaseClient
      .from('products')
      .select(`
        id,
        name,
        insurer_id,
        insurers!inner(id)
      `)
      .is('insurers.id', null)

    if (!productsError && productsWithoutInsurers) {
      results.push({
        table: 'products',
        issue_type: 'missing_insurers',
        count: productsWithoutInsurers.length,
        details: productsWithoutInsurers.slice(0, 10)
      })
    }

    // Check 5: Chunks without embeddings
    const { data: chunksWithoutEmbeddings, error: chunksNoEmbError } = await supabaseClient
      .from('chunks')
      .select(`
        id,
        text,
        chunk_embeddings!inner(chunk_id)
      `)
      .is('chunk_embeddings.chunk_id', null)

    if (!chunksNoEmbError && chunksWithoutEmbeddings) {
      results.push({
        table: 'chunks',
        issue_type: 'missing_embeddings',
        count: chunksWithoutEmbeddings.length,
        details: chunksWithoutEmbeddings.slice(0, 10)
      })
    }

    // Log the integrity check
    await supabaseClient
      .rpc('log_admin_action', {
        _action: 'data_integrity_check',
        _new_values: { 
          issues_found: results.length,
          total_issues: results.reduce((sum, r) => sum + r.count, 0)
        }
      })

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        total_issues: results.reduce((sum, r) => sum + r.count, 0),
        checks_performed: results.length,
        results: results
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Data integrity check error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to perform integrity check' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})