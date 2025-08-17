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
  insurance_types?: { id: string; name: string };
  insurance_companies?: { id: string; name: string };
}

// Mapping from insurance types to line of business
const INSURANCE_TYPE_MAPPING: Record<string, string> = {
  'Autoverzekering': 'motor',
  'Woonhuisverzekering': 'property',
  'Inboedelverzekering': 'property',
  'Reisverzekering': 'travel',
  'Zorgverzekering': 'health',
  'Levensverzekering': 'life',
  'Aansprakelijkheidsverzekering': 'liability',
  'Rechtsbijstandverzekering': 'legal',
  'Ongevallenverzekering': 'accident',
  'Bedrijfsverzekering': 'commercial',
  'Cyberverzekering': 'cyber',
  'Gebouwenverzekering': 'property',
  'Machines': 'commercial',
  'Default': 'general'
};

function mapInsuranceTypeToLineOfBusiness(insuranceType: string): string {
  // Try exact match first
  if (INSURANCE_TYPE_MAPPING[insuranceType]) {
    return INSURANCE_TYPE_MAPPING[insuranceType];
  }
  
  // Try partial matches
  const lowerType = insuranceType.toLowerCase();
  if (lowerType.includes('auto') || lowerType.includes('motor')) return 'motor';
  if (lowerType.includes('woning') || lowerType.includes('huis') || lowerType.includes('gebouw')) return 'property';
  if (lowerType.includes('inboedel')) return 'property';
  if (lowerType.includes('reis')) return 'travel';
  if (lowerType.includes('zorg') || lowerType.includes('health')) return 'health';
  if (lowerType.includes('leven') || lowerType.includes('life')) return 'life';
  if (lowerType.includes('aansprakelijk') || lowerType.includes('liability')) return 'liability';
  if (lowerType.includes('rechtsbijstand') || lowerType.includes('legal')) return 'legal';
  if (lowerType.includes('ongeval') || lowerType.includes('accident')) return 'accident';
  if (lowerType.includes('bedrijf') || lowerType.includes('commercial')) return 'commercial';
  if (lowerType.includes('cyber')) return 'cyber';
  if (lowerType.includes('machine')) return 'commercial';
  
  // Default fallback
  return 'general';
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
      
      // Get legacy documents to migrate (get more than batch_size to account for processed docs)
      let query = supabase
        .from('documents')
        .select(`
          id, title, filename, file_path, insurance_type_id, insurance_company_id,
          summary, extracted_text, created_at,
          insurance_types!left(id, name),
          insurance_companies!left(id, name)
        `)
        .order('created_at', { ascending: true })
        .limit(batch_size * 10); // Get more docs to account for already processed ones

      // Get all legacy documents first, then filter in memory to avoid URL length issues
      const { data: allLegacyDocs, error: allQueryError } = await query;
      
      if (allQueryError) {
        throw new Error(`Error querying legacy documents: ${allQueryError.message}`);
      }

      let legacyDocs = allLegacyDocs || [];

      if (skip_processed && legacyDocs.length > 0) {
        // Get processed file paths and filter in memory
        const { data: processedIds } = await supabase
          .from('documents_v2')
          .select('file_path');
        
        const processedPaths = new Set(processedIds?.map(d => d.file_path) || []);
        console.log(`Found ${processedPaths.size} already processed documents`);
        
        legacyDocs = legacyDocs.filter(doc => !processedPaths.has(doc.file_path));
        console.log(`Filtered to ${legacyDocs.length} unprocessed documents`);
        
        // Take only the batch size needed
        legacyDocs = legacyDocs.slice(0, batch_size);
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
          console.log(`Insurance type: ${doc.insurance_types?.name || 'None'}`);
          console.log(`Insurance company: ${doc.insurance_companies?.name || 'None'}`);
          
          // Create or find insurer
          let insurerId = null;
          let insurerName = 'Unknown Insurer';
          
          if (doc.insurance_companies?.name) {
            insurerName = doc.insurance_companies.name;
            console.log(`Looking for insurer: ${insurerName}`);
            
            const { data: existingInsurer, error: findInsurerError } = await supabase
              .from('insurers')
              .select('id')
              .eq('name', insurerName)
              .maybeSingle();

            if (findInsurerError) {
              console.error(`Error finding insurer: ${findInsurerError.message}`);
            }

            if (existingInsurer) {
              insurerId = existingInsurer.id;
              console.log(`Found existing insurer: ${insurerId}`);
            } else {
              console.log(`Creating new insurer: ${insurerName}`);
              const { data: newInsurer, error: insurerError } = await supabase
                .from('insurers')
                .insert({
                  name: insurerName,
                  kvk: null,
                  website: null
                })
                .select('id')
                .single();

              if (insurerError) {
                console.error(`Error creating insurer: ${insurerError.message}`);
                throw insurerError;
              }
              insurerId = newInsurer.id;
              console.log(`Created new insurer: ${insurerId}`);
            }
          } else {
            // Create default insurer if none exists
            console.log(`No insurance company found, creating default insurer`);
            const { data: defaultInsurer, error: defaultInsurerError } = await supabase
              .from('insurers')
              .select('id')
              .eq('name', 'Unknown Insurer')
              .maybeSingle();

            if (defaultInsurer) {
              insurerId = defaultInsurer.id;
            } else {
              const { data: newDefaultInsurer, error: createDefaultError } = await supabase
                .from('insurers')
                .insert({
                  name: 'Unknown Insurer',
                  kvk: null,
                  website: null
                })
                .select('id')
                .single();

              if (createDefaultError) {
                console.error(`Error creating default insurer: ${createDefaultError.message}`);
                throw createDefaultError;
              }
              insurerId = newDefaultInsurer.id;
            }
          }

          // Create or find product
          let productId = null;
          if (insurerId) {
            const insuranceTypeName = doc.insurance_types?.name || 'Unknown';
            const lineOfBusiness = mapInsuranceTypeToLineOfBusiness(insuranceTypeName);
            const productName = `${insurerName} - ${insuranceTypeName}`;
            
            console.log(`Looking for product: ${productName} with line of business: ${lineOfBusiness}`);
            
            const { data: existingProduct, error: findProductError } = await supabase
              .from('products')
              .select('id')
              .eq('name', productName)
              .eq('insurer_id', insurerId)
              .maybeSingle();

            if (findProductError) {
              console.error(`Error finding product: ${findProductError.message}`);
            }

            if (existingProduct) {
              productId = existingProduct.id;
              console.log(`Found existing product: ${productId}`);
            } else {
              console.log(`Creating new product: ${productName}`);
              const { data: newProduct, error: productError } = await supabase
                .from('products')
                .insert({
                  name: productName,
                  insurer_id: insurerId,
                  line_of_business: lineOfBusiness,
                  version_label: 'Legacy Import',
                  jurisdiction: 'NL',
                  language: 'nl'
                })
                .select('id')
                .single();

              if (productError) {
                console.error(`Error creating product: ${productError.message}`);
                console.error(`Product data:`, {
                  name: productName,
                  insurer_id: insurerId,
                  line_of_business: lineOfBusiness
                });
                throw productError;
              }
              productId = newProduct.id;
              console.log(`Created new product: ${productId}`);
            }
          }

          if (!productId) {
            throw new Error(`Could not create or find product for document ${doc.title}`);
          }

          // Create documents_v2 entry
          console.log(`Creating documents_v2 entry for: ${doc.title}`);
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

          if (docError) {
            console.error(`Error creating documents_v2 entry: ${docError.message}`);
            console.error(`Document data:`, {
              product_id: productId,
              filename: doc.filename,
              title: doc.title,
              file_path: doc.file_path
            });
            throw docError;
          }

          console.log(`Created documents_v2 entry: ${newDoc.id}`);

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