import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ProcessingResult {
  success: boolean;
  processed_count: number;
  error_count: number;
  total_found: number;
  errors?: string[];
  message?: string;
}

export function EmbeddingReprocessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [forceReprocess, setForceReprocess] = useState(false);

  const startReprocessing = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      toast.info('Starting embedding reprocessing...');
      
      const { data, error } = await supabase.functions.invoke('reprocess-embeddings', {
        body: {
          batch_size: batchSize,
          force_reprocess: forceReprocess
        }
      });

      if (error) {
        throw error;
      }

      setResult(data as ProcessingResult);
      
      if (data.success) {
        if (data.processed_count > 0) {
          toast.success(`Successfully reprocessed ${data.processed_count} embeddings!`);
        } else {
          toast.info(data.message || 'No embeddings needed reprocessing');
        }
      } else {
        toast.error('Reprocessing completed with errors');
      }
    } catch (error) {
      console.error('Error reprocessing embeddings:', error);
      toast.error('Failed to reprocess embeddings');
      setResult({
        success: false,
        processed_count: 0,
        error_count: 1,
        total_found: 0,
        errors: [error.message]
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    if (isProcessing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (result?.success && result.processed_count > 0) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (result?.error_count > 0) return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    return <RefreshCw className="h-4 w-4" />;
  };

  const getProgressValue = () => {
    if (!result || !isProcessing) return 0;
    const total = result.total_found || 1;
    const processed = result.processed_count + result.error_count;
    return (processed / total) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Context-Enriched Embeddings Reprocessor
        </CardTitle>
        <CardDescription>
          Upgrade existing embeddings with context enrichment for better search accuracy. 
          This will add document metadata, section context, and Dutch legal terminology to improve semantic understanding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Batch Size</label>
            <input
              type="number"
              min="10"
              max="100"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full mt-1 px-3 py-2 border border-input rounded-md"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of embeddings to process per batch
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="force-reprocess"
              checked={forceReprocess}
              onChange={(e) => setForceReprocess(e.target.checked)}
              disabled={isProcessing}
              className="rounded"
            />
            <label htmlFor="force-reprocess" className="text-sm font-medium">
              Force reprocess all embeddings
            </label>
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing embeddings...</span>
              <span>{Math.round(getProgressValue())}%</span>
            </div>
            <Progress value={getProgressValue()} className="h-2" />
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.processed_count}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{result.error_count}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.total_found}</div>
                <div className="text-sm text-muted-foreground">Total Found</div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Errors encountered:</p>
                    <ul className="text-sm space-y-1">
                      {result.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-muted-foreground">• {error}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-muted-foreground">• ... and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result.message && (
              <Alert>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-between items-center pt-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Context-Enriched</Badge>
            <Badge variant="outline">Dutch Legal Terms</Badge>
            <Badge variant="outline">text-embedding-3-large</Badge>
          </div>
          
          <Button 
            onClick={startReprocessing} 
            disabled={isProcessing}
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {forceReprocess ? 'Reprocess All' : 'Upgrade Embeddings'}
              </>
            )}
          </Button>
        </div>

        {/* Information */}
        <Alert>
          <AlertDescription>
            <strong>What this does:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Adds document metadata (insurer, product type) to embedding context</li>
              <li>• Includes Dutch legal terminology for better semantic understanding</li>
              <li>• Upgrades to text-embedding-3-large model for improved accuracy</li>
              <li>• Preserves existing chunks while enhancing their searchability</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}