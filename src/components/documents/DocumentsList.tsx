import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, Trash2, Building, FileType } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  filename: string;
  file_path: string;
  file_size: number;
  created_at: string;
  summary: string;
  insurance_types: { name: string } | null;
  insurance_companies: { name: string } | null;
}

export const DocumentsList = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          filename,
          file_path,
          file_size,
          created_at,
          summary,
          insurance_types(name),
          insurance_companies(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Fout bij laden documenten",
        description: "Kon documenten niet laden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download gestart",
        description: `${document.filename} wordt gedownload`,
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download mislukt",
        description: "Kon document niet downloaden",
        variant: "destructive",
      });
    }
  };

  const deleteDocument = async (document: Document) => {
    if (!confirm(`Weet je zeker dat je "${document.title}" wilt verwijderen?`)) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) {
        console.warn('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw dbError;
      }

      setDocuments(prev => prev.filter(doc => doc.id !== document.id));
      
      toast({
        title: "Document verwijderd",
        description: `${document.title} is verwijderd`,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Verwijderen mislukt",
        description: "Kon document niet verwijderen",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Documenten laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documenten Bibliotheek ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nog geen documenten geüpload</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((document) => (
              <div key={document.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold truncate">{document.title}</h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {document.insurance_companies?.name && (
                        <Badge variant="outline" className="gap-1">
                          <Building className="h-3 w-3" />
                          {document.insurance_companies.name}
                        </Badge>
                      )}
                      {document.insurance_types?.name && (
                        <Badge variant="outline" className="gap-1">
                          <FileType className="h-3 w-3" />
                          {document.insurance_types.name}
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {document.summary || 'Geen samenvatting beschikbaar'}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{document.filename}</span>
                      <span>{formatFileSize(document.file_size)}</span>
                      <span>{new Date(document.created_at).toLocaleDateString('nl-NL')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadDocument(document)}
                      title="Download document"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDocument(document)}
                      title="Verwijder document"
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};