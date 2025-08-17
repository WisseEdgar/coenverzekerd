import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Play, CheckCircle, AlertCircle } from 'lucide-react';

export function BatchProcessEmbeddings() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    errors: number;
  } | null>(null);

  const processEmbeddings = async () => {
    try {
      setIsProcessing(true);
      setProgress(null);
      
      toast.info('Starting batch processing of embeddings...');

      const { data, error } = await supabase.functions.invoke('batch-process-embeddings', {
        body: { batchSize: 10 }
      });

      if (error) {
        throw error;
      }

      setProgress({
        processed: data.processed || 0,
        total: data.total || 0,
        errors: data.errors || 0
      });

      if (data.processed === 0 && data.total === 0) {
        toast.success('All documents already have embeddings!');
      } else if (data.processed > 0) {
        toast.success(`Successfully processed ${data.processed} documents!`);
        if (data.errors > 0) {
          toast.warning(`${data.errors} documents had errors during processing`);
        }
      } else {
        toast.error('No documents were processed successfully');
      }

    } catch (error) {
      console.error('Error processing embeddings:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    if (isProcessing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (progress?.processed && progress.processed > 0) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (progress?.errors && progress.errors > 0) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <Play className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Document Embeddings Batch Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Process documents that are missing embeddings for AI search functionality.
          This will enable the chat to find and reference relevant insurance documents.
        </p>

        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress.processed}/{progress.total}</span>
            </div>
            <Progress 
              value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} 
              className="h-2"
            />
            {progress.errors > 0 && (
              <p className="text-sm text-yellow-600">
                {progress.errors} documents had processing errors
              </p>
            )}
          </div>
        )}

        <Button 
          onClick={processEmbeddings}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Process Missing Embeddings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}