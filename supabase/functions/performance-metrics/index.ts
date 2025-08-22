import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PerformanceMetric {
  metric_type: string
  table_name?: string
  value: number
  unit: string
  timestamp: string
  details?: any
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

    const metrics: PerformanceMetric[] = []
    const timestamp = new Date().toISOString()

    // Get recent admin audit log entries for activity monitoring
    const { data: recentActivity, error: activityError } = await supabaseClient
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!activityError && recentActivity) {
      const activityLast24h = recentActivity.filter(
        log => new Date(log.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      )

      metrics.push({
        metric_type: 'admin_activity',
        value: activityLast24h.length,
        unit: 'operations',
        timestamp,
        details: {
          total_operations: recentActivity.length,
          last_24h: activityLast24h.length,
          recent_actions: activityLast24h.slice(0, 10).map(log => ({
            action: log.action,
            table: log.table_name,
            timestamp: log.created_at
          }))
        }
      })
    }

    // Measure query performance for key tables
    const tablesToTest = ['documents_v2', 'chunks', 'chunk_embeddings', 'products', 'insurers']
    
    for (const table of tablesToTest) {
      const startTime = performance.now()
      
      try {
        const { count, error } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true })

        const endTime = performance.now()
        const queryTime = endTime - startTime

        if (!error) {
          metrics.push({
            metric_type: 'query_performance',
            table_name: table,
            value: queryTime,
            unit: 'milliseconds',
            timestamp,
            details: {
              row_count: count,
              operation: 'count_query'
            }
          })
        }
      } catch (error) {
        console.warn(`Failed to test performance for table ${table}:`, error)
      }
    }

    // Test embedding search performance
    try {
      const startTime = performance.now()
      
      // Get a sample embedding to test with
      const { data: sampleEmbedding } = await supabaseClient
        .from('chunk_embeddings')
        .select('embedding')
        .limit(1)
        .single()

      if (sampleEmbedding?.embedding) {
        const { data: searchResults, error: searchError } = await supabaseClient
          .rpc('search_insurance_chunks_enhanced', {
            query_embedding: sampleEmbedding.embedding,
            match_threshold: 0.7,
            match_count: 10
          })

        const endTime = performance.now()
        const searchTime = endTime - startTime

        if (!searchError) {
          metrics.push({
            metric_type: 'embedding_search_performance',
            value: searchTime,
            unit: 'milliseconds',
            timestamp,
            details: {
              results_count: searchResults?.length || 0,
              operation: 'embedding_similarity_search'
            }
          })
        }
      }
    } catch (error) {
      console.warn('Failed to test embedding search performance:', error)
    }

    // Calculate storage estimates
    const storageMetrics = []
    for (const table of tablesToTest) {
      try {
        const { count } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (count !== null) {
          storageMetrics.push({
            table_name: table,
            row_count: count,
            estimated_size_mb: count * 0.001 // Rough estimate
          })
        }
      } catch (error) {
        console.warn(`Failed to get count for table ${table}:`, error)
      }
    }

    metrics.push({
      metric_type: 'storage_usage',
      value: storageMetrics.reduce((sum, m) => sum + m.estimated_size_mb, 0),
      unit: 'megabytes',
      timestamp,
      details: {
        tables: storageMetrics,
        total_rows: storageMetrics.reduce((sum, m) => sum + m.row_count, 0)
      }
    })

    // Log the performance check
    await supabaseClient
      .rpc('log_admin_action', {
        _action: 'performance_metrics_check',
        _new_values: { 
          metrics_collected: metrics.length,
          timestamp: timestamp
        }
      })

    return new Response(
      JSON.stringify({
        timestamp,
        metrics_count: metrics.length,
        metrics: metrics,
        summary: {
          avg_query_time: metrics
            .filter(m => m.metric_type === 'query_performance')
            .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0),
          total_storage_mb: metrics
            .find(m => m.metric_type === 'storage_usage')?.value || 0,
          recent_activity: metrics
            .find(m => m.metric_type === 'admin_activity')?.value || 0
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Performance metrics error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to collect performance metrics' 
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