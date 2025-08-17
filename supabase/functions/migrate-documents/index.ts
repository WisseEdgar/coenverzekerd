import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LegacyDocument {
  id: string;
  title: string;
  filename: string;
  file_path: string;
  insurance_type_id?: string;
  insurance_company_id?: string;
  summary?: string;
  extracted_text?: string;
  created_at: string;
}

interface InsuranceType {
  id: string;
  name: string;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, batch_size = 5, skip_processed = true } = await req.json();

    if (action === 'status') {
      // Get migration status
      const { data: legacyDocs, error: legacyError } = await supabase
        .from('documents')
        .select('id, title')
        .order('created_at', { ascending: false });

      const { data: newDocs, error: newError } = await supabase
        .from('documents_v2')
        .select('id, title')
        .order('created_at', { ascending: false });

      if (legacyError || newError) {
        throw new Error(`Error getting status: ${legacyError?.message || newError?.message}`);
      }

      return new Response(JSON.stringify({
        legacy_count: legacyDocs?.length || 0,
        migrated_count: newDocs?.length || 0,
        remaining: (legacyDocs?.length || 0) - (newDocs?.length || 0)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'migrate') {
      console.log(`Starting migration of ${batch_size} documents...`);
      
      // Get legacy documents to migrate
      let query = supabase
        .from('documents')
        .select(`
          id, title, filename, file_path, insurance_type_id, insurance_company_id,
          summary, extracted_text, created_at,
          insurance_types!left(id, name),
          insurance_companies!left(id, name)
        `)
        .order('created_at', { ascending: true })
        .limit(batch_size);

      if (skip_processed) {
        // Only migrate documents not already in documents_v2
        const { data: processedIds } = await supabase
          .from('documents_v2')
          .select('file_path');
        
        const processedPaths = processedIds?.map(d => d.file_path) || [];
        if (processedPaths.length > 0) {
          query = query.not('file_path', 'in', `(${processedPaths.map(p => `"${p}"`).join(',')})`);
        }
      }

      const { data: legacyDocs, error: queryError } = await query;

      if (queryError) {
        throw new Error(`Error querying legacy documents: ${queryError.message}`);
      }

      if (!legacyDocs || legacyDocs.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No documents to migrate',
          processed: 0,
          errors: []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Found ${legacyDocs.length} documents to migrate`);

      const results = [];
      const errors = [];

      for (const doc of legacyDocs) {
        try {
          console.log(`Migrating document: ${doc.title}`);
          
          // Create or find insurer
          let insurerId = null;
          if (doc.insurance_companies?.name) {
            const { data: existingInsurer } = await supabase
              .from('insurers')
              .select('id')
              .eq('name', doc.insurance_companies.name)
              .single();

            if (existingInsurer) {
              insurerId = existingInsurer.id;
            } else {
              const { data: newInsurer, error: insurerError } = await supabase
                .from('insurers')
                .insert({
                  name: doc.insurance_companies.name,
                  kvk: null,
                  website: null
                })
                .select('id')
                .single();

              if (insurerError) throw insurerError;
              insurerId = newInsurer.id;
            }
          }

          // Create or find product
          let productId = null;
          if (insurerId && doc.insurance_types?.name) {
            const productName = `${doc.insurance_companies.name} - ${doc.insurance_types.name}`;
            
            const { data: existingProduct } = await supabase
              .from('products')
              .select('id')
              .eq('name', productName)
              .eq('insurer_id', insurerId)
              .single();

            if (existingProduct) {
              productId = existingProduct.id;
            } else {
              const { data: newProduct, error: productError } = await supabase
                .from('products')
                .insert({
                  name: productName,
                  insurer_id: insurerId,
                  line_of_business: doc.insurance_types.name,
                  version_label: 'Legacy Import',
                  jurisdiction: 'NL',
                  language: 'nl'
                })
                .select('id')
                .single();

              if (productError) throw productError;
              productId = newProduct.id;
            }
          }

          // Create documents_v2 entry
          const { data: newDoc, error: docError } = await supabase
            .from('documents_v2')
            .insert({
              product_id: productId,
              filename: doc.filename,
              title: doc.title,
              file_path: doc.file_path,
              processing_status: 'pending',
              source_type: 'pdf',
              version_label: 'Legacy Import'
            })
            .select('id')
            .single();

          if (docError) throw docError;

          // If we have extracted text, call ingest-pdf to process it
          if (doc.extracted_text && doc.extracted_text.length > 100) {
            console.log(`Processing PDF text for ${doc.title}...`);
            
            const { error: ingestError } = await supabase.functions.invoke('ingest-pdf', {
              body: {
                document_id: newDoc.id,
                pages: [{ page: 1, text: doc.extracted_text }]
              }
            });

            if (ingestError) {
              console.error(`Error processing PDF text: ${ingestError.message}`);
              // Continue with migration even if embedding fails
            }
          }

          results.push({
            legacy_id: doc.id,
            new_id: newDoc.id,
            title: doc.title,
            status: 'success'
          });

          console.log(`Successfully migrated: ${doc.title}`);

        } catch (error) {
          console.error(`Error migrating document ${doc.title}:`, error);
          errors.push({
            document_id: doc.id,
            title: doc.title,
            error: error.message
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        processed: results.length,
        errors: errors,
        results: results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});