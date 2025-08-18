// Script to manually reprocess a document for testing
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reprocessDocument(documentId: string) {
  console.log(`Starting reprocessing for document: ${documentId}`)
  
  // Get document info
  const { data: document, error: docError } = await supabase
    .from('documents_v2')
    .select('*')
    .eq('id', documentId)
    .single()
  
  if (docError) {
    console.error('Error fetching document:', docError)
    return
  }
  
  console.log('Document:', document.title, document.file_path)
  
  // Clear existing chunks
  const { error: deleteError } = await supabase
    .from('chunks')
    .delete()
    .eq('document_id', documentId)
    
  if (deleteError) {
    console.error('Error deleting chunks:', deleteError)
  } else {
    console.log('Cleared existing chunks')
  }
  
  // Reset document status
  await supabase
    .from('documents_v2')
    .update({ processing_status: 'pending' })
    .eq('id', documentId)
  
  // Trigger extraction
  const { data, error } = await supabase.functions.invoke('extract-pdf', {
    body: {
      file_path: document.file_path,
      document_id: documentId
    }
  })
  
  if (error) {
    console.error('Extraction error:', error)
  } else {
    console.log('Extraction result:', data)
  }
}

// Usage: bun run scripts/reprocess-document.ts [document-id]
const documentId = process.argv[2] || '4d242f99-014a-48bc-85a3-0e3d117702b9'
reprocessDocument(documentId).then(() => {
  console.log('Done')
  process.exit(0)
}).catch(console.error)