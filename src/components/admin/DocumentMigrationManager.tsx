import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle, Clock, Database, FileText, RefreshCw, X, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MigrationStatus {
  legacy_count: number;
  migrated_count: number;
  remaining: number;
}

interface MigrationResult {
  legacy_id: string;
  new_id: string;
  title: string;
  status: string;
}

interface MigrationError {
  document_id: string;
  title: string;
  error: string;
}

interface MigrationResponse {
  success: boolean;
  processed: number;
  errors: MigrationError[];
  results: MigrationResult[];
}

export default function DocumentMigrationManager() {
  const { toast } = useToast();
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [skipProcessed, setSkipProcessed] = useState(true);
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);
  const [migrationErrors, setMigrationErrors] = useState<MigrationError[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('migrate-documents', {
        body: { action: 'status' }
      });

      if (error) throw error;
      
      setStatus(data);
    } catch (error) {
      console.error('Error loading migration status:', error);
      toast({
        title: 'Fout bij laden status',
        description: 'Er is een fout opgetreden bij het laden van de migratiestatus.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startMigration = async () => {
    if (!status || status.remaining <= 0) {
      toast({
        title: 'Niets te migreren',
        description: 'Alle documenten zijn al gemigreerd.',
        variant: 'default'
      });
      return;
    }

    try {
      setIsMigrating(true);
      setMigrationResults([]);
      setMigrationErrors([]);
      setTotalProcessed(0);

      let remaining = status.remaining;
      let batch = 1;

      while (remaining > 0) {
        console.log(`Starting batch ${batch}, remaining: ${remaining}`);
        
        const { data, error } = await supabase.functions.invoke('migrate-documents', {
          body: { 
            action: 'migrate',
            batch_size: Math.min(batchSize, remaining),
            skip_processed: skipProcessed
          }
        });

        if (error) throw error;

        const result = data as MigrationResponse;
        
        if (result.results) {
          setMigrationResults(prev => [...prev, ...result.results]);
        }
        
        if (result.errors) {
          setMigrationErrors(prev => [...prev, ...result.errors]);
        }

        setTotalProcessed(prev => prev + result.processed);
        
        // Update remaining count
        remaining -= result.processed;
        
        // If no documents were processed, break to avoid infinite loop
        if (result.processed === 0) {
          break;
        }
        
        batch++;
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Refresh status after migration
      await loadStatus();

      toast({
        title: 'Migratie voltooid',
        description: `${totalProcessed} documenten succesvol gemigreerd.`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: 'Migratiefout',
        description: `Er is een fout opgetreden: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  React.useEffect(() => {
    loadStatus();
  }, []);

  const progressPercentage = status ? 
    Math.round((status.migrated_count / status.legacy_count) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Document Migratie Status
          </CardTitle>
          <CardDescription>
            Migreer documenten van het oude systeem naar de nieuwe RAG pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {status && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{status.legacy_count}</div>
                    <div className="text-sm text-muted-foreground">Totaal Legacy</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{status.migrated_count}</div>
                    <div className="text-sm text-muted-foreground">Gemigreerd</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{status.remaining}</div>
                    <div className="text-sm text-muted-foreground">Resterend</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Migratie Voortgang</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Button 
                onClick={loadStatus} 
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Status Vernieuwen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Migratie Uitvoeren
          </CardTitle>
          <CardDescription>
            Configureer en start de migratie van legacy documenten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Belangrijk</AlertTitle>
              <AlertDescription>
                Deze migratie zal documenten van het oude systeem naar de nieuwe RAG pipeline verplaatsen. 
                Dit proces kan enkele minuten duren afhankelijk van het aantal documenten.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Grootte</Label>
                <Input
                  id="batch-size"
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  disabled={isMigrating}
                />
                <p className="text-xs text-muted-foreground">
                  Aantal documenten per batch (1-20)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="skip-processed"
                    checked={skipProcessed}
                    onCheckedChange={setSkipProcessed}
                    disabled={isMigrating}
                  />
                  <Label htmlFor="skip-processed">Sla verwerkte documenten over</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Voorkomt dubbele migratie van bestaande documenten
                </p>
              </div>
            </div>

            <Button 
              onClick={startMigration}
              disabled={isMigrating || !status || status.remaining <= 0}
              className="w-full"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Migratie Bezig... ({totalProcessed} verwerkt)
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Migratie ({status?.remaining || 0} documenten)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(migrationResults.length > 0 || migrationErrors.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Migratie Resultaten
            </CardTitle>
            <CardDescription>
              Overzicht van de gemigreerde documenten en eventuele fouten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {migrationResults.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Succesvol Gemigreerd ({migrationResults.length})</span>
                  </div>
                  <ScrollArea className="h-32 w-full rounded border p-2">
                    <div className="space-y-1">
                      {migrationResults.map((result, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="truncate">{result.title}</span>
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {migrationErrors.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <X className="h-4 w-4 text-red-600" />
                      <span className="font-medium">Fouten ({migrationErrors.length})</span>
                    </div>
                    <ScrollArea className="h-32 w-full rounded border p-2">
                      <div className="space-y-2">
                        {migrationErrors.map((error, index) => (
                          <div key={index} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="truncate font-medium">{error.title}</span>
                              <Badge variant="destructive">
                                <X className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {error.error}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}