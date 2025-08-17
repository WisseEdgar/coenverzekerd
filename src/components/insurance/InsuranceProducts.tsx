import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Edit, Trash2, Building2, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const INSURANCE_LINES = [
  'Aansprakelijkheidsverzekering',
  'Arbeidsongeschiktheidsverzekering', 
  'Autoverzekering',
  'Bedrijfsschadeverzekering',  
  'CAR-verzekering',
  'Cyberverzekering',
  'Opstalverzekering',
  'Inboedelverzekering',
  'Reisverzekering',
  'Transportverzekering',
  'Zorgverzekering',
  'Overige'
];

interface Product {
  id: string;
  name: string;
  line_of_business: string;
  version_label?: string;
  version_date?: string;
  created_at: string;
  updated_at: string;
  insurers: {
    id: string;
    name: string;
  };
  _count?: {
    documents: number;
  };
}

interface NewProductData {
  name: string;
  insurer_id: string;
  line_of_business: string;
  version_label: string;
  version_date: string;
}

export function InsuranceProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterInsurer, setFilterInsurer] = useState('all');
  const [filterLineOfBusiness, setFilterLineOfBusiness] = useState('all');
  const [newProductData, setNewProductData] = useState<NewProductData>({
    name: '',
    insurer_id: '',
    line_of_business: '',
    version_label: '',
    version_date: ''
  });

  // Fetch insurers for dropdowns
  const { data: insurers } = useQuery({
    queryKey: ['insurers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch products with document counts
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products-with-counts', filterInsurer, filterLineOfBusiness],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          insurers (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (filterInsurer !== 'all') {
        query = query.eq('insurer_id', filterInsurer);
      }

      if (filterLineOfBusiness !== 'all') {
        query = query.eq('line_of_business', filterLineOfBusiness);
      }

      const { data: productsData, error } = await query;
      if (error) throw error;

      // Get document counts for each product
      const productsWithCounts = await Promise.all(
        productsData.map(async (product) => {
          const { count } = await supabase
            .from('documents_v2')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', product.id);

          return {
            ...product,
            _count: { documents: count || 0 }
          };
        })
      );

      return productsWithCounts as Product[];
    }
  });

  const resetNewProductData = () => {
    setNewProductData({
      name: '',
      insurer_id: '',
      line_of_business: '',
      version_label: '',
      version_date: ''
    });
  };

  const handleAddProduct = async () => {
    if (!newProductData.name.trim() || !newProductData.insurer_id || !newProductData.line_of_business) {
      toast({
        title: "Validatiefout",
        description: "Naam, verzekeraar en verzekeringssoort zijn verplicht",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .insert([{
          name: newProductData.name.trim(),
          insurer_id: newProductData.insurer_id,
          line_of_business: newProductData.line_of_business,
          version_label: newProductData.version_label.trim() || null,
          version_date: newProductData.version_date || null
        }]);

      if (error) throw error;

      toast({
        title: "Product toegevoegd",
        description: `${newProductData.name} is succesvol toegevoegd.`
      });

      setIsAddingProduct(false);
      resetNewProductData();
      refetch();
    } catch (error: any) {
      console.error('Add product error:', error);
      toast({
        title: "Toevoegen mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct || !newProductData.name.trim() || !newProductData.insurer_id || !newProductData.line_of_business) {
      toast({
        title: "Validatiefout",
        description: "Naam, verzekeraar en verzekeringssoort zijn verplicht",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: newProductData.name.trim(),
          insurer_id: newProductData.insurer_id,
          line_of_business: newProductData.line_of_business,
          version_label: newProductData.version_label.trim() || null,
          version_date: newProductData.version_date || null
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast({
        title: "Product bijgewerkt",
        description: `${newProductData.name} is succesvol bijgewerkt.`
      });

      setEditingProduct(null);
      resetNewProductData();
      refetch();
    } catch (error: any) {
      console.error('Edit product error:', error);
      toast({
        title: "Bijwerken mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (product._count?.documents && product._count.documents > 0) {
      toast({
        title: "Kan niet verwijderen",
        description: `${product.name} heeft nog ${product._count.documents} document(en). Verwijder eerst alle documenten.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Product verwijderd",
        description: `${product.name} is succesvol verwijderd.`
      });

      refetch();
    } catch (error: any) {
      console.error('Delete product error:', error);
      toast({
        title: "Verwijderen mislukt",
        description: error.message || 'Er is een fout opgetreden.',
        variant: "destructive"
      });
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProductData({
      name: product.name,
      insurer_id: product.insurers.id,
      line_of_business: product.line_of_business,
      version_label: product.version_label || '',
      version_date: product.version_date || ''
    });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    resetNewProductData();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Producten laden...</p>
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
              <CardTitle>Verzekeringsproducten</CardTitle>
              <CardDescription>
                Beheer de catalogus van verzekeringsproducten per verzekeraar.
              </CardDescription>
            </div>
            <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Product Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nieuw Product</DialogTitle>
                  <DialogDescription>
                    Voeg een nieuw verzekeringsproduct toe aan het systeem.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Productnaam *</Label>
                      <Input
                        id="name"
                        value={newProductData.name}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Bijv. Bedrijfsaansprakelijkheid Pro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurer">Verzekeraar *</Label>
                      <Select 
                        value={newProductData.insurer_id} 
                        onValueChange={(value) => setNewProductData(prev => ({ ...prev, insurer_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer verzekeraar" />
                        </SelectTrigger>
                        <SelectContent>
                          {insurers?.map((insurer) => (
                            <SelectItem key={insurer.id} value={insurer.id}>{insurer.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lineOfBusiness">Verzekeringssoort *</Label>
                      <Select 
                        value={newProductData.line_of_business} 
                        onValueChange={(value) => setNewProductData(prev => ({ ...prev, line_of_business: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer soort" />
                        </SelectTrigger>
                        <SelectContent>
                          {INSURANCE_LINES.map((line) => (
                            <SelectItem key={line} value={line}>{line}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="versionLabel">Versie Label</Label>
                      <Input
                        id="versionLabel"
                        value={newProductData.version_label}
                        onChange={(e) => setNewProductData(prev => ({ ...prev, version_label: e.target.value }))}
                        placeholder="Bijv. V2024.1, Pro Edition"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="versionDate">Versie Datum</Label>
                    <Input
                      id="versionDate"
                      type="date"
                      value={newProductData.version_date}
                      onChange={(e) => setNewProductData(prev => ({ ...prev, version_date: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddingProduct(false); resetNewProductData(); }}>
                    Annuleren
                  </Button>
                  <Button onClick={handleAddProduct}>
                    Toevoegen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={filterInsurer} onValueChange={setFilterInsurer}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter op verzekeraar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle verzekeraars</SelectItem>
                {insurers?.map((insurer) => (
                  <SelectItem key={insurer.id} value={insurer.id}>{insurer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLineOfBusiness} onValueChange={setFilterLineOfBusiness}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Filter op soort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle soorten</SelectItem>
                {INSURANCE_LINES.map((line) => (
                  <SelectItem key={line} value={line}>{line}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Vernieuwen
            </Button>
          </div>

          {products && products.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Verzekeraar</TableHead>
                    <TableHead>Soort</TableHead>
                    <TableHead>Versie</TableHead>
                    <TableHead>Documenten</TableHead>
                    <TableHead>Aangemaakt</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Package className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">ID: {product.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{product.insurers.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.line_of_business}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {product.version_label && (
                            <p className="font-medium">{product.version_label}</p>
                          )}
                          {product.version_date && (
                            <div className="flex items-center space-x-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(product.version_date), 'dd-MM-yyyy')}</span>
                            </div>
                          )}
                          {!product.version_label && !product.version_date && (
                            <span className="text-muted-foreground">Geen versie</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {product._count?.documents || 0} document(en)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(product.created_at), 'dd-MM-yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Dialog open={editingProduct?.id === product.id} onOpenChange={(open) => !open && cancelEdit()}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => startEdit(product)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Product Bewerken</DialogTitle>
                                <DialogDescription>
                                  Bewerk de gegevens van {product.name}.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Productnaam *</Label>
                                    <Input
                                      id="edit-name"
                                      value={newProductData.name}
                                      onChange={(e) => setNewProductData(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-insurer">Verzekeraar *</Label>
                                    <Select 
                                      value={newProductData.insurer_id} 
                                      onValueChange={(value) => setNewProductData(prev => ({ ...prev, insurer_id: value }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {insurers?.map((insurer) => (
                                          <SelectItem key={insurer.id} value={insurer.id}>{insurer.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-lineOfBusiness">Verzekeringssoort *</Label>
                                    <Select 
                                      value={newProductData.line_of_business} 
                                      onValueChange={(value) => setNewProductData(prev => ({ ...prev, line_of_business: value }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {INSURANCE_LINES.map((line) => (
                                          <SelectItem key={line} value={line}>{line}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-versionLabel">Versie Label</Label>
                                    <Input
                                      id="edit-versionLabel"
                                      value={newProductData.version_label}
                                      onChange={(e) => setNewProductData(prev => ({ ...prev, version_label: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-versionDate">Versie Datum</Label>
                                  <Input
                                    id="edit-versionDate"
                                    type="date"
                                    value={newProductData.version_date}
                                    onChange={(e) => setNewProductData(prev => ({ ...prev, version_date: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={cancelEdit}>
                                  Annuleren
                                </Button>
                                <Button onClick={handleEditProduct}>
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
                                disabled={product._count?.documents && product._count.documents > 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Product verwijderen</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Weet je zeker dat je "{product.name}" wilt verwijderen? 
                                  Deze actie kan niet ongedaan worden gemaakt.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProduct(product)}
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
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {filterInsurer !== 'all' || filterLineOfBusiness !== 'all' 
                  ? 'Geen producten gevonden die voldoen aan de filters.'
                  : 'Nog geen producten toegevoegd. Voeg je eerste product toe om te beginnen.'
                }
              </p>
              {filterInsurer === 'all' && filterLineOfBusiness === 'all' && (
                <Button onClick={() => setIsAddingProduct(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Eerste Product Toevoegen
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}