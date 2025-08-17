import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search, RefreshCw, Trash2, ExternalLink, Calendar, Building, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Document {
  id: string;
  title: string;
  filename: string;
  file_path: string;
  processing_status: string;
  version_label?: string;
  version_date?: string;
  pages?: number;
  file_size?: number;
  created_at: string;
  products: {
    id: string;
    name: string;
    line_of_business: string;
    insurers: {
      id: string;
      name: string;
    };
  };
}

export function InsuranceDocumentsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lineOfBusinessFilter, setLineOfBusinessFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isReindexing, setIsReindexing] = useState<string | null>(null);

  // Fetch documents with related data
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['insurance-documents', searchTerm, statusFilter, lineOfBusinessFilter],
    queryFn: async () => {
      let query = supabase
        .from('documents_v2')
        .select(`
          *,
          products!inner (
            id,
            name,
            line_of_business,
            insurers (
              id,
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,filename.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('processing_status', statusFilter);
      }

      if (lineOfBusinessFilter !== 'all') {
        query = query.eq('products.line_of_business', lineOfBusinessFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Document[];
    }
  });

  // Get unique lines of business for filter
  const linesOfBusiness = React.useMemo(() => {
    if (!documents) return [];
    const lines = [...new Set(documents.map(doc => doc.products.line_of_business))];
    return lines.sort();
  }, [documents]);

  const handleReindex = async (document: Document) => {
    setIsReindexing(document.id);
    try {
      const { error } = await supabase.functions.invoke('reindex-product', {
        body: { product_id: document.products.id }
      });

      if (error) throw error;

      toast({
        title: "Herindexering gestart",
        description: `Product "${document.products.name}" wordt opnieuw geïndexeerd.`
      });

      refetch();
    } catch (error: any) {
      console.error('Reindex error:', error);
      toast({
        title: "Herindexering mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    } finally {
      setIsReindexing(null);
    }
  };

  const handleDelete = async (document: Document, deleteFile: boolean = false) => {
    try {
      const { error } = await supabase.functions.invoke('delete-document', {
        body: { 
          document_id: document.id,
          delete_file: deleteFile
        }
      });

      if (error) throw error;

      toast({
        title: "Document verwijderd",
        description: `"${document.title}" is succesvol verwijderd.`
      });

      queryClient.invalidateQueries({ queryKey: ['insurance-documents'] });
      setSelectedDocument(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Verwijdering mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; text: string }> = {
      'pending': { variant: 'secondary', text: 'Wachtend' },
      'processing': { variant: 'default', text: 'Verwerken' },
      'completed': { variant: 'success', text: 'Voltooid' },
      'partial': { variant: 'warning', text: 'Gedeeltelijk' },
      'failed': { variant: 'destructive', text: 'Mislukt' }
    };
    
    const config = variants[status] || { variant: 'secondary', text: status };
    return <Badge className={config.variant}>{config.text}</Badge>;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Onbekend';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Documenten laden...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Documentenbibliotheek</CardTitle>
          <CardDescription>
            Overzicht van alle geüploade verzekeringsdocumenten en hun verwerkingsstatus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op titel of bestandsnaam..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="pending">Wachtend</SelectItem>
                <SelectItem value="processing">Verwerken</SelectItem>
                <SelectItem value="completed">Voltooid</SelectItem>
                <SelectItem value="partial">Gedeeltelijk</SelectItem>
                <SelectItem value="failed">Mislukt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lineOfBusinessFilter} onValueChange={setLineOfBusinessFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Verzekeringssoort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle soorten</SelectItem>
                {linesOfBusiness.map((line) => (
                  <SelectItem key={line} value={line}>{line}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Vernieuwen
            </Button>
          </div>

          {/* Documents Table */}
          {documents && documents.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Verzekeraar</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Versie</TableHead>
                    <TableHead>Geüpload</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-start space-x-3">
                          <FileText className="h-5 w-5 mt-0.5 text-primary" />
                          <div>
                            <p className="font-medium">{document.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {document.filename}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                              {document.pages && (
                                <span>{document.pages} pagina's</span>
                              )}
                              <span>{formatFileSize(document.file_size)}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{document.products.insurers.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{document.products.name}</p>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Package className="h-3 w-3" />
                            <span>{document.products.line_of_business}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(document.processing_status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {document.version_label && (
                            <p className="font-medium">{document.version_label}</p>
                          )}
                          {document.version_date && (
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(document.version_date), 'dd-MM-yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(document.created_at), 'dd-MM-yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReindex(document)}
                            disabled={isReindexing === document.id}
                          >
                            {isReindexing === document.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDocument(document)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Document verwijderen</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Weet je zeker dat je "{selectedDocument?.title}" wilt verwijderen? 
                                  Dit zal ook alle gerelateerde chunks en embeddings verwijderen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => selectedDocument && handleDelete(selectedDocument, false)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Alleen database
                                </AlertDialogAction>
                                <AlertDialogAction
                                  onClick={() => selectedDocument && handleDelete(selectedDocument, true)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Inclusief bestand
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || lineOfBusinessFilter !== 'all'
                  ? 'Geen documenten gevonden die voldoen aan de filters.'
                  : 'Nog geen documenten geüpload. Upload je eerste document om te beginnen.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}