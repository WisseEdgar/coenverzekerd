import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface CSVRow {
  document_code: string;
  stationaire_naam?: string;
  handelsnaam?: string;
  verzekeringsmaatschappij: string;
  verzekeringscategorie?: string;
  product_naam: string;
  document_type: string;
  versie_datum?: string;
  source_url?: string;
  download_priority?: number;
  notes?: string;
}

// Column mapping from Dutch CSV headers to database field names
const CSV_COLUMN_MAPPING: Record<string, string> = {
  'Statutaire Naam': 'stationaire_naam',
  'Handelsnaam': 'handelsnaam',
  'Verzekeringscategorie': 'verzekeringscategorie',
  'Type verzekering': 'product_naam',
  'Link Polisvoorwaarden': 'source_url',
  'Link algemene voorwaarden': 'source_url',
  'Link algemene voorwaarden overzicht': 'source_url',
  'Opmerkingen': 'notes',
  'Document-code': 'document_code',
  'Status': 'status'
};

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  batchId?: string;
  processedRows?: number;
  errors?: ValidationError[];
  validRowCount?: number;
  totalRowCount?: number;
  message?: string;
  error?: string;
}

export function MetadataImportManager() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [transformedData, setTransformedData] = useState<CSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Fetch import history
  const { data: importHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['metadata-import-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_metadata_import')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Ongeldig bestand",
        description: "Selecteer een CSV bestand",
        variant: "destructive"
      });
      return;
    }

    setCsvFile(file);
    parseCSV(file);
  }, [toast]);

  const parseCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length < 2) {
          throw new Error('CSV moet minstens een header en één data rij bevatten');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows: CSVRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const originalRow: any = {};
          
          headers.forEach((header, index) => {
            originalRow[header] = values[index] || '';
          });
          
          // Keep original data for preview
          rows.push(originalRow);
        }

        setCsvData(rows);
        
        // Transform data for backend
        const transformedRows = transformDataForBackend(rows);
        setTransformedData(transformedRows);
        
        toast({
          title: "CSV geparsed",
          description: `${rows.length} rijen gevonden`
        });
      } catch (error) {
        toast({
          title: "CSV parse fout",
          description: error instanceof Error ? error.message : "Onbekende fout",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  const handleImport = useCallback(async () => {
    if (!transformedData.length) {
      toast({
        title: "Geen data",
        description: "Upload eerst een CSV bestand",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setImportResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.functions.invoke('process-metadata-csv', {
        body: { csvData: transformedData }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setImportResult(data);
      
      if (data.success) {
        toast({
          title: "Import succesvol",
          description: data.message
        });
        refetchHistory();
      } else {
        toast({
          title: "Import fouten",
          description: `${data.errors?.length || 0} validatie fouten gevonden`,
          variant: "destructive"
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Onbekende fout'
      });
      toast({
        title: "Import fout",
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [transformedData, toast, refetchHistory]);

  const downloadTemplate = useCallback(() => {
    const template = `document_code,stationaire_naam,handelsnaam,verzekeringsmaatschappij,verzekeringscategorie,product_naam,document_type,versie_datum,source_url,download_priority,notes
231-PV-31-BRB-C-CBB,Voorbeeld Verzekeringen BV,Voorbeeld,Voorbeeld Verzekeringen,Rechtsbijstand,Zakelijke Rechtsbijstand,PV,2024-01-01,https://example.com/document.pdf,1,Voorbeeld notitie`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'metadata_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Transform data from original CSV format to backend format
  const transformDataForBackend = (originalData: any[]): CSVRow[] => {
    return originalData.map((originalRow) => {
      const transformedRow: any = {};
      
      // Map known columns
      Object.entries(CSV_COLUMN_MAPPING).forEach(([csvHeader, dbField]) => {
        if (originalRow[csvHeader] !== undefined) {
          transformedRow[dbField] = originalRow[csvHeader];
        }
      });
      
      // Set verzekeringsmaatschappij from stationaire_naam if not set
      if (!transformedRow.verzekeringsmaatschappij && transformedRow.stationaire_naam) {
        transformedRow.verzekeringsmaatschappij = transformedRow.stationaire_naam;
      }
      
      // Derive document_type from document_code or product_naam
      if (!transformedRow.document_type && transformedRow.document_code) {
        const codeparts = transformedRow.document_code.split('-');
        if (codeparts.length >= 4) {
          transformedRow.document_type = codeparts[3]; // e.g., "RBV" from "ACH-CEN-ANSPR-RBV-001"
        }
      }
      if (!transformedRow.document_type && transformedRow.product_naam) {
        // Fallback: use a simplified version of product name
        transformedRow.document_type = transformedRow.product_naam.substring(0, 10);
      }
      
      // Set default values for missing required fields
      if (!transformedRow.document_type) {
        transformedRow.document_type = 'Algemeen';
      }
      if (!transformedRow.verzekeringsmaatschappij) {
        transformedRow.verzekeringsmaatschappij = 'Onbekend';
      }
      
      return transformedRow;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Metadata Import Beheer</h2>
        <p className="text-muted-foreground">
          Import metadata voor verzekeringsdocumenten via CSV upload.
        </p>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">CSV Upload</TabsTrigger>
          <TabsTrigger value="preview">Data Preview</TabsTrigger>
          <TabsTrigger value="history">Import Historie</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                CSV Bestand Upload
              </CardTitle>
              <CardDescription>
                Upload een CSV bestand met metadata voor verzekeringsdocumenten. 
                <Button variant="link" onClick={downloadTemplate} className="p-0 h-auto">
                  Download template
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="csv-file">CSV Bestand</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
              </div>

              {csvFile && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Bestand geselecteerd: {csvFile.name} ({csvData.length} rijen)
                  </AlertDescription>
                </Alert>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!transformedData.length || isProcessing}
                className="w-full"
              >
                {isProcessing ? 'Importeren...' : 'Start Import'}
              </Button>

              {importResult && (
                <Alert variant={importResult.success ? "default" : "destructive"}>
                  {importResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {importResult.success 
                      ? importResult.message 
                      : importResult.error || 'Import gefaald'
                    }
                    {importResult.errors && (
                      <div className="mt-2">
                        <strong>Validatie fouten:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {importResult.errors.slice(0, 5).map((error, index) => (
                            <li key={index} className="text-sm">
                              Rij {error.row}, {error.field}: {error.message}
                            </li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li className="text-sm">
                              ... en nog {importResult.errors.length - 5} fouten
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Preview van de CSV data voordat je importeert
              </CardDescription>
            </CardHeader>
            <CardContent>
              {csvData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Code</TableHead>
                        <TableHead>Verzekeringsmaatschappij</TableHead>
                        <TableHead>Product Naam</TableHead>
                        <TableHead>Document Type</TableHead>
                        <TableHead>Versie Datum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{row.document_code}</TableCell>
                          <TableCell>{row.verzekeringsmaatschappij}</TableCell>
                          <TableCell>{row.product_naam}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.document_type}</Badge>
                          </TableCell>
                          <TableCell>{row.versie_datum}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {csvData.length > 10 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ... en nog {csvData.length - 10} rijen
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen data om te tonen. Upload eerst een CSV bestand.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Historie</CardTitle>
              <CardDescription>
                Overzicht van recent geïmporteerde metadata
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importHistory && importHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Code</TableHead>
                        <TableHead>Verzekeringsmaatschappij</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Datum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.document_code}</TableCell>
                          <TableCell>{item.verzekeringsmaatschappij}</TableCell>
                          <TableCell>{item.product_naam}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.document_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.import_batch_id?.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString('nl-NL')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nog geen imports gevonden.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}