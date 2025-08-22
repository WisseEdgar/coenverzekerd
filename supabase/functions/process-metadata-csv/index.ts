import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVRow {
  document_code: string;
  stationaire_naam?: string;
  handelsnaam?: string;
  verzekeringsmaatschappij: string;
  verzekeringscategorie?: string;
  product_naam: string;
  document_type: string;
  versie_datum?: string;
  source_url?: string;
  download_priority?: number;
  notes?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { csvData } = await req.json();
    
    console.log(`Processing CSV with ${csvData.length} rows for user ${user.id}`);

    const batchId = crypto.randomUUID();
    const validationErrors: ValidationError[] = [];
    const validRows: CSVRow[] = [];

    // Validate each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowErrors = validateRow(row, i + 1);
      
      if (rowErrors.length > 0) {
        validationErrors.push(...rowErrors);
      } else {
        validRows.push(row);
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        errors: validationErrors,
        validRowCount: validRows.length,
        totalRowCount: csvData.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Insert valid rows in batches
    const batchSize = 100;
    const insertedRows = [];
    
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const processedBatch = batch.map(row => ({
        ...row,
        import_batch_id: batchId,
        versie_datum: row.versie_datum ? new Date(row.versie_datum).toISOString().split('T')[0] : null,
        download_priority: row.download_priority || 1
      }));

      const { data, error } = await supabase
        .from('document_metadata_import')
        .insert(processedBatch)
        .select();

      if (error) {
        throw new Error(`Database insert error: ${error.message}`);
      }

      insertedRows.push(...(data || []));
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, rows ${i + 1}-${Math.min(i + batchSize, validRows.length)}`);
    }

    // Generate document codes for new entries
    await generateDocumentCodes(supabase, insertedRows);

    console.log(`Successfully processed ${validRows.length} rows with batch ID ${batchId}`);

    return new Response(JSON.stringify({
      success: true,
      batchId,
      processedRows: validRows.length,
      insertedRows: insertedRows.length,
      message: `Successfully imported ${validRows.length} metadata records`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-metadata-csv:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function validateRow(row: any, rowNumber: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!row.document_code?.trim()) {
    errors.push({
      row: rowNumber,
      field: 'document_code',
      message: 'Document code is required'
    });
  }

  if (!row.verzekeringsmaatschappij?.trim()) {
    errors.push({
      row: rowNumber,
      field: 'verzekeringsmaatschappij',
      message: 'Verzekeringsmaatschappij is required'
    });
  }

  if (!row.product_naam?.trim()) {
    errors.push({
      row: rowNumber,
      field: 'product_naam',
      message: 'Product naam is required'
    });
  }

  if (!row.document_type?.trim()) {
    errors.push({
      row: rowNumber,
      field: 'document_type',
      message: 'Document type is required'
    });
  }

  // Format validations
  if (row.document_code && !/^[0-9]{3}-[A-Z]{2,3}-[0-9]{2}-[A-Z0-9-]+$/.test(row.document_code.trim())) {
    errors.push({
      row: rowNumber,
      field: 'document_code',
      message: 'Document code format invalid (expected: XXX-TYPE-NN-PRODUCT)'
    });
  }

  if (row.document_type && !['PV', 'BV', 'RV', 'AV', 'IV'].includes(row.document_type.trim().toUpperCase())) {
    errors.push({
      row: rowNumber,
      field: 'document_type',
      message: 'Document type must be one of: PV, BV, RV, AV, IV'
    });
  }

  if (row.versie_datum && !/^\d{4}-\d{2}-\d{2}$/.test(row.versie_datum.trim())) {
    errors.push({
      row: rowNumber,
      field: 'versie_datum',
      message: 'Version date must be in YYYY-MM-DD format'
    });
  }

  if (row.source_url && !isValidUrl(row.source_url.trim())) {
    errors.push({
      row: rowNumber,
      field: 'source_url',
      message: 'Invalid URL format'
    });
  }

  return errors;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

async function generateDocumentCodes(supabase: any, importedRows: any[]) {
  for (const row of importedRows) {
    try {
      const parts = row.document_code.split('-');
      if (parts.length >= 4) {
        const baseInsuranceCode = parts.slice(0, -1).join('-');
        
        const { error } = await supabase
          .from('document_codes')
          .insert({
            code: row.document_code,
            base_insurance_code: baseInsuranceCode,
            document_type: row.document_type.toUpperCase(),
            variant_code: parts[2]
          });

        if (error && !error.message.includes('duplicate key')) {
          console.error(`Error creating document code for ${row.document_code}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error processing document code ${row.document_code}:`, error);
    }
  }
}