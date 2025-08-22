import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Database, Clock, Loader2, RefreshCw, BarChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PerformanceMetric {
  metric_type: string;
  table_name?: string;
  value: number;
  unit: string;
  timestamp: string;
  details?: any;
}

interface PerformanceResult {
  timestamp: string;
  metrics_count: number;
  metrics: PerformanceMetric[];
  summary: {
    avg_query_time: number;
    total_storage_mb: number;
    recent_activity: number;
  };
}

export function DatabasePerformanceMonitor() {
  const [isLoading, setIsLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { toast } = useToast();

  const fetchPerformanceMetrics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('performance-metrics', {
        method: 'GET'
      });

      if (error) throw error;

      setPerformanceData(data);
      toast({
        title: "Performance gegevens geladen",
        description: `${data.metrics_count} metrics verzameld.`,
      });
    } catch (error) {
      console.error('Performance metrics failed:', error);
      toast({
        title: "Fout bij laden performance gegevens",
        description: "Er is een fout opgetreden bij het ophalen van de performance metrics.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(fetchPerformanceMetrics, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getMetricsByType = (type: string) => {
    return performanceData?.metrics.filter(m => m.metric_type === type) || [];
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'milliseconds') {
      return `${value.toFixed(2)} ms`;
    }
    if (unit === 'megabytes') {
      return `${value.toFixed(2)} MB`;
    }
    return `${value} ${unit}`;
  };

  const getPerformanceColor = (value: number, type: string) => {
    if (type === 'query_performance') {
      if (value < 100) return 'bg-green-500';
      if (value < 500) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    return 'bg-blue-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Database Performance Monitor
          </CardTitle>
          <CardDescription>
            Real-time performance metrics en resource monitoring voor de database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Button 
              onClick={fetchPerformanceMetrics} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isLoading ? 'Laden...' : 'Ververs Metrics'}
            </Button>
            
            <Button
              variant={autoRefresh ? "destructive" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              {autoRefresh ? 'Stop Auto-refresh' : 'Start Auto-refresh'}
            </Button>
            
            {performanceData && (
              <div className="text-sm text-muted-foreground">
                Laatste update: {new Date(performanceData.timestamp).toLocaleString('nl-NL')}
              </div>
            )}
          </div>

          {performanceData && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">
                          {performanceData.summary.avg_query_time.toFixed(2)}ms
                        </p>
                        <p className="text-sm text-muted-foreground">Gem. Query Tijd</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">
                          {performanceData.summary.total_storage_mb.toFixed(1)}MB
                        </p>
                        <p className="text-sm text-muted-foreground">Totaal Storage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <BarChart className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-2xl font-bold">
                          {performanceData.summary.recent_activity}
                        </p>
                        <p className="text-sm text-muted-foreground">Admin Acties (24u)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Gedetailleerde Metrics</CardTitle>
                  <CardDescription>
                    Performance gegevens per categorie en tabel.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="query-performance">
                    <TabsList>
                      <TabsTrigger value="query-performance">Query Performance</TabsTrigger>
                      <TabsTrigger value="storage">Storage Usage</TabsTrigger>
                      <TabsTrigger value="activity">System Activity</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="query-performance" className="space-y-4">
                      <div className="grid gap-4">
                        {getMetricsByType('query_performance').map((metric, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge 
                                className={`${getPerformanceColor(metric.value, metric.metric_type)} text-white`}
                              >
                                {formatValue(metric.value, metric.unit)}
                              </Badge>
                              <div>
                                <p className="font-medium">Tabel: {metric.table_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Rows: {metric.details?.row_count?.toLocaleString() || 'N/A'}
                                </p>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {metric.details?.operation}
                            </div>
                          </div>
                        ))}
                        
                        {getMetricsByType('embedding_search_performance').map((metric, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge 
                                className={`${getPerformanceColor(metric.value, 'query_performance')} text-white`}
                              >
                                {formatValue(metric.value, metric.unit)}
                              </Badge>
                              <div>
                                <p className="font-medium">Embedding Search</p>
                                <p className="text-sm text-muted-foreground">
                                  Resultaten: {metric.details?.results_count || 0}
                                </p>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Vector Similarity
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="storage" className="space-y-4">
                      {getMetricsByType('storage_usage').map((metric, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium">Storage Overzicht</h3>
                            <Badge variant="outline">
                              {formatValue(metric.value, metric.unit)}
                            </Badge>
                          </div>
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {metric.details?.tables?.map((table: any, tableIndex: number) => (
                                <div key={tableIndex} className="flex items-center justify-between p-3 bg-muted rounded">
                                  <div>
                                    <p className="font-medium">{table.table_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {table.row_count.toLocaleString()} rijen
                                    </p>
                                  </div>
                                  <Badge variant="secondary">
                                    {table.estimated_size_mb.toFixed(2)} MB
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="activity" className="space-y-4">
                      {getMetricsByType('admin_activity').map((metric, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium">Admin Activiteit</h3>
                            <Badge variant="outline">
                              {metric.value} operaties (24u)
                            </Badge>
                          </div>
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {metric.details?.recent_actions?.map((action: any, actionIndex: number) => (
                                <div key={actionIndex} className="flex items-center justify-between p-3 bg-muted rounded">
                                  <div>
                                    <p className="font-medium">{action.action}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {action.table || 'Systeem actie'}
                                    </p>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(action.timestamp).toLocaleString('nl-NL')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}