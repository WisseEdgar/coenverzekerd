import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Edit, Trash2, Globe, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Insurer {
  id: string;
  name: string;
  kvk?: string;
  website?: string;
  created_at: string;
  updated_at: string;
  _count?: {
    products: number;
  };
}

interface NewInsurerData {
  name: string;
  kvk: string;
  website: string;
}

export function InsuranceTaxonomy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingInsurer, setIsAddingInsurer] = useState(false);
  const [editingInsurer, setEditingInsurer] = useState<Insurer | null>(null);
  const [newInsurerData, setNewInsurerData] = useState<NewInsurerData>({
    name: '',
    kvk: '',
    website: ''
  });

  // Fetch insurers with product counts
  const { data: insurers, isLoading, refetch } = useQuery({
    queryKey: ['insurers-with-counts'],
    queryFn: async () => {
      // Get insurers
      const { data: insurersData, error: insurersError } = await supabase
        .from('insurers')
        .select('*')
        .order('name');

      if (insurersError) throw insurersError;

      // Get product counts for each insurer
      const insurersWithCounts = await Promise.all(
        insurersData.map(async (insurer) => {
          const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('insurer_id', insurer.id);

          return {
            ...insurer,
            _count: { products: count || 0 }
          };
        })
      );

      return insurersWithCounts as Insurer[];
    }
  });

  const resetNewInsurerData = () => {
    setNewInsurerData({ name: '', kvk: '', website: '' });
  };

  const handleAddInsurer = async () => {
    if (!newInsurerData.name.trim()) {
      toast({
        title: "Validatiefout",
        description: "Naam is verplicht",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('insurers')
        .insert([{
          name: newInsurerData.name.trim(),
          kvk: newInsurerData.kvk.trim() || null,
          website: newInsurerData.website.trim() || null
        }]);

      if (error) throw error;

      toast({
        title: "Verzekeraar toegevoegd",
        description: `${newInsurerData.name} is succesvol toegevoegd.`
      });

      setIsAddingInsurer(false);
      resetNewInsurerData();
      refetch();
    } catch (error: any) {
      console.error('Add insurer error:', error);
      toast({
        title: "Toevoegen mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const handleEditInsurer = async () => {
    if (!editingInsurer || !newInsurerData.name.trim()) {
      toast({
        title: "Validatiefout",
        description: "Naam is verplicht",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('insurers')
        .update({
          name: newInsurerData.name.trim(),
          kvk: newInsurerData.kvk.trim() || null,
          website: newInsurerData.website.trim() || null
        })
        .eq('id', editingInsurer.id);

      if (error) throw error;

      toast({
        title: "Verzekeraar bijgewerkt",
        description: `${newInsurerData.name} is succesvol bijgewerkt.`
      });

      setEditingInsurer(null);
      resetNewInsurerData();
      refetch();
    } catch (error: any) {
      console.error('Edit insurer error:', error);
      toast({
        title: "Bijwerken mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const handleDeleteInsurer = async (insurer: Insurer) => {
    if (insurer._count?.products && insurer._count.products > 0) {
      toast({
        title: "Kan niet verwijderen",
        description: `${insurer.name} heeft nog ${insurer._count.products} product(en). Verwijder eerst alle producten.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('insurers')
        .delete()
        .eq('id', insurer.id);

      if (error) throw error;

      toast({
        title: "Verzekeraar verwijderd",
        description: `${insurer.name} is succesvol verwijderd.`
      });

      refetch();
    } catch (error: any) {
      console.error('Delete insurer error:', error);
      toast({
        title: "Verwijderen mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const startEdit = (insurer: Insurer) => {
    setEditingInsurer(insurer);
    setNewInsurerData({
      name: insurer.name,
      kvk: insurer.kvk || '',
      website: insurer.website || ''
    });
  };

  const cancelEdit = () => {
    setEditingInsurer(null);
    resetNewInsurerData();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Verzekeraars laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verzekeraars Beheer</CardTitle>
              <CardDescription>
                Beheer de lijst van verzekeraars en hun gegevens.
              </CardDescription>
            </div>
            <Dialog open={isAddingInsurer} onOpenChange={setIsAddingInsurer}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Verzekeraar Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuwe Verzekeraar</DialogTitle>
                  <DialogDescription>
                    Voeg een nieuwe verzekeraar toe aan het systeem.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Naam *</Label>
                    <Input
                      id="name"
                      value={newInsurerData.name}
                      onChange={(e) => setNewInsurerData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Bijv. Achmea, Allianz, ASR"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kvk">KvK Nummer</Label>
                    <Input
                      id="kvk"
                      value={newInsurerData.kvk}
                      onChange={(e) => setNewInsurerData(prev => ({ ...prev, kvk: e.target.value }))}
                      placeholder="Bijv. 12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={newInsurerData.website}
                      onChange={(e) => setNewInsurerData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://www.verzekeraar.nl"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddingInsurer(false); resetNewInsurerData(); }}>
                    Annuleren
                  </Button>
                  <Button onClick={handleAddInsurer}>
                    Toevoegen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {insurers && insurers.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Verzekeraar</TableHead>
                    <TableHead>KvK Nummer</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Producten</TableHead>
                    <TableHead>Laatst Bijgewerkt</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insurers.map((insurer) => (
                    <TableRow key={insurer.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Building2 className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{insurer.name}</p>
                            <p className="text-sm text-muted-foreground">ID: {insurer.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {insurer.kvk || <span className="text-muted-foreground">Niet ingesteld</span>}
                      </TableCell>
                      <TableCell>
                        {insurer.website ? (
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={insurer.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {insurer.website.replace('https://', '').replace('http://', '')}
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Niet ingesteld</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {insurer._count?.products || 0} product(en)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(insurer.updated_at), 'dd-MM-yyyy')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Dialog open={editingInsurer?.id === insurer.id} onOpenChange={(open) => !open && cancelEdit()}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => startEdit(insurer)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Verzekeraar Bewerken</DialogTitle>
                                <DialogDescription>
                                  Bewerk de gegevens van {insurer.name}.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-name">Naam *</Label>
                                  <Input
                                    id="edit-name"
                                    value={newInsurerData.name}
                                    onChange={(e) => setNewInsurerData(prev => ({ ...prev, name: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-kvk">KvK Nummer</Label>
                                  <Input
                                    id="edit-kvk"
                                    value={newInsurerData.kvk}
                                    onChange={(e) => setNewInsurerData(prev => ({ ...prev, kvk: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-website">Website</Label>
                                  <Input
                                    id="edit-website"
                                    type="url"
                                    value={newInsurerData.website}
                                    onChange={(e) => setNewInsurerData(prev => ({ ...prev, website: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={cancelEdit}>
                                  Annuleren
                                </Button>
                                <Button onClick={handleEditInsurer}>
                                  Opslaan
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={insurer._count?.products && insurer._count.products > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Verzekeraar verwijderen</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Weet je zeker dat je "{insurer.name}" wilt verwijderen? 
                                  Deze actie kan niet ongedaan worden gemaakt.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteInsurer(insurer)}
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
          ) : (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nog geen verzekeraars toegevoegd. Voeg je eerste verzekeraar toe om te beginnen.
              </p>
              <Button onClick={() => setIsAddingInsurer(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Eerste Verzekeraar Toevoegen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}