import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('Starting document migration...');

    // Step 1: Get all documents with embeddings and text
    const { data: legacyDocs, error: fetchError } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        filename,
        file_path,
        extracted_text,
        embedding,
        file_size,
        created_at,
        updated_at,
        insurance_types(id, name),
        insurance_companies(id, name)
      `)
      .not('embedding', 'is', null)
      .not('extracted_text', 'is', null)
      .gt('extracted_text', '');

    if (fetchError) {
      throw new Error(`Failed to fetch legacy documents: ${fetchError.message}`);
    }

    console.log(`Found ${legacyDocs?.length || 0} documents to migrate`);

    if (!legacyDocs || legacyDocs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No documents found to migrate',
        migrated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let migratedCount = 0;
    const errors: string[] = [];

    for (const doc of legacyDocs) {
      try {
        console.log(`Migrating document: ${doc.title}`);

        // Step 2: Create or find insurer
        let insurerId: string;
        const insurerName = doc.insurance_companies?.name || 'Onbekend';
        
        const { data: existingInsurer } = await supabase
          .from('insurers')
          .select('id')
          .eq('name', insurerName)
          .single();

        if (existingInsurer) {
          insurerId = existingInsurer.id;
        } else {
          const { data: newInsurer, error: insurerError } = await supabase
            .from('insurers')
            .insert({ name: insurerName })
            .select('id')
            .single();

          if (insurerError) {
            console.error(`Failed to create insurer ${insurerName}:`, insurerError);
            errors.push(`Failed to create insurer ${insurerName}: ${insurerError.message}`);
            continue;
          }
          insurerId = newInsurer.id;
        }

        // Step 3: Create or find product
        let productId: string;
        const lineOfBusiness = doc.insurance_types?.name || 'Algemeen';
        const productName = `${insurerName} ${lineOfBusiness}`;

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
              line_of_business: lineOfBusiness,
              insurer_id: insurerId,
              version_label: 'Legacy Import'
            })
            .select('id')
            .single();

          if (productError) {
            console.error(`Failed to create product ${productName}:`, productError);
            errors.push(`Failed to create product ${productName}: ${productError.message}`);
            continue;
          }
          productId = newProduct.id;
        }

        // Step 4: Create document_v2 entry
        const { data: newDoc, error: docError } = await supabase
          .from('documents_v2')
          .insert({
            title: doc.title,
            filename: doc.filename,
            file_path: doc.file_path,
            product_id: productId,
            processing_status: 'completed',
            source_type: 'pdf',
            version_label: 'Legacy Import',
            created_at: doc.created_at,
            updated_at: doc.updated_at
          })
          .select('id')
          .single();

        if (docError) {
          console.error(`Failed to create document_v2 for ${doc.title}:`, docError);
          errors.push(`Failed to create document_v2 for ${doc.title}: ${docError.message}`);
          continue;
        }

        // Step 5: Create chunk from the full document text
        const chunkText = doc.extracted_text.substring(0, 8000); // Limit chunk size
        const tokenCount = Math.ceil(chunkText.length / 4); // Rough token estimate

        const { data: newChunk, error: chunkError } = await supabase
          .from('chunks')
          .insert({
            document_id: newDoc.id,
            text: chunkText,
            page: 1,
            token_count: tokenCount,
            metadata: {
              source: 'legacy_migration',
              original_id: doc.id,
              insurance_type: doc.insurance_types?.name,
              insurance_company: doc.insurance_companies?.name
            }
          })
          .select('id')
          .single();

        if (chunkError) {
          console.error(`Failed to create chunk for ${doc.title}:`, chunkError);
          errors.push(`Failed to create chunk for ${doc.title}: ${chunkError.message}`);
          continue;
        }

        // Step 6: Create chunk embedding
        const { error: embeddingError } = await supabase
          .from('chunk_embeddings')
          .insert({
            chunk_id: newChunk.id,
            embedding: doc.embedding
          });

        if (embeddingError) {
          console.error(`Failed to create embedding for ${doc.title}:`, embeddingError);
          errors.push(`Failed to create embedding for ${doc.title}: ${embeddingError.message}`);
          continue;
        }

        migratedCount++;
        console.log(`Successfully migrated: ${doc.title} (${migratedCount}/${legacyDocs.length})`);

      } catch (error) {
        console.error(`Error migrating document ${doc.title}:`, error);
        errors.push(`Error migrating document ${doc.title}: ${error.message}`);
      }
    }

    console.log(`Migration completed. Migrated ${migratedCount} documents`);

    return new Response(JSON.stringify({
      success: true,
      message: `Migration completed successfully`,
      migrated: migratedCount,
      total: legacyDocs.length,
      errors: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Migration error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      migrated: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});