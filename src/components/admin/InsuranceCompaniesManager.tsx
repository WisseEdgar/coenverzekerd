import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Building } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface InsuranceCompany {
  id: string;
  name: string;
  description: string;
  created_at: string;
  document_count?: number;
}

const insuranceCompanySchema = z.object({
  name: z.string().min(1, 'Naam is verplicht').max(100, 'Naam mag maximaal 100 karakters zijn'),
  description: z.string().max(500, 'Beschrijving mag maximaal 500 karakters zijn').optional(),
});

type InsuranceCompanyForm = z.infer<typeof insuranceCompanySchema>;

export const InsuranceCompaniesManager = () => {
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsuranceCompanyForm>({
    resolver: zodResolver(insuranceCompanySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    loadInsuranceCompanies();
  }, []);

  const loadInsuranceCompanies = async () => {
    try {
      // Get insurance companies with document counts
      const { data: companies, error } = await supabase
        .from('insurance_companies')
        .select(`
          *,
          documents(count)
        `)
        .order('name');

      if (error) throw error;

      const companiesWithCounts = companies?.map(company => ({
        ...company,
        document_count: company.documents?.[0]?.count || 0
      })) || [];

      setInsuranceCompanies(companiesWithCounts);
    } catch (error) {
      console.error('Error loading insurance companies:', error);
      toast({
        title: 'Fout bij laden',
        description: 'Kon verzekeringsmaatschappijen niet laden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: InsuranceCompanyForm) => {
    try {
      if (editingCompany) {
        // Update existing company
        const { error } = await supabase
          .from('insurance_companies')
          .update({
            name: data.name,
            description: data.description || null,
          })
          .eq('id', editingCompany.id);

        if (error) throw error;

        toast({
          title: 'Bijgewerkt',
          description: 'Verzekeringsmaatschappij is bijgewerkt',
        });
      } else {
        // Create new company
        const { error } = await supabase
          .from('insurance_companies')
          .insert({
            name: data.name,
            description: data.description || null,
          });

        if (error) throw error;

        toast({
          title: 'Toegevoegd',
          description: 'Nieuwe verzekeringsmaatschappij is toegevoegd',
        });
      }

      setIsDialogOpen(false);
      setEditingCompany(null);
      form.reset();
      loadInsuranceCompanies();
    } catch (error: any) {
      console.error('Error saving insurance company:', error);
      toast({
        title: 'Fout bij opslaan',
        description: error.message?.includes('duplicate') ? 'Een maatschappij met deze naam bestaat al' : 'Kon verzekeringsmaatschappij niet opslaan',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (company: InsuranceCompany) => {
    setEditingCompany(company);
    form.reset({
      name: company.name,
      description: company.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (company: InsuranceCompany) => {
    try {
      const { error } = await supabase
        .from('insurance_companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: 'Verwijderd',
        description: 'Verzekeringsmaatschappij is verwijderd',
      });

      loadInsuranceCompanies();
    } catch (error: any) {
      console.error('Error deleting insurance company:', error);
      toast({
        title: 'Fout bij verwijderen',
        description: error.message?.includes('foreign key') ? 'Kan niet verwijderen: er zijn nog documenten gekoppeld aan deze maatschappij' : 'Kon verzekeringsmaatschappij niet verwijderen',
        variant: 'destructive',
      });
    }
  };

  const handleAddNew = () => {
    setEditingCompany(null);
    form.reset({
      name: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="p-6 text-center">Verzekeringsmaatschappijen laden...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Verzekeringsmaatschappijen ({insuranceCompanies.length})
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Maatschappij Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCompany ? 'Verzekeringsmaatschappij Bewerken' : 'Nieuwe Verzekeringsmaatschappij'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Naam *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Bijv. AEGON" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beschrijving</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Beschrijving van deze verzekeringsmaatschappij" rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuleren
                    </Button>
                    <Button type="submit">
                      {editingCompany ? 'Bijwerken' : 'Toevoegen'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {insuranceCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nog geen verzekeringsmaatschappijen aangemaakt</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Beschrijving</TableHead>
                <TableHead>Documenten</TableHead>
                <TableHead>Aangemaakt</TableHead>
                <TableHead className="w-[100px]">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insuranceCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {company.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {company.document_count} document{company.document_count !== 1 ? 'en' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(company.created_at).toLocaleDateString('nl-NL')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(company)}
                        title="Bewerken"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Verwijderen"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Verzekeringsmaatschappij verwijderen</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je "{company.name}" wilt verwijderen?
                              {company.document_count > 0 && (
                                <span className="block mt-2 text-orange-600 font-medium">
                                  Let op: Er zijn nog {company.document_count} document(en) gekoppeld aan deze maatschappij.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(company)}
                              className="bg-red-500 hover:bg-red-600"
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
        )}
      </CardContent>
    </Card>
  );
};