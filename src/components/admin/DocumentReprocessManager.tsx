import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReprocessResult {
  filename: string;
  extracted_company?: string;
  extracted_insurance_type?: string;
  confidence?: string;
  updated: boolean;
  error?: string;
}

interface ReprocessResponse {
  success: boolean;
  summary: {
    total_documents: number;
    processed: number;
    updated: number;
  };
  results: ReprocessResult[];
}

export function DocumentReprocessManager() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReprocessResponse | null>(null);
  const [progress, setProgress] = useState(0);

  const handleReprocess = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      // First get count of uncategorized documents
      const { data: uncategorizedDocs } = await supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .or('insurance_company_id.is.null,insurance_type_id.is.null');

      const totalDocs = uncategorizedDocs?.length || 0;
      
      if (totalDocs === 0) {
        toast.info('Alle documenten zijn al gecategoriseerd');
        setIsProcessing(false);
        return;
      }

      // Simulate progress while processing
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Call the reprocess edge function
      const { data, error } = await supabase.functions.invoke('reprocess-documents', {
        body: {}
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        console.error('Reprocess error:', error);
        toast.error('Fout bij herverwerken: ' + error.message);
        return;
      }

      setResults(data);
      
      if (data.success) {
        toast.success(`Herverwerking voltooid! ${data.summary.updated} documenten bijgewerkt van ${data.summary.processed} verwerkt.`);
      } else {
        toast.error('Herverwerking mislukt');
      }
    } catch (error) {
      console.error('Reprocess error:', error);
      toast.error('Onverwachte fout bij herverwerken');
    } finally {
      setIsProcessing(false);
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;
    
    const variant = 
      confidence === 'high' ? 'default' : 
      confidence === 'medium' ? 'secondary' : 
      'outline';
    
    return <Badge variant={variant}>{confidence}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Document Herverwerking
        </CardTitle>
        <CardDescription>
          Herverwerk bestaande documenten om ontbrekende categorisering automatisch toe te voegen met AI-extractie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Deze functie analyseert alle documenten die nog niet volledig gecategoriseerd zijn
              en probeert automatisch het verzekeringstype en de verzekeraar te extraheren.
            </p>
          </div>
          <Button 
            onClick={handleReprocess}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Verwerken...' : 'Start Herverwerking'}
          </Button>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Voortgang</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Herverwerking voltooid:</strong> {results.summary.updated} van {results.summary.total_documents} documenten bijgewerkt.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {results.results.map((result, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.error 
                      ? 'border-destructive/20 bg-destructive/5' 
                      : result.updated 
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                        : 'border-muted bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {result.filename}
                      </span>
                      {result.updated && (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      )}
                      {result.error && (
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                    </div>
                    {result.confidence && getConfidenceBadge(result.confidence)}
                  </div>
                  
                  {result.error ? (
                    <p className="text-xs text-destructive mt-1">{result.error}</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {result.extracted_insurance_type && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Type:</span>{' '}
                          <span className="font-medium">{result.extracted_insurance_type}</span>
                        </div>
                      )}
                      {result.extracted_company && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Verzekeraar:</span>{' '}
                          <span className="font-medium">{result.extracted_company}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}