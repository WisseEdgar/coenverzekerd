import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BulkDataOperation {
  operation: 'export' | 'import' | 'search_replace'
  table_name?: string
  format?: 'json' | 'csv'
  data?: any[]
  search_field?: string
  search_value?: string
  replace_value?: string
  filters?: Record<string, any>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BulkDataOperation = await req.json()
    
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

    let result: any = {}

    switch (body.operation) {
      case 'export':
        if (!body.table_name) {
          throw new Error('Table name required for export operation')
        }

        let query = supabaseClient.from(body.table_name).select('*')
        
        // Apply filters if provided
        if (body.filters) {
          Object.entries(body.filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              query = query.eq(key, value)
            }
          })
        }

        const { data: exportData, error: exportError } = await query

        if (exportError) {
          throw new Error(`Failed to export from ${body.table_name}: ${exportError.message}`)
        }

        // Log the export operation
        await supabaseClient
          .rpc('log_admin_action', {
            _action: 'bulk_export',
            _table_name: body.table_name,
            _new_values: { 
              format: body.format || 'json',
              row_count: exportData?.length || 0,
              filters: body.filters
            }
          })

        result = {
          operation: 'export',
          table_name: body.table_name,
          format: body.format || 'json',
          row_count: exportData?.length || 0,
          data: exportData
        }
        break

      case 'search_replace':
        if (!body.table_name || !body.search_field || !body.search_value || body.replace_value === undefined) {
          throw new Error('Table name, search field, search value, and replace value required for search_replace operation')
        }

        // First, find matching records
        const { data: matchingRecords, error: searchError } = await supabaseClient
          .from(body.table_name)
          .select('*')
          .ilike(body.search_field, `%${body.search_value}%`)

        if (searchError) {
          throw new Error(`Failed to search in ${body.table_name}: ${searchError.message}`)
        }

        if (!matchingRecords || matchingRecords.length === 0) {
          result = {
            operation: 'search_replace',
            table_name: body.table_name,
            matches_found: 0,
            updates_made: 0
          }
          break
        }

        // Update matching records
        const updatedRecords = matchingRecords.map(record => ({
          ...record,
          [body.search_field]: record[body.search_field].replace(
            new RegExp(body.search_value, 'gi'), 
            body.replace_value
          )
        }))

        // Perform bulk update
        const { error: updateError } = await supabaseClient
          .from(body.table_name)
          .upsert(updatedRecords)

        if (updateError) {
          throw new Error(`Failed to update records in ${body.table_name}: ${updateError.message}`)
        }

        // Log the search/replace operation
        await supabaseClient
          .rpc('log_admin_action', {
            _action: 'bulk_search_replace',
            _table_name: body.table_name,
            _old_values: { 
              search_field: body.search_field,
              search_value: body.search_value
            },
            _new_values: { 
              replace_value: body.replace_value,
              matches_found: matchingRecords.length,
              updates_made: matchingRecords.length
            }
          })

        result = {
          operation: 'search_replace',
          table_name: body.table_name,
          search_field: body.search_field,
          search_value: body.search_value,
          replace_value: body.replace_value,
          matches_found: matchingRecords.length,
          updates_made: matchingRecords.length
        }
        break

      default:
        throw new Error(`Unsupported operation: ${body.operation}`)
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
    console.error('Bulk data operations error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to perform bulk operation' 
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