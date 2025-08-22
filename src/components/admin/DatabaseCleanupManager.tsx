import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Database, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CleanupResult {
  table: string;
  status: 'success' | 'error';
  rows_deleted?: number;
  error?: string;
}

export const DatabaseCleanupManager: React.FC = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [lastCleanupResults, setLastCleanupResults] = useState<CleanupResult[]>([]);

  const documentTables = [
    { name: 'documents', description: 'Originele documenten (v1)' },
    { name: 'documents_v2', description: 'Nieuwe documenten (v2)' },
    { name: 'chunks', description: 'Document chunks voor AI' },
    { name: 'chunk_embeddings', description: 'AI embeddings' },
    { name: 'sections', description: 'Document secties' },
    { name: 'answers', description: 'AI antwoorden' },
    { name: 'queries', description: 'Gebruiker queries' },
    { name: 'answer_citations', description: 'Antwoord citaties' },
    { name: 'document_processing_logs', description: 'Verwerkings logs' },
    { name: 'conversations', description: 'Chat gesprekken' },
    { name: 'messages', description: 'Chat berichten' },
    { name: 'message_feedback', description: 'Bericht feedback' }
  ];

  const handleClearTable = async (tableName: string) => {
    if (!tableName) return;

    try {
      setIsClearing(true);
      
      const { data, error } = await supabase.functions.invoke('bulk-table-operations', {
        body: {
          operation: 'clear_table',
          table_name: tableName
        }
      });

      if (error) {
        throw error;
      }

      setLastCleanupResults([{
        table: tableName,
        status: 'success',
        rows_deleted: data.rows_deleted
      }]);

      toast.success(`Tabel ${tableName} succesvol geleegd (${data.rows_deleted} rijen verwijderd)`);

    } catch (error) {
      console.error('Error clearing table:', error);
      setLastCleanupResults([{
        table: tableName,
        status: 'error',
        error: error.message
      }]);
      toast.error(`Fout bij legen van tabel ${tableName}: ${error.message}`);
    } finally {
      setIsClearing(false);
      setSelectedTable('');
      setConfirmText('');
    }
  };

  const handleClearAllDocuments = async () => {
    try {
      setIsClearing(true);
      
      const { data, error } = await supabase.functions.invoke('bulk-table-operations', {
        body: {
          operation: 'clear_all_documents'
        }
      });

      if (error) {
        throw error;
      }

      setLastCleanupResults(data.results);
      
      const successCount = data.results.filter((r: CleanupResult) => r.status === 'success').length;
      const errorCount = data.results.filter((r: CleanupResult) => r.status === 'error').length;

      if (errorCount === 0) {
        toast.success(`Alle document-gerelateerde tabellen succesvol geleegd (${data.total_rows_deleted} rijen verwijderd)`);
      } else {
        toast.warning(`${successCount} tabellen geleegd, ${errorCount} fouten opgetreden`);
      }

    } catch (error) {
      console.error('Error clearing all documents:', error);
      toast.error(`Fout bij legen van alle tabellen: ${error.message}`);
    } finally {
      setIsClearing(false);
      setConfirmText('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-medium">
              Waarschuwing: Deze acties kunnen niet ongedaan worden gemaakt. 
              Zorg ervoor dat je een backup hebt voordat je doorgaat.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Table Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Individuele Tabel Opschoning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documentTables.map((table) => (
              <div key={table.name} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{table.name}</h4>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isClearing}
                        onClick={() => setSelectedTable(table.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Legen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tabel legen: {table.name}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Weet je zeker dat je alle data uit de tabel "{table.name}" wilt verwijderen?
                          Deze actie kan niet ongedaan worden gemaakt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-4">
                        <Label htmlFor="confirm-input">
                          Typ "{table.name}" om te bevestigen:
                        </Label>
                        <Input
                          id="confirm-input"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder={table.name}
                          className="mt-2"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                          setConfirmText('');
                          setSelectedTable('');
                        }}>
                          Annuleren
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleClearTable(table.name)}
                          disabled={confirmText !== table.name || isClearing}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {isClearing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Definitief legen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <p className="text-sm text-muted-foreground">{table.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Complete Database Reset */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Complete Database Reset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deze actie wist alle document-gerelateerde data uit de database. 
              Gebruik dit alleen voor een complete reset van het systeem.
            </p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isClearing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isClearing ? 'Bezig met legen...' : 'Alle Document Data Wissen'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Complete Database Reset</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze actie wist ALLE document-gerelateerde data uit de database:
                    <br />• Alle documenten (v1 en v2)
                    <br />• Alle AI chunks en embeddings  
                    <br />• Alle chat gesprekken en berichten
                    <br />• Alle queries en antwoorden
                    <br />• Alle verwerkingslogs
                    <br /><br />
                    Deze actie kan NIET ongedaan worden gemaakt!
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="confirm-reset">
                    Typ "WISSEN" om te bevestigen:
                  </Label>
                  <Input
                    id="confirm-reset"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="WISSEN"
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText('')}>
                    Annuleren
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllDocuments}
                    disabled={confirmText !== 'WISSEN' || isClearing}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isClearing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Definitief wissen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Last Cleanup Results */}
      {lastCleanupResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultaat van laatste opschoning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lastCleanupResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{result.table}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status === 'success' ? (
                      <Badge className="bg-green-100 text-green-800">
                        {result.rows_deleted} rijen verwijderd
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        Fout: {result.error}
                      </Badge>
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
};