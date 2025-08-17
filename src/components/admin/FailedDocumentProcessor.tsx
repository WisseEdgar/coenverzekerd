import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

interface FailedDocument {
  document_id: string;
  filename: string;
  title: string;
  failed_chunks: number;
  total_chunks: number;
}

interface ReprocessResult {
  document_id: string;
  success: boolean;
  error?: string;
  extracted_pages?: number;
}

export function FailedDocumentProcessor() {
  const [failedDocuments, setFailedDocuments] = useState<FailedDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReprocessResult[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const loadFailedDocuments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reprocess-failed-documents', {
        body: { action: 'list' }
      });

      if (error) throw error;

      setFailedDocuments(data.failed_documents || []);
      toast({
        title: "Documenten geladen",
        description: `${data.failed_documents?.length || 0} documenten met gefaalde extractie gevonden.`
      });
    } catch (error) {
      console.error('Error loading failed documents:', error);
      toast({
        title: "Fout bij laden",
        description: "Kon gefaalde documenten niet laden.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentSelection = (documentId: string, checked: boolean | 'indeterminate') => {
    console.log('handleDocumentSelection called:', { documentId, checked, type: typeof checked });
    
    // Only treat explicit true as checked, everything else as unchecked
    const isChecked = checked === true;
    
    if (isChecked) {
      setSelectedDocuments(prev => {
        if (!prev.includes(documentId)) {
          console.log('Adding document to selection:', documentId);
          return [...prev, documentId];
        }
        return prev;
      });
    } else {
      setSelectedDocuments(prev => {
        const newSelection = prev.filter(id => id !== documentId);
        console.log('Removing document from selection:', documentId, 'New selection:', newSelection);
        return newSelection;
      });
    }
  };

  const selectAll = () => {
    setSelectedDocuments(failedDocuments.map(doc => doc.document_id));
  };

  const clearSelection = () => {
    setSelectedDocuments([]);
  };

  const reprocessDocuments = async () => {
    if (selectedDocuments.length === 0) {
      toast({
        title: "Geen selectie",
        description: "Selecteer eerst documenten om te herverwerken.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke('reprocess-failed-documents', {
        body: { 
          action: 'reprocess',
          document_ids: selectedDocuments 
        }
      });

      if (error) throw error;

      setResults(data.results || []);
      setProgress(100);
      
      const successCount = data.results?.filter((r: ReprocessResult) => r.success).length || 0;
      const totalCount = data.results?.length || 0;

      toast({
        title: "Herverwerking voltooid",
        description: `${successCount}/${totalCount} documenten succesvol herverwerkt.`,
        variant: successCount === totalCount ? "default" : "destructive"
      });

      // Reload failed documents to reflect changes
      await loadFailedDocuments();
      setSelectedDocuments([]);
    } catch (error) {
      console.error('Error reprocessing documents:', error);
      toast({
        title: "Fout bij herverwerking",
        description: "Er is een fout opgetreden tijdens het herverwerken.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Gefaalde PDF Extractie Herstel
          </CardTitle>
          <CardDescription>
            Herverwerk documenten waarvan de PDF-tekstextractie is mislukt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={loadFailedDocuments} disabled={isLoading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Laden...' : 'Documenten Laden'}
            </Button>
            {failedDocuments.length > 0 && (
              <>
                <Button onClick={selectAll} variant="outline" size="sm">
                  Alles Selecteren
                </Button>
                <Button onClick={clearSelection} variant="outline" size="sm">
                  Selectie Wissen
                </Button>
                <Button 
                  onClick={reprocessDocuments} 
                  disabled={selectedDocuments.length === 0 || isProcessing}
                  className="ml-auto"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Herverwerken...
                    </>
                  ) : (
                    `${selectedDocuments.length} Document(en) Herverwerken`
                  )}
                </Button>
              </>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Documenten worden herverwerkt...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {failedDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Documenten met Gefaalde Extractie ({failedDocuments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {failedDocuments.map((doc) => (
                <div key={doc.document_id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={selectedDocuments.includes(doc.document_id)}
                    onCheckedChange={(checked) => handleDocumentSelection(doc.document_id, checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{doc.title}</p>
                      <Badge variant="destructive" className="text-xs">
                        {doc.failed_chunks}/{doc.total_chunks} chunks gefaald
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{doc.filename}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Herverwerking Resultaten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      Document ID: {result.document_id}
                    </p>
                    {result.success ? (
                      <p className="text-sm text-success">
                        Succesvol herverwerkt - {result.extracted_pages} pagina's geëxtraheerd
                      </p>
                    ) : (
                      <p className="text-sm text-destructive">
                        Fout: {result.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}