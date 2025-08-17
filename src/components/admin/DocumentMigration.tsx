import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, AlertCircle, Database } from 'lucide-react';

interface MigrationResult {
  success: boolean;
  migrated: number;
  total: number;
  errors: string[];
  message: string;
}

export function DocumentMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleMigration = async () => {
    try {
      setIsRunning(true);
      setResult(null);
      setProgress(0);
      
      toast({
        title: "Migratie gestart",
        description: "Het migreren van legacy documenten naar het nieuwe chunks systeem is begonnen...",
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 1000);

      const { data, error } = await supabase.functions.invoke('migrate-documents', {
        body: {}
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        throw new Error(error.message);
      }

      setResult(data as MigrationResult);
      
      if (data.success) {
        toast({
          title: "Migratie voltooid",
          description: `${data.migrated} van ${data.total} documenten succesvol gemigreerd.`,
        });
      } else {
        toast({
          title: "Migratie mislukt",
          description: data.message || "Er is een fout opgetreden tijdens de migratie.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "Migratie fout",
        description: error instanceof Error ? error.message : "Onbekende fout opgetreden",
        variant: "destructive",
      });
      setResult({
        success: false,
        migrated: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : "Onbekende fout"],
        message: "Migratie mislukt"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Document Migratie naar Chunks Systeem
          </CardTitle>
          <CardDescription>
            Migreer de bestaande 814 documenten van het legacy systeem naar het nieuwe chunks-gebaseerde RAG systeem.
            Dit proces maakt gebruik van bestaande embeddings en tekst om de documenten te converteren naar het nieuwe formaat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Belangrijk:</strong> Deze migratie verwerkt alleen documenten die al embeddings en geëxtraheerde tekst hebben (146 documenten).
              Het proces kan enkele minuten duren en zal nieuwe entries aanmaken in de insurers, products, documents_v2, chunks en chunk_embeddings tabellen.
            </AlertDescription>
          </Alert>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Migratie wordt uitgevoerd...</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Status:</strong> {result.message}</p>
                    <p><strong>Gemigreerd:</strong> {result.migrated} van {result.total} documenten</p>
                    {result.errors.length > 0 && (
                      <div>
                        <p><strong>Fouten ({result.errors.length}):</strong></p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {result.errors.slice(0, 5).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {result.errors.length > 5 && (
                            <li>... en nog {result.errors.length - 5} andere fouten</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <Button 
            onClick={handleMigration} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Migratie wordt uitgevoerd...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Start Document Migratie
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}