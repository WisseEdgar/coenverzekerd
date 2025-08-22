import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrphanResult {
  type: 'orphaned_files' | 'orphaned_records'
  table?: string
  count: number
  items: any[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'detect'
    
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

    const results: OrphanResult[] = []

    if (action === 'detect') {
      // Find orphaned chunks (chunks without valid documents)
      const { data: orphanedChunks, error: chunksError } = await supabaseClient
        .from('chunks')
        .select(`
          id,
          document_id,
          text,
          page,
          created_at
        `)
        .not('document_id', 'in', `(
          SELECT id FROM documents_v2 
          UNION 
          SELECT id FROM documents
        )`)

      if (!chunksError && orphanedChunks) {
        results.push({
          type: 'orphaned_records',
          table: 'chunks',
          count: orphanedChunks.length,
          items: orphanedChunks.slice(0, 20)
        })
      }

      // Find orphaned embeddings (embeddings without chunks)
      const { data: orphanedEmbeddings, error: embeddingsError } = await supabaseClient
        .from('chunk_embeddings')
        .select(`
          id,
          chunk_id,
          created_at
        `)
        .not('chunk_id', 'in', `(SELECT id FROM chunks)`)

      if (!embeddingsError && orphanedEmbeddings) {
        results.push({
          type: 'orphaned_records',
          table: 'chunk_embeddings',
          count: orphanedEmbeddings.length,
          items: orphanedEmbeddings.slice(0, 20)
        })
      }

      // Find orphaned sections (sections without documents)
      const { data: orphanedSections, error: sectionsError } = await supabaseClient
        .from('sections')
        .select(`
          id,
          document_id,
          heading_path,
          created_at
        `)
        .not('document_id', 'in', `(
          SELECT id FROM documents_v2 
          UNION 
          SELECT id FROM documents
        )`)

      if (!sectionsError && orphanedSections) {
        results.push({
          type: 'orphaned_records',
          table: 'sections',
          count: orphanedSections.length,
          items: orphanedSections.slice(0, 20)
        })
      }

      // Find orphaned answer citations
      const { data: orphanedCitations, error: citationsError } = await supabaseClient
        .from('answer_citations')
        .select(`
          id,
          answer_id,
          document_id,
          created_at
        `)
        .not('document_id', 'in', `(
          SELECT id FROM documents_v2 
          UNION 
          SELECT id FROM documents
        )`)

      if (!citationsError && orphanedCitations) {
        results.push({
          type: 'orphaned_records',
          table: 'answer_citations',
          count: orphanedCitations.length,
          items: orphanedCitations.slice(0, 20)
        })
      }

      // Log the detection operation
      await supabaseClient
        .rpc('log_admin_action', {
          _action: 'orphan_detection',
          _new_values: { 
            total_orphans: results.reduce((sum, r) => sum + r.count, 0),
            types_found: results.length
          }
        })

    } else if (action === 'cleanup') {
      const body = await req.json()
      const { table_name, orphan_ids } = body

      if (!table_name || !orphan_ids || !Array.isArray(orphan_ids)) {
        throw new Error('Table name and orphan IDs array required for cleanup')
      }

      // Delete orphaned records
      const { error: deleteError } = await supabaseClient
        .from(table_name)
        .delete()
        .in('id', orphan_ids)

      if (deleteError) {
        throw new Error(`Failed to cleanup orphans from ${table_name}: ${deleteError.message}`)
      }

      // Log the cleanup operation
      await supabaseClient
        .rpc('log_admin_action', {
          _action: 'orphan_cleanup',
          _table_name: table_name,
          _old_values: { 
            orphan_ids: orphan_ids,
            count: orphan_ids.length
          }
        })

      return new Response(
        JSON.stringify({
          action: 'cleanup',
          table_name,
          deleted_count: orphan_ids.length
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        action: 'detect',
        timestamp: new Date().toISOString(),
        total_orphans: results.reduce((sum, r) => sum + r.count, 0),
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
    console.error('Orphan detection error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to perform orphan detection' 
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