import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, Building, Filter, RotateCcw } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  filename: string;
  created_at: string;
  insurance_type_id: string | null;
  insurance_company_id: string | null;
  insurance_types: { id: string; name: string } | null;
  insurance_companies: { id: string; name: string } | null;
}

interface InsuranceType {
  id: string;
  name: string;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

export const DocumentReassignmentManager = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: '',
    company: '',
    search: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [documentsResult, typesResult, companiesResult] = await Promise.all([
        supabase
          .from('documents')
          .select(`
            id,
            title,
            filename,
            created_at,
            insurance_type_id,
            insurance_company_id,
            insurance_types(id, name),
            insurance_companies(id, name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('insurance_types')
          .select('id, name')
          .order('name'),
        supabase
          .from('insurance_companies')
          .select('id, name')
          .order('name')
      ]);

      if (documentsResult.error) throw documentsResult.error;
      if (typesResult.error) throw typesResult.error;
      if (companiesResult.error) throw companiesResult.error;

      setDocuments(documentsResult.data || []);
      setInsuranceTypes(typesResult.data || []);
      setInsuranceCompanies(companiesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fout bij laden',
        description: 'Kon gegevens niet laden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesType = !filter.type || doc.insurance_type_id === filter.type;
    const matchesCompany = !filter.company || doc.insurance_company_id === filter.company;
    const matchesSearch = !filter.search || 
      doc.title.toLowerCase().includes(filter.search.toLowerCase()) ||
      doc.filename.toLowerCase().includes(filter.search.toLowerCase());
    
    return matchesType && matchesCompany && matchesSearch;
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

  const handleBulkReassign = async (newTypeId: string | null, newCompanyId: string | null) => {
    if (selectedDocuments.size === 0) {
      toast({
        title: 'Geen documenten geselecteerd',
        description: 'Selecteer eerst documenten om opnieuw toe te wijzen',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          insurance_type_id: newTypeId,
          insurance_company_id: newCompanyId,
        })
        .in('id', Array.from(selectedDocuments));

      if (error) throw error;

      toast({
        title: 'Documenten bijgewerkt',
        description: `${selectedDocuments.size} document(en) zijn opnieuw toegewezen`,
      });

      setSelectedDocuments(new Set());
      loadData();
    } catch (error) {
      console.error('Error reassigning documents:', error);
      toast({
        title: 'Fout bij toewijzen',
        description: 'Kon documenten niet opnieuw toewijzen',
        variant: 'destructive',
      });
    }
  };

  const handleSingleReassign = async (documentId: string, typeId: string | null, companyId: string | null) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          insurance_type_id: typeId,
          insurance_company_id: companyId,
        })
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: 'Document bijgewerkt',
        description: 'Document is opnieuw toegewezen',
      });

      loadData();
    } catch (error) {
      console.error('Error reassigning document:', error);
      toast({
        title: 'Fout bij toewijzen',
        description: 'Kon document niet opnieuw toewijzen',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Documenten laden...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Document Herindeling ({filteredDocuments.length} documenten)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Zoek documenten..."
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <Select value={filter.type || 'none'} onValueChange={(value) => setFilter(prev => ({ ...prev, type: value === 'none' ? '' : value }))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter op type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Alle types</SelectItem>
                {insuranceTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter.company || 'none'} onValueChange={(value) => setFilter(prev => ({ ...prev, company: value === 'none' ? '' : value }))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter op maatschappij" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Alle maatschappijen</SelectItem>
                {insuranceCompanies.map(company => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setFilter({ type: '', company: '', search: '' })}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedDocuments.size > 0 && (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-medium">
                    {selectedDocuments.size} document(en) geselecteerd
                  </span>
                  <div className="flex gap-2">
                    <Select onValueChange={(value) => {
                      const [typeId, companyId] = value.split('|');
                      handleBulkReassign(
                        typeId === 'none' ? null : typeId, 
                        companyId === 'none' ? null : companyId
                      );
                    }}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Kies nieuwe categorisering" />
                      </SelectTrigger>
                      <SelectContent>
                        {insuranceTypes.map(type => 
                          insuranceCompanies.map(company => (
                            <SelectItem key={`${type.id}|${company.id}`} value={`${type.id}|${company.id}`}>
                              {type.name} - {company.name}
                            </SelectItem>
                          ))
                        )}
                        <SelectItem value="none|none">Geen categorisering</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedDocuments(new Set())}
                    >
                      Selectie wissen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Table */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Geen documenten gevonden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedDocuments.size === filteredDocuments.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Huidig Type</TableHead>
                  <TableHead>Huidige Maatschappij</TableHead>
                  <TableHead>Nieuw Type</TableHead>
                  <TableHead>Nieuwe Maatschappij</TableHead>
                  <TableHead>Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDocuments.has(document.id)}
                        onCheckedChange={(checked) => handleSelectDocument(document.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{document.title}</div>
                        <div className="text-sm text-muted-foreground">{document.filename}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {document.insurance_types ? (
                        <Badge variant="outline">{document.insurance_types.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {document.insurance_companies ? (
                        <Badge variant="outline">{document.insurance_companies.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={document.insurance_type_id || 'none'}
                        onValueChange={(value) => {
                          handleSingleReassign(
                            document.id,
                            value === 'none' ? null : value,
                            document.insurance_company_id
                          );
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Geen type</SelectItem>
                          {insuranceTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={document.insurance_company_id || 'none'}
                        onValueChange={(value) => {
                          handleSingleReassign(
                            document.id,
                            document.insurance_type_id,
                            value === 'none' ? null : value
                          );
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecteer maatschappij" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Geen maatschappij</SelectItem>
                          {insuranceCompanies.map(company => (
                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(document.created_at).toLocaleDateString('nl-NL')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};