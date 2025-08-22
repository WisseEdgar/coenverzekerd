import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, Loader2, Search, RefreshCw, Trash2, Filter, FolderTree, Star, Link } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnhancedDocument {
  id: string;
  title: string;
  filename: string;
  processing_status: string;
  file_size?: number;
  pages?: number;
  version_date?: string;
  version_label?: string;
  created_at: string;
  updated_at: string;
  document_code?: string;
  base_insurance_code?: string;
  document_type?: string;
  variant_code?: string;
  subcategory?: string;
  source_url?: string;
  download_priority?: number;
  is_primary_document?: boolean;
  products: {
    name: string;
    line_of_business: string;
    insurers: {
      name: string;
    };
  };
}

interface DocumentFamily {
  base_insurance_code: string;
  insurer_name: string;
  product_name: string;
  line_of_business: string;
  documents: EnhancedDocument[];
  primary_document?: EnhancedDocument;
}

export function InsuranceDocumentsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lineOfBusinessFilter, setLineOfBusinessFilter] = useState<string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'families'>('families');
  const [selectedDocument, setSelectedDocument] = useState<EnhancedDocument | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const { toast } = useToast();

  // Fetch enhanced documents with metadata
  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['enhanced-insurance-documents', searchTerm, statusFilter, lineOfBusinessFilter, documentTypeFilter],
    queryFn: async () => {
      let query = supabase
        .from('documents_v2')
        .select(`
          *,
          products (
            name,
            line_of_business,
            insurers (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,filename.ilike.%${searchTerm}%,document_code.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('processing_status', statusFilter);
      }

      if (lineOfBusinessFilter !== 'all') {
        query = query.eq('products.line_of_business', lineOfBusinessFilter);
      }

      if (documentTypeFilter !== 'all') {
        query = query.eq('document_type', documentTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EnhancedDocument[];
    },
  });

  // Group documents by family (base_insurance_code)
  const documentFamilies: DocumentFamily[] = useMemo(() => {
    if (!documents) return [];

    const familyMap = new Map<string, DocumentFamily>();

    documents.forEach(doc => {
      const baseCode = doc.base_insurance_code || 'unknown';
      const key = `${baseCode}-${doc.products.insurers.name}-${doc.products.name}`;
      
      if (!familyMap.has(key)) {
        familyMap.set(key, {
          base_insurance_code: baseCode,
          insurer_name: doc.products.insurers.name,
          product_name: doc.products.name,
          line_of_business: doc.products.line_of_business,
          documents: [],
        });
      }

      const family = familyMap.get(key)!;
      family.documents.push(doc);
      
      if (doc.is_primary_document) {
        family.primary_document = doc;
      }
    });

    // Sort documents within each family
    familyMap.forEach(family => {
      family.documents.sort((a, b) => {
        // Primary documents first
        if (a.is_primary_document !== b.is_primary_document) {
          return b.is_primary_document ? 1 : -1;
        }
        // Then by document type priority (PV > BV > RV > AV)
        const typeOrder = { PV: 1, BV: 2, RV: 3, AV: 4 };
        const aOrder = typeOrder[a.document_type as keyof typeof typeOrder] || 999;
        const bOrder = typeOrder[b.document_type as keyof typeof typeOrder] || 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Finally by version date
        return new Date(b.version_date || b.created_at).getTime() - new Date(a.version_date || a.created_at).getTime();
      });
    });

    return Array.from(familyMap.values()).sort((a, b) => {
      // Sort families by insurer, then product name
      if (a.insurer_name !== b.insurer_name) {
        return a.insurer_name.localeCompare(b.insurer_name);
      }
      return a.product_name.localeCompare(b.product_name);
    });
  }, [documents]);

  // Get unique filter options
  const linesOfBusiness = useMemo(() => {
    if (!documents) return [];
    return [...new Set(documents.map(doc => doc.products.line_of_business))].sort();
  }, [documents]);

  const documentTypes = useMemo(() => {
    if (!documents) return [];
    return [...new Set(documents.map(doc => doc.document_type).filter(Boolean))].sort();
  }, [documents]);

  const handleReindex = async (document: EnhancedDocument) => {
    setIsReindexing(true);
    try {
      const { error } = await supabase.functions.invoke('reindex-product', {
        body: { productId: document.products.name }
      });

      if (error) throw error;

      toast({
        title: "Herindexeren gestart",
        description: `Product ${document.products.name} wordt opnieuw geïndexeerd`,
      });

      refetch();
    } catch (error) {
      console.error('Reindex error:', error);
      toast({
        title: "Fout bij herindexeren",
        description: "Er is een fout opgetreden bij het herindexeren",
        variant: "destructive",
      });
    } finally {
      setIsReindexing(false);
    }
  };

  const handleDelete = async (document: EnhancedDocument, deleteFile: boolean = false) => {
    try {
      const { error } = await supabase.functions.invoke('delete-document', {
        body: { 
          documentId: document.id,
          deleteFile
        }
      });

      if (error) throw error;

      toast({
        title: "Document verwijderd",
        description: `${document.title} is succesvol verwijderd`,
      });

      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Fout bij verwijderen",
        description: "Er is een fout opgetreden bij het verwijderen",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'completed': { label: 'Voltooid', variant: 'default' as const },
      'processing': { label: 'Verwerken', variant: 'secondary' as const },
      'failed': { label: 'Gefaald', variant: 'destructive' as const },
      'pending': { label: 'Wachtend', variant: 'outline' as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Documenten laden...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Verzekeringsdocumenten Bibliotheek
          </CardTitle>
          <CardDescription>
            Beheer en bekijk alle geüploade verzekeringsdocumenten met metadata structuur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Zoeken</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Zoek documenten..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="completed">Voltooid</SelectItem>
                  <SelectItem value="processing">Verwerken</SelectItem>
                  <SelectItem value="failed">Gefaald</SelectItem>
                  <SelectItem value="pending">Wachtend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="lob-filter">Branche</Label>
              <Select value={lineOfBusinessFilter} onValueChange={setLineOfBusinessFilter}>
                <SelectTrigger id="lob-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle branches</SelectItem>
                  {linesOfBusiness.map((lob) => (
                    <SelectItem key={lob} value={lob}>{lob}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type-filter">Document Type</Label>
              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger id="type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle types</SelectItem>
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'table' | 'families')}>
            <TabsList>
              <TabsTrigger value="families" className="flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Document Families
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Tabel Weergave
              </TabsTrigger>
            </TabsList>

            <TabsContent value="families" className="space-y-4">
              {documentFamilies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen document families gevonden.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documentFamilies.map((family) => (
                    <Card key={`${family.base_insurance_code}-${family.insurer_name}-${family.product_name}`} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {family.primary_document && <Star className="h-4 w-4 text-yellow-500" />}
                              {family.insurer_name} - {family.product_name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-4">
                              <span>{family.line_of_business}</span>
                              {family.base_insurance_code !== 'unknown' && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {family.base_insurance_code}
                                </Badge>
                              )}
                              <span className="text-sm">{family.documents.length} documenten</span>
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2">
                          {family.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                doc.is_primary_document 
                                  ? 'bg-primary/5 border-primary/20' 
                                  : 'bg-background'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {doc.is_primary_document && <Star className="h-4 w-4 text-yellow-500" />}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{doc.title}</span>
                                    {doc.document_type && (
                                      <Badge variant="secondary" className="text-xs">
                                        {doc.document_type}
                                      </Badge>
                                    )}
                                    {doc.source_url && (
                                      <Link className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {doc.filename} • {formatFileSize(doc.file_size)} • {doc.pages} pagina's
                                    {doc.version_date && ` • Versie: ${new Date(doc.version_date).toLocaleDateString('nl-NL')}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(doc.processing_status)}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReindex(doc)}
                                  disabled={isReindexing}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Document verwijderen</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Weet je zeker dat je "{doc.title}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(doc, true)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Verwijderen
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="table">
              {!documents || documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen documenten gevonden die voldoen aan de criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Verzekeraar</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Versie</TableHead>
                        <TableHead>Upload Datum</TableHead>
                        <TableHead>Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {document.is_primary_document && <Star className="h-4 w-4 text-yellow-500" />}
                              <div>
                                <div className="font-medium">{document.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  {document.filename}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{document.products.insurers.name}</TableCell>
                          <TableCell>{document.products.name}</TableCell>
                          <TableCell>
                            {document.document_type ? (
                              <Badge variant="outline">{document.document_type}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(document.processing_status)}</TableCell>
                          <TableCell>
                            {document.document_code ? (
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {document.document_code}
                              </code>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {document.version_label || 
                             (document.version_date && new Date(document.version_date).toLocaleDateString('nl-NL')) || 
                             '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(document.created_at).toLocaleDateString('nl-NL')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReindex(document)}
                                disabled={isReindexing}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Document verwijderen</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Weet je zeker dat je "{document.title}" wilt verwijderen?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(document, true)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Verwijderen
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
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}