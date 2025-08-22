import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, Download, Upload, Search, Replace, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TABLE_OPTIONS = [
  { value: 'documents', label: 'Documents (Legacy)' },
  { value: 'documents_v2', label: 'Documents V2' },
  { value: 'chunks', label: 'Chunks' },
  { value: 'products', label: 'Products' },
  { value: 'insurers', label: 'Insurers' },
  { value: 'insurance_types', label: 'Insurance Types' },
  { value: 'insurance_companies', label: 'Insurance Companies' },
  { value: 'client_profiles', label: 'Client Profiles' }
];

export function BulkDataEditor() {
  const [activeTab, setActiveTab] = useState('export');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  // Export state
  const [exportTable, setExportTable] = useState('');
  const [exportFormat, setExportFormat] = useState('json');

  // Search & Replace state
  const [searchTable, setSearchTable] = useState('');
  const [searchField, setSearchField] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');

  const handleExport = async () => {
    if (!exportTable) {
      toast({
        title: "Fout",
        description: "Selecteer een tabel om te exporteren.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-data-operations', {
        body: {
          operation: 'export',
          table_name: exportTable,
          format: exportFormat
        }
      });

      if (error) throw error;

      setResult(data);

      // Create download link
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { 
        type: exportFormat === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportTable}_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export voltooid",
        description: `${data.row_count} records geëxporteerd uit ${exportTable}.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export mislukt",
        description: "Er is een fout opgetreden bij het exporteren van de data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchReplace = async () => {
    if (!searchTable || !searchField || !searchValue || replaceValue === '') {
      toast({
        title: "Fout",
        description: "Vul alle velden in voor zoek en vervang.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-data-operations', {
        body: {
          operation: 'search_replace',
          table_name: searchTable,
          search_field: searchField,
          search_value: searchValue,
          replace_value: replaceValue
        }
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Zoek en vervang voltooid",
        description: `${data.updates_made} records bijgewerkt in ${searchTable}.`,
      });
    } catch (error) {
      console.error('Search and replace failed:', error);
      toast({
        title: "Zoek en vervang mislukt",
        description: "Er is een fout opgetreden bij het zoeken en vervangen.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Bulk Data Editor
          </CardTitle>
          <CardDescription>
            Exporteer, importeer en bewerk data in bulk across meerdere tabellen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export">Export Data</TabsTrigger>
              <TabsTrigger value="search-replace">Zoek & Vervang</TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="export-table">Tabel selecteren</Label>
                  <Select value={exportTable} onValueChange={setExportTable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kies een tabel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TABLE_OPTIONS.map((table) => (
                        <SelectItem key={table.value} value={table.value}>
                          {table.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="export-format">Export formaat</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleExport} 
                disabled={isLoading || !exportTable}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Exporteren...' : 'Exporteer Data'}
              </Button>
            </TabsContent>

            <TabsContent value="search-replace" className="space-y-4">
              <Alert>
                <Search className="h-4 w-4" />
                <AlertDescription>
                  <strong>Waarschuwing:</strong> Zoek en vervang operaties zijn onomkeerbaar. 
                  Zorg ervoor dat je een backup hebt voordat je doorgaat.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search-table">Tabel selecteren</Label>
                  <Select value={searchTable} onValueChange={setSearchTable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kies een tabel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TABLE_OPTIONS.map((table) => (
                        <SelectItem key={table.value} value={table.value}>
                          {table.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-field">Veld naam</Label>
                  <Input
                    id="search-field"
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    placeholder="bijv. title, name, description..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search-value">Zoek waarde</Label>
                  <Input
                    id="search-value"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Tekst om te zoeken..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="replace-value">Vervang waarde</Label>
                  <Input
                    id="replace-value"
                    value={replaceValue}
                    onChange={(e) => setReplaceValue(e.target.value)}
                    placeholder="Vervang met..."
                  />
                </div>
              </div>

              <Button 
                onClick={handleSearchReplace} 
                disabled={isLoading || !searchTable || !searchField || !searchValue}
                className="w-full"
                variant="destructive"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Replace className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Bewerken...' : 'Zoek en Vervang'}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Results Display */}
          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Resultaat</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <pre className="text-sm bg-muted p-4 rounded">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}