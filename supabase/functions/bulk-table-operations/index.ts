import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BulkOperation {
  operation: 'clear_table' | 'delete_records' | 'clear_all_documents'
  table_name?: string
  filter_conditions?: Record<string, any>
  confirm_token?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BulkOperation = await req.json()
    
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
      case 'clear_table':
        if (!body.table_name) {
          throw new Error('Table name required for clear_table operation')
        }

        // Get count before deletion
        const { count: beforeCount } = await supabaseClient
          .from(body.table_name)
          .select('*', { count: 'exact', head: true })

        // Clear the table
        const { error: clearError } = await supabaseClient
          .from(body.table_name)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

        if (clearError) {
          throw new Error(`Failed to clear table ${body.table_name}: ${clearError.message}`)
        }

        // Log the operation
        await supabaseClient
          .rpc('log_admin_action', {
            _action: 'clear_table',
            _table_name: body.table_name,
            _old_values: { row_count: beforeCount }
          })

        result = {
          operation: 'clear_table',
          table_name: body.table_name,
          rows_deleted: beforeCount || 0
        }
        break

      case 'clear_all_documents':
        // Clear all document-related tables in correct order
        const documentTables = [
          'chunk_embeddings',
          'chunks', 
          'sections',
          'answer_citations',
          'answers',
          'queries',
          'document_processing_logs',
          'documents_v2',
          'documents'
        ]

        const deletionResults = []

        for (const tableName of documentTables) {
          try {
            const { count: beforeCount } = await supabaseClient
              .from(tableName)
              .select('*', { count: 'exact', head: true })

            const { error: deleteError } = await supabaseClient
              .from(tableName)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000')

            if (deleteError) {
              console.warn(`Error clearing ${tableName}:`, deleteError)
              deletionResults.push({
                table: tableName,
                status: 'error',
                error: deleteError.message,
                rows_deleted: 0
              })
            } else {
              deletionResults.push({
                table: tableName,
                status: 'success',
                rows_deleted: beforeCount || 0
              })
            }
          } catch (error) {
            console.warn(`Failed to process ${tableName}:`, error)
            deletionResults.push({
              table: tableName,
              status: 'error',
              error: error.message,
              rows_deleted: 0
            })
          }
        }

        // Log the operation
        await supabaseClient
          .rpc('log_admin_action', {
            _action: 'clear_all_documents',
            _new_values: { deletion_results: deletionResults }
          })

        result = {
          operation: 'clear_all_documents',
          results: deletionResults,
          total_rows_deleted: deletionResults.reduce((sum, r) => sum + (r.rows_deleted || 0), 0)
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
    console.error('Bulk operations error:', error)
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