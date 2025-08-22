import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Database, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TableStat {
  table_name: string;
  row_count: number;
  error?: string;
}

interface StatisticsData {
  tables: TableStat[];
  summary: {
    totalTables: number;
    totalRows: number;
    largestTable: TableStat;
  };
}

export const TableStatistics: React.FC = () => {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('table-statistics');
      
      if (error) {
        throw error;
      }
      
      setStatistics(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
      toast.error('Fout bij laden van tabel statistieken');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Statistieken laden...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Geen statistieken beschikbaar</p>
            <Button onClick={loadStatistics} variant="outline" className="mt-2">
              Opnieuw proberen
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxRows = Math.max(...statistics.tables.map(t => t.row_count));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Totaal Tabellen</p>
                <p className="text-2xl font-bold">{statistics.summary.totalTables}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Totaal Records</p>
                <p className="text-2xl font-bold">{statistics.summary.totalRows.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Grootste Tabel</p>
                <p className="text-lg font-semibold">{statistics.summary.largestTable.table_name}</p>
                <p className="text-sm text-muted-foreground">
                  {statistics.summary.largestTable.row_count.toLocaleString()} records
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Tabel Statistieken
            </CardTitle>
            <Button onClick={loadStatistics} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Vernieuwen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statistics.tables.map((table) => (
              <div key={table.table_name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{table.table_name}</span>
                    {table.error && (
                      <Badge variant="destructive" className="text-xs">
                        Fout
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {table.row_count.toLocaleString()} records
                    </span>
                    {maxRows > 0 && (
                      <span className="text-xs text-muted-foreground min-w-12">
                        {((table.row_count / maxRows) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                
                {table.error ? (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    Fout: {table.error}
                  </div>
                ) : (
                  <Progress 
                    value={maxRows > 0 ? (table.row_count / maxRows) * 100 : 0} 
                    className="h-2"
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Data Distributie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Lege Tabellen</p>
                <p className="text-lg font-semibold">
                  {statistics.tables.filter(t => t.row_count === 0).length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Kleine (&lt;100)</p>
                <p className="text-lg font-semibold">
                  {statistics.tables.filter(t => t.row_count > 0 && t.row_count < 100).length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Middelgroot (100-1K)</p>
                <p className="text-lg font-semibold">
                  {statistics.tables.filter(t => t.row_count >= 100 && t.row_count < 1000).length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Groot (&gt;1K)</p>
                <p className="text-lg font-semibold">
                  {statistics.tables.filter(t => t.row_count >= 1000).length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};