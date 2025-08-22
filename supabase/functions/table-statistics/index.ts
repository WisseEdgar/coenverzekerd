import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get all public tables
    const { data: tablesData, error: tablesError } = await supabaseClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (tablesError) {
      console.error('Error fetching tables:', tablesError)
      throw tablesError
    }

    // Get row counts for each table
    const tableStats = []
    
    for (const table of tablesData) {
      try {
        const { count, error: countError } = await supabaseClient
          .from(table.table_name)
          .select('*', { count: 'exact', head: true })

        if (countError) {
          console.warn(`Error counting ${table.table_name}:`, countError)
          tableStats.push({
            table_name: table.table_name,
            row_count: 0,
            error: countError.message
          })
        } else {
          tableStats.push({
            table_name: table.table_name,
            row_count: count || 0
          })
        }
      } catch (error) {
        console.warn(`Failed to count ${table.table_name}:`, error)
        tableStats.push({
          table_name: table.table_name,
          row_count: 0,
          error: 'Failed to count rows'
        })
      }
    }

    // Calculate total rows
    const totalRows = tableStats.reduce((sum, table) => sum + (table.row_count || 0), 0)

    const result = {
      tables: tableStats.sort((a, b) => (b.row_count || 0) - (a.row_count || 0)),
      summary: {
        totalTables: tableStats.length,
        totalRows,
        largestTable: tableStats.reduce((max, table) => 
          (table.row_count || 0) > (max.row_count || 0) ? table : max, 
          { table_name: '', row_count: 0 }
        )
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Table statistics error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch table statistics' 
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