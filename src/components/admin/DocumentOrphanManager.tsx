import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Trash2, Search, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrphanResult {
  type: 'orphaned_files' | 'orphaned_records';
  table?: string;
  count: number;
  items: any[];
}

interface OrphanDetectionResult {
  action: string;
  timestamp: string;
  total_orphans: number;
  results: OrphanResult[];
}

export function DocumentOrphanManager() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [detectionResult, setDetectionResult] = useState<OrphanDetectionResult | null>(null);
  const [selectedOrphans, setSelectedOrphans] = useState<{[key: string]: string[]}>({});
  const { toast } = useToast();

  const detectOrphans = async () => {
    setIsDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('orphan-detection', {
        method: 'GET'
      });

      if (error) throw error;

      setDetectionResult(data);
      setSelectedOrphans({}); // Reset selections
      
      if (data.total_orphans === 0) {
        toast({
          title: "Detectie voltooid",
          description: "Geen verweesde records gevonden! Database is schoon.",
        });
      } else {
        toast({
          title: "Detectie voltooid",
          description: `${data.total_orphans} verweesde records gevonden.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Orphan detection failed:', error);
      toast({
        title: "Detectie mislukt",
        description: "Er is een fout opgetreden bij het detecteren van verweesde records.",
        variant: "destructive"
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const cleanupOrphans = async (tableName: string, orphanIds: string[]) => {
    if (orphanIds.length === 0) {
      toast({
        title: "Geen selectie",
        description: "Selecteer ten minste één record om op te ruimen.",
        variant: "destructive"
      });
      return;
    }

    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('orphan-detection', {
        method: 'POST',
        body: {
          table_name: tableName,
          orphan_ids: orphanIds
        }
      });

      if (error) throw error;

      toast({
        title: "Opruiming voltooid",
        description: `${data.deleted_count} verweesde records verwijderd uit ${tableName}.`,
      });

      // Refresh detection results
      await detectOrphans();
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast({
        title: "Opruiming mislukt",
        description: "Er is een fout opgetreden bij het opruimen van verweesde records.",
        variant: "destructive"
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const toggleOrphanSelection = (tableName: string, orphanId: string) => {
    setSelectedOrphans(prev => {
      const tableSelections = prev[tableName] || [];
      const isSelected = tableSelections.includes(orphanId);
      
      if (isSelected) {
        return {
          ...prev,
          [tableName]: tableSelections.filter(id => id !== orphanId)
        };
      } else {
        return {
          ...prev,
          [tableName]: [...tableSelections, orphanId]
        };
      }
    });
  };

  const selectAllOrphans = (tableName: string, orphanIds: string[]) => {
    setSelectedOrphans(prev => ({
      ...prev,
      [tableName]: orphanIds
    }));
  };

  const getTableDisplayName = (tableName: string) => {
    const names: Record<string, string> = {
      'chunks': 'Chunks',
      'chunk_embeddings': 'Chunk Embeddings',
      'sections': 'Secties',
      'answer_citations': 'Antwoord Citaties'
    };
    return names[tableName] || tableName;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Document Orphan Manager
          </CardTitle>
          <CardDescription>
            Detecteer en ruim verweesde records op die geen geldige parent referenties hebben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Button 
              onClick={detectOrphans} 
              disabled={isDetecting}
              className="flex items-center gap-2"
            >
              {isDetecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isDetecting ? 'Detecteren...' : 'Detecteer Verweesde Records'}
            </Button>
            
            {detectionResult && (
              <div className="text-sm text-muted-foreground">
                Laatste scan: {new Date(detectionResult.timestamp).toLocaleString('nl-NL')}
              </div>
            )}
          </div>

          {detectionResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      {detectionResult.total_orphans === 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-2xl font-bold">{detectionResult.total_orphans}</p>
                        <p className="text-sm text-muted-foreground">Verweesde Records</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{detectionResult.results.length}</p>
                        <p className="text-sm text-muted-foreground">Tabellen Gecontroleerd</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Orphan Details */}
              {detectionResult.results.filter(result => result.count > 0).length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Gevonden Verweesde Records</CardTitle>
                    <CardDescription>
                      Selecteer records om op te ruimen. Let op: dit is een onomkeerbare actie.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {detectionResult.results.filter(result => result.count > 0).map((result, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <Badge variant="destructive">
                                {result.count} verweesde records
                              </Badge>
                              <h3 className="font-medium">
                                {getTableDisplayName(result.table || '')}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => selectAllOrphans(
                                  result.table || '', 
                                  result.items.map(item => item.id)
                                )}
                              >
                                Selecteer Alle
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isCleaningUp || !selectedOrphans[result.table || '']?.length}
                                onClick={() => cleanupOrphans(
                                  result.table || '', 
                                  selectedOrphans[result.table || ''] || []
                                )}
                              >
                                {isCleaningUp ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Ruim Op ({selectedOrphans[result.table || '']?.length || 0})
                              </Button>
                            </div>
                          </div>
                          
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {result.items.map((item, itemIndex) => (
                                <div 
                                  key={itemIndex} 
                                  className={`p-3 border rounded cursor-pointer transition-colors ${
                                    selectedOrphans[result.table || '']?.includes(item.id)
                                      ? 'bg-destructive/10 border-destructive' 
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                  onClick={() => toggleOrphanSelection(result.table || '', item.id)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      <p><strong>ID:</strong> {item.id}</p>
                                      {item.document_id && (
                                        <p><strong>Document ID:</strong> {item.document_id}</p>
                                      )}
                                      {item.chunk_id && (
                                        <p><strong>Chunk ID:</strong> {item.chunk_id}</p>
                                      )}
                                      {item.text && (
                                        <p><strong>Text:</strong> {item.text.substring(0, 100)}...</p>
                                      )}
                                      <p><strong>Created:</strong> {new Date(item.created_at).toLocaleString('nl-NL')}</p>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {selectedOrphans[result.table || '']?.includes(item.id) ? 'Geselecteerd' : 'Klik om te selecteren'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Geen verweesde records gevonden! De database is schoon.
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