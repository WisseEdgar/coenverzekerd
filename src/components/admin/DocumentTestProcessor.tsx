import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export function DocumentTestProcessor() {
  const [documentId, setDocumentId] = useState('4d242f99-014a-48bc-85a3-0e3d117702b9');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const reprocessDocument = async () => {
    setIsProcessing(true);
    setError('');
    setResult(null);

    try {
      // Get document info
      const { data: document, error: docError } = await supabase
        .from('documents_v2')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) {
        throw new Error(`Document not found: ${docError.message}`);
      }

      // Clear existing chunks first
      const { error: deleteError } = await supabase
        .from('chunks')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) {
        console.warn('Could not clear chunks:', deleteError);
      }

      // Reset document status
      await supabase
        .from('documents_v2')
        .update({ processing_status: 'pending' })
        .eq('id', documentId);

      // Trigger extraction with new pipeline
      const { data, error: extractError } = await supabase.functions.invoke('extract-pdf', {
        body: {
          file_path: document.file_path,
          document_id: documentId
        }
      });

      if (extractError) {
        throw new Error(`Extraction failed: ${extractError.message}`);
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Extraction Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Document ID"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={reprocessDocument}
            disabled={isProcessing || !documentId}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Reprocess'
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div><strong>Success:</strong> {result.success ? 'Yes' : 'No'}</div>
                <div><strong>Method:</strong> {result.extraction_method}</div>
                <div><strong>Pages:</strong> {result.pages}</div>
                <div><strong>Chunks:</strong> {result.chunks}</div>
                <div><strong>Total Characters:</strong> {result.stats?.totalChars}</div>
                {result.errors?.length > 0 && (
                  <div><strong>Errors:</strong> {result.errors.join('; ')}</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}