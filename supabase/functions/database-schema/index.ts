import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}

interface ForeignKey {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
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

    // Get all tables and their columns
    const { data: tablesData, error: tablesError } = await supabaseClient
      .from('information_schema.columns')
      .select(`
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      `)
      .eq('table_schema', 'public')
      .order('table_name')
      .order('ordinal_position')

    if (tablesError) {
      console.error('Error fetching tables:', tablesError)
      throw tablesError
    }

    // Get primary keys
    const { data: primaryKeysData, error: primaryKeysError } = await supabaseClient
      .from('information_schema.key_column_usage')
      .select(`
        table_name,
        column_name,
        constraint_name
      `)
      .eq('table_schema', 'public')

    if (primaryKeysError) {
      console.error('Error fetching primary keys:', primaryKeysError)
      throw primaryKeysError
    }

    // Get foreign keys
    const { data: foreignKeysData, error: foreignKeysError } = await supabaseClient
      .from('information_schema.table_constraints')
      .select(`
        table_name,
        constraint_name,
        constraint_type
      `)
      .eq('table_schema', 'public')
      .eq('constraint_type', 'FOREIGN KEY')

    if (foreignKeysError) {
      console.error('Error fetching foreign keys:', foreignKeysError)
      throw foreignKeysError
    }

    // Process and structure the data
    const tables = new Map()
    
    tablesData.forEach((row: any) => {
      if (!tables.has(row.table_name)) {
        tables.set(row.table_name, {
          name: row.table_name,
          columns: [],
          primaryKeys: [],
          foreignKeys: []
        })
      }

      const isPrimaryKey = primaryKeysData?.some((pk: any) => 
        pk.table_name === row.table_name && 
        pk.column_name === row.column_name &&
        pk.constraint_name.includes('_pkey')
      ) || false

      tables.get(row.table_name).columns.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        isPrimaryKey
      })

      if (isPrimaryKey) {
        tables.get(row.table_name).primaryKeys.push(row.column_name)
      }
    })

    const result = {
      tables: Array.from(tables.values()),
      summary: {
        totalTables: tables.size,
        totalColumns: tablesData.length
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
    console.error('Database schema error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch database schema' 
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