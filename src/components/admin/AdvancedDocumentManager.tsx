import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, Search, RefreshCw, Trash2, Edit, Eye, Download, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Document {
  id: string;
  title: string;
  filename: string;
  created_at: string;
  processing_status?: string;
  file_size?: number;
  pages?: number;
  insurer_name?: string;
  product_name?: string;
  line_of_business?: string;
}

export const AdvancedDocumentManager: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      // Load documents from both tables
      const [v1Response, v2Response] = await Promise.all([
        supabase
          .from('documents')
          .select(`
            id,
            title,
            filename,
            created_at,
            file_size,
            insurance_types(name),
            insurance_companies(name)
          `)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('documents_v2')
          .select(`
            id,
            title,
            filename,
            created_at,
            processing_status,
            file_size,
            pages,
            products(
              name,
              line_of_business,
              insurers(name)
            )
          `)
          .order('created_at', { ascending: false })
      ]);

      if (v1Response.error) throw v1Response.error;
      if (v2Response.error) throw v2Response.error;

      // Transform and combine the data
      const v1Docs = (v1Response.data || []).map(doc => ({
        id: doc.id,
        title: doc.title,
        filename: doc.filename,
        created_at: doc.created_at,
        file_size: doc.file_size,
        insurer_name: (doc.insurance_companies as any)?.name,
        product_name: (doc.insurance_types as any)?.name,
        source: 'v1' as const
      }));

      const v2Docs = (v2Response.data || []).map(doc => ({
        id: doc.id,
        title: doc.title,
        filename: doc.filename,
        created_at: doc.created_at,
        processing_status: doc.processing_status,
        file_size: doc.file_size,
        pages: doc.pages,
        insurer_name: (doc.products as any)?.insurers?.name,
        product_name: (doc.products as any)?.name,
        line_of_business: (doc.products as any)?.line_of_business,
        source: 'v2' as const
      }));

      setDocuments([...v1Docs, ...v2Docs]);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Fout bij laden van documenten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.insurer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.product_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || 
      doc.processing_status === statusFilter ||
      (statusFilter === 'v1' && (doc as any).source === 'v1') ||
      (statusFilter === 'v2' && (doc as any).source === 'v2');

    return matchesSearch && matchesStatus;
  });

  const handleSelectDocument = (documentId: string, checked: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (checked) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
    } else {
      setSelectedDocuments(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDocuments.size === 0) return;

    try {
      setIsDeleting(true);

      // Group documents by source table
      const v1Docs = Array.from(selectedDocuments).filter(id => 
        documents.find(doc => doc.id === id && (doc as any).source === 'v1')
      );
      const v2Docs = Array.from(selectedDocuments).filter(id =>
        documents.find(doc => doc.id === id && (doc as any).source === 'v2')
      );

      // Delete from both tables
      const deletePromises = [];

      if (v1Docs.length > 0) {
        deletePromises.push(
          supabase.from('documents').delete().in('id', v1Docs)
        );
      }

      if (v2Docs.length > 0) {
        deletePromises.push(
          supabase.from('documents_v2').delete().in('id', v2Docs)
        );
      }

      const results = await Promise.all(deletePromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Deletion errors: ${errors.map(e => e.error?.message).join(', ')}`);
      }

      toast.success(`${selectedDocuments.size} documenten succesvol verwijderd`);
      setSelectedDocuments(new Set());
      await loadDocuments();

    } catch (error) {
      console.error('Error deleting documents:', error);
      toast.error('Fout bij verwijderen van documenten');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Onbekend';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Documenten laden...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Geavanceerd Document Beheer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek documenten..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle documenten</SelectItem>
                <SelectItem value="v1">Documenten (v1)</SelectItem>
                <SelectItem value="v2">Documenten (v2)</SelectItem>
                <SelectItem value="pending">Wachtend</SelectItem>
                <SelectItem value="processing">Verwerking</SelectItem>
                <SelectItem value="completed">Voltooid</SelectItem>
                <SelectItem value="failed">Mislukt</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadDocuments} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Vernieuwen
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedDocuments.size > 0 && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedDocuments.size} document(en) geselecteerd
              </span>
              <Separator orientation="vertical" className="h-4" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isDeleting ? 'Verwijderen...' : 'Verwijderen'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Documenten verwijderen</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je {selectedDocuments.size} document(en) wilt verwijderen? 
                      Deze actie kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}>
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedDocuments(new Set())}
              >
                Deselecteren
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(selectedDocuments.size !== filteredDocuments.length)}
                className="flex items-center gap-2 text-sm"
              >
                {selectedDocuments.size === filteredDocuments.length ? 
                  <CheckSquare className="h-4 w-4" /> : 
                  <Square className="h-4 w-4" />
                }
                Alles selecteren
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredDocuments.length} van {documents.length} documenten
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {filteredDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/30"
                >
                  <Checkbox
                    checked={selectedDocuments.has(document.id)}
                    onCheckedChange={(checked) => 
                      handleSelectDocument(document.id, checked as boolean)
                    }
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{document.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {(document as any).source}
                      </Badge>
                      {document.processing_status && (
                        <Badge className={getStatusColor(document.processing_status)}>
                          {document.processing_status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {document.filename}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{new Date(document.created_at).toLocaleDateString()}</span>
                      <span>{formatFileSize(document.file_size)}</span>
                      {document.pages && <span>{document.pages} pagina's</span>}
                      {document.insurer_name && <span>{document.insurer_name}</span>}
                      {document.product_name && <span>{document.product_name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};