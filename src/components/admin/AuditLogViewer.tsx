import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Shield, Filter, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    action: '',
    table: '',
    search: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        title: 'Fout bij laden',
        description: 'Kon audit logs niet laden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesAction = !filter.action || log.action.toLowerCase().includes(filter.action.toLowerCase());
    const matchesTable = !filter.table || log.table_name === filter.table;
    const matchesSearch = !filter.search || 
      log.action.toLowerCase().includes(filter.search.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(filter.search.toLowerCase()) ||
      log.user_id?.toLowerCase().includes(filter.search.toLowerCase());
    
    return matchesAction && matchesTable && matchesSearch;
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('CREATE')) return 'default';
    if (action.includes('UPDATE')) return 'secondary';
    if (action.includes('DELETE')) return 'destructive';
    return 'outline';
  };

  const formatJsonValue = (value: any) => {
    if (!value) return 'Geen data';
    return JSON.stringify(value, null, 2);
  };

  if (loading) {
    return <div className="p-6 text-center">Audit logs laden...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Admin Audit Log ({filteredLogs.length} entries)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Zoek in logs..."
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <Select value={filter.action} onValueChange={(value) => setFilter(prev => ({ ...prev, action: value === 'none' ? '' : value }))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter op actie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Alle acties</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.table || 'none'} onValueChange={(value) => setFilter(prev => ({ ...prev, table: value === 'none' ? '' : value }))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter op tabel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Alle tabellen</SelectItem>
              <SelectItem value="insurance_types">Insurance Types</SelectItem>
              <SelectItem value="insurance_companies">Insurance Companies</SelectItem>
              <SelectItem value="documents">Documents</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setFilter({ action: '', table: '', search: '' })}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Audit Logs Table */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Geen audit logs gevonden</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum/Tijd</TableHead>
                <TableHead>Gebruiker</TableHead>
                <TableHead>Actie</TableHead>
                <TableHead>Tabel</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(log.created_at).toLocaleDateString('nl-NL')}</div>
                      <div className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString('nl-NL')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      Admin gebruiker
                      {log.user_id && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {log.user_id.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {log.table_name || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.record_id ? (
                      <code className="text-xs bg-muted px-1 rounded">
                        {log.record_id.substring(0, 8)}...
                      </code>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {(log.old_values || log.new_values) ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1">
                            <Eye className="h-3 w-3" />
                            Bekijk
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                          <DialogHeader>
                            <DialogTitle>Audit Log Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong>Actie:</strong> {log.action}
                              </div>
                              <div>
                                <strong>Datum:</strong> {new Date(log.created_at).toLocaleString('nl-NL')}
                              </div>
                              <div>
                                <strong>Tabel:</strong> {log.table_name || 'N/A'}
                              </div>
                              <div>
                                <strong>Record ID:</strong> {log.record_id || 'N/A'}
                              </div>
                            </div>
                            
                            {log.old_values && (
                              <div>
                                <h4 className="font-medium mb-2">Oude Waarden:</h4>
                                <pre className="bg-muted p-4 rounded text-xs overflow-auto">
                                  {formatJsonValue(log.old_values)}
                                </pre>
                              </div>
                            )}
                            
                            {log.new_values && (
                              <div>
                                <h4 className="font-medium mb-2">Nieuwe Waarden:</h4>
                                <pre className="bg-muted p-4 rounded text-xs overflow-auto">
                                  {formatJsonValue(log.new_values)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};