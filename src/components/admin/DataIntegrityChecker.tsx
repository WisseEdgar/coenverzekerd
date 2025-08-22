import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface IntegrityIssue {
  table: string;
  issue_type: string;
  count: number;
  details: any[];
}

interface IntegrityCheckResult {
  timestamp: string;
  total_issues: number;
  checks_performed: number;
  results: IntegrityIssue[];
}

export function DataIntegrityChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<IntegrityCheckResult | null>(null);
  const { toast } = useToast();

  const runIntegrityCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-integrity-check', {
        method: 'POST'
      });

      if (error) throw error;

      setCheckResult(data);
      
      if (data.total_issues === 0) {
        toast({
          title: "Integriteitscontrole voltooid",
          description: "Geen problemen gevonden! Database is in goede staat.",
        });
      } else {
        toast({
          title: "Integriteitscontrole voltooid",
          description: `${data.total_issues} problemen gevonden die aandacht nodig hebben.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Integrity check failed:', error);
      toast({
        title: "Fout bij integriteitscontrole",
        description: "Er is een fout opgetreden bij het controleren van de database.",
        variant: "destructive"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getIssueTypeLabel = (issueType: string) => {
    const labels: Record<string, string> = {
      'orphaned_chunks': 'Verweesde Chunks',
      'orphaned_embeddings': 'Verweesde Embeddings',
      'missing_products': 'Ontbrekende Producten',
      'missing_insurers': 'Ontbrekende Verzekeraars',
      'missing_embeddings': 'Ontbrekende Embeddings'
    };
    return labels[issueType] || issueType;
  };

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'bg-green-500';
    if (count < 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Integriteitscontrole
          </CardTitle>
          <CardDescription>
            Controleer de database op inconsistenties, verweesde records en andere problemen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Button 
              onClick={runIntegrityCheck} 
              disabled={isChecking}
              className="flex items-center gap-2"
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isChecking ? 'Controleren...' : 'Start Integriteitscontrole'}
            </Button>
            
            {checkResult && (
              <div className="text-sm text-muted-foreground">
                Laatste controle: {new Date(checkResult.timestamp).toLocaleString('nl-NL')}
              </div>
            )}
          </div>

          {checkResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      {checkResult.total_issues === 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-2xl font-bold">{checkResult.total_issues}</p>
                        <p className="text-sm text-muted-foreground">Totaal Problemen</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{checkResult.checks_performed}</p>
                        <p className="text-sm text-muted-foreground">Controles Uitgevoerd</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">
                          {((checkResult.checks_performed - checkResult.results.filter(r => r.count > 0).length) / checkResult.checks_performed * 100).toFixed(0)}%
                        </p>
                        <p className="text-sm text-muted-foreground">Gezondheid</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Issues Detail */}
              {checkResult.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Gevonden Problemen</CardTitle>
                    <CardDescription>
                      Detailoverzicht van alle gedetecteerde integriteits problemen.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="overview">
                      <TabsList>
                        <TabsTrigger value="overview">Overzicht</TabsTrigger>
                        <TabsTrigger value="details">Details</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-4">
                          {checkResult.results.map((issue, index) => (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge 
                                  variant="secondary" 
                                  className={`${getSeverityColor(issue.count)} text-white`}
                                >
                                  {issue.count}
                                </Badge>
                                <div>
                                  <p className="font-medium">{getIssueTypeLabel(issue.issue_type)}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Tabel: {issue.table}
                                  </p>
                                </div>
                              </div>
                              {issue.count > 0 && (
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="details" className="space-y-4">
                        {checkResult.results.filter(issue => issue.count > 0).map((issue, index) => (
                          <Card key={index}>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                {getIssueTypeLabel(issue.issue_type)} - {issue.table}
                              </CardTitle>
                              <CardDescription>
                                {issue.count} probleem(en) gevonden
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ScrollArea className="h-48">
                                <div className="space-y-2">
                                  {issue.details.slice(0, 10).map((detail, detailIndex) => (
                                    <div key={detailIndex} className="p-2 bg-muted rounded text-sm">
                                      <pre className="whitespace-pre-wrap">
                                        {JSON.stringify(detail, null, 2)}
                                      </pre>
                                    </div>
                                  ))}
                                  {issue.details.length > 10 && (
                                    <p className="text-sm text-muted-foreground">
                                      ... en {issue.details.length - 10} meer
                                    </p>
                                  )}
                                </div>
                              </ScrollArea>
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {checkResult.total_issues === 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Uitstekend! Geen integriteits problemen gevonden. De database is in goede staat.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}