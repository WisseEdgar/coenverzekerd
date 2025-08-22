import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, Table, Search, RefreshCw, Eye, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
}

interface DatabaseTable {
  name: string;
  columns: Column[];
  primaryKeys: string[];
  foreignKeys: string[];
}

interface SchemaData {
  tables: DatabaseTable[];
  summary: {
    totalTables: number;
    totalColumns: number;
  };
}

export const DatabaseSchemaViewer: React.FC = () => {
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(null);

  const loadSchema = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('database-schema');
      
      if (error) {
        throw error;
      }
      
      setSchemaData(data);
    } catch (error) {
      console.error('Error loading schema:', error);
      toast.error('Fout bij laden van database schema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchema();
  }, []);

  const filteredTables = schemaData?.tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    table.columns.some(col => col.name.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const getColumnTypeColor = (type: string) => {
    if (type.includes('uuid')) return 'bg-purple-100 text-purple-800';
    if (type.includes('text') || type.includes('varchar')) return 'bg-blue-100 text-blue-800';
    if (type.includes('timestamp') || type.includes('date')) return 'bg-green-100 text-green-800';
    if (type.includes('integer') || type.includes('numeric')) return 'bg-orange-100 text-orange-800';
    if (type.includes('boolean')) return 'bg-red-100 text-red-800';
    if (type.includes('jsonb')) return 'bg-indigo-100 text-indigo-800';
    return 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Database schema laden...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Schema Overzicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek tabellen of kolommen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button onClick={loadSchema} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Vernieuwen
              </Button>
            </div>
            {schemaData && (
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Tabellen: {schemaData.summary.totalTables}</span>
                <span>Kolommen: {schemaData.summary.totalColumns}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Tabellen ({filteredTables.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredTables.map((table) => (
                  <div
                    key={table.name}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTable?.name === table.name
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedTable(table)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table className="h-4 w-4" />
                        <span className="font-medium">{table.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {table.columns.length} kolommen
                        </Badge>
                        {table.primaryKeys.length > 0 && (
                          <Key className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Table Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Tabel Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTable ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedTable.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTable.columns.length} kolommen
                  </p>
                </div>

                <Separator />

                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {selectedTable.columns.map((column) => (
                      <div key={column.name} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{column.name}</span>
                            {column.isPrimaryKey && (
                              <Key className="h-3 w-3 text-primary" />
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Badge className={getColumnTypeColor(column.type)}>
                              {column.type}
                            </Badge>
                            {!column.nullable && (
                              <Badge variant="outline" className="text-xs">
                                NOT NULL
                              </Badge>
                            )}
                          </div>
                        </div>
                        {column.default && (
                          <div className="text-xs text-muted-foreground">
                            Default: <code className="bg-background px-1 rounded">{column.default}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Selecteer een tabel om details te bekijken</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};