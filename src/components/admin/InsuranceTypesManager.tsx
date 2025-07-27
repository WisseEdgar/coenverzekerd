import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface InsuranceType {
  id: string;
  name: string;
  description: string;
  created_at: string;
  document_count?: number;
}

const insuranceTypeSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht').max(100, 'Naam mag maximaal 100 karakters zijn'),
  description: z.string().max(500, 'Beschrijving mag maximaal 500 karakters zijn').optional(),
});

type InsuranceTypeForm = z.infer<typeof insuranceTypeSchema>;

export const InsuranceTypesManager = () => {
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<InsuranceType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { logAdminAction } = useAdmin();

  const form = useForm<InsuranceTypeForm>({
    resolver: zodResolver(insuranceTypeSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    loadInsuranceTypes();
  }, []);

  const loadInsuranceTypes = async () => {
    try {
      // Get insurance types with document counts
      const { data: types, error } = await supabase
        .from('insurance_types')
        .select(`
          *,
          documents(count)
        `)
        .order('name');

      if (error) throw error;

      const typesWithCounts = types?.map(type => ({
        ...type,
        document_count: type.documents?.[0]?.count || 0
      })) || [];

      setInsuranceTypes(typesWithCounts);
    } catch (error) {
      console.error('Error loading insurance types:', error);
      toast({
        title: 'Fout bij laden',
        description: 'Kon verzekeringtypes niet laden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: InsuranceTypeForm) => {
    try {
      if (editingType) {
        // Update existing type
        const oldValues = { name: editingType.name, description: editingType.description };
        const { error } = await supabase
          .from('insurance_types')
          .update({
            name: data.name,
            description: data.description || null,
          })
          .eq('id', editingType.id);

        if (error) throw error;

        // Log admin action
        await logAdminAction(
          'UPDATE insurance_type',
          'insurance_types',
          editingType.id,
          oldValues,
          { name: data.name, description: data.description }
        );

        toast({
          title: 'Bijgewerkt',
          description: 'Verzekeringstype is bijgewerkt',
        });
      } else {
        // Create new type
        const { data: newType, error } = await supabase
          .from('insurance_types')
          .insert({
            name: data.name,
            description: data.description || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Log admin action
        await logAdminAction(
          'CREATE insurance_type',
          'insurance_types',
          newType?.id,
          null,
          { name: data.name, description: data.description }
        );

        toast({
          title: 'Toegevoegd',
          description: 'Nieuw verzekeringstype is toegevoegd',
        });
      }

      setIsDialogOpen(false);
      setEditingType(null);
      form.reset();
      loadInsuranceTypes();
    } catch (error: any) {
      console.error('Error saving insurance type:', error);
      toast({
        title: 'Fout bij opslaan',
        description: error.message?.includes('duplicate') ? 'Een type met deze naam bestaat al' : 'Kon verzekeringstype niet opslaan',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (type: InsuranceType) => {
    setEditingType(type);
    form.reset({
      name: type.name,
      description: type.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (type: InsuranceType) => {
    try {
      const { error } = await supabase
        .from('insurance_types')
        .delete()
        .eq('id', type.id);

      if (error) throw error;

      // Log admin action
      await logAdminAction(
        'DELETE insurance_type',
        'insurance_types',
        type.id,
        { name: type.name, description: type.description },
        null
      );

      toast({
        title: 'Verwijderd',
        description: 'Verzekeringstype is verwijderd',
      });

      loadInsuranceTypes();
    } catch (error: any) {
      console.error('Error deleting insurance type:', error);
      toast({
        title: 'Fout bij verwijderen',
        description: error.message?.includes('foreign key') ? 'Kan niet verwijderen: er zijn nog documenten gekoppeld aan dit type' : 'Kon verzekeringstype niet verwijderen',
        variant: 'destructive',
      });
    }
  };

  const handleAddNew = () => {
    setEditingType(null);
    form.reset({
      name: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="p-6 text-center">Verzekeringtypes laden...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Verzekeringtypes ({insuranceTypes.length})
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Type Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingType ? 'Verzekeringstype Bewerken' : 'Nieuw Verzekeringstype'}
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
                          <Input {...field} placeholder="Bijv. Autoverzekering" />
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
                          <Textarea {...field} placeholder="Beschrijving van dit verzekeringstype" rows={3} />
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
                      {editingType ? 'Bijwerken' : 'Toevoegen'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {insuranceTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nog geen verzekeringtypes aangemaakt</p>
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
              {insuranceTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {type.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {type.document_count} document{type.document_count !== 1 ? 'en' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(type.created_at).toLocaleDateString('nl-NL')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(type)}
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
                            <AlertDialogTitle>Verzekeringstype verwijderen</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je "{type.name}" wilt verwijderen? 
                              {type.document_count > 0 && (
                                <span className="block mt-2 text-orange-600 font-medium">
                                  Let op: Er zijn nog {type.document_count} document(en) gekoppeld aan dit type.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(type)}
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