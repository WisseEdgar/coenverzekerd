import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, User, Building } from "lucide-react";

interface ClientProfile {
  id: string;
  client_type: 'private' | 'business';
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  birth_date?: string;
  bsn?: string;
  marital_status?: string;
  household_members?: number;
  occupation?: string;
  employment_type?: string;
  gross_annual_income?: number;
  net_annual_income?: number;
  company_legal_name?: string;
  kvk_number?: string;
  btw_number?: string;
  legal_form?: string;
  founding_year?: number;
  annual_revenue?: number;
  number_of_employees?: number;
  current_insurances?: any;
  insurance_history?: any;
  risk_assessment?: any;
  preferences?: any;
  intake_responses?: any;
  advisor_notes?: string;
  created_at: string;
  updated_at: string;
}

export default function Clients() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<'all' | 'private' | 'business'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    client_type: 'private' as 'private' | 'business',
    full_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    birth_date: '',
    bsn: '',
    marital_status: '',
    household_members: '',
    occupation: '',
    employment_type: '',
    gross_annual_income: '',
    net_annual_income: '',
    company_legal_name: '',
    kvk_number: '',
    btw_number: '',
    legal_form: '',
    founding_year: '',
    annual_revenue: '',
    number_of_employees: '',
    advisor_notes: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('client_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients((data as ClientProfile[]) || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load client profiles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      client_type: 'private',
      full_name: '',
      company_name: '',
      email: '',
      phone: '',
      address: '',
      birth_date: '',
      bsn: '',
      marital_status: '',
      household_members: '',
      occupation: '',
      employment_type: '',
      gross_annual_income: '',
      net_annual_income: '',
      company_legal_name: '',
      kvk_number: '',
      btw_number: '',
      legal_form: '',
      founding_year: '',
      annual_revenue: '',
      number_of_employees: '',
      advisor_notes: ''
    });
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const clientData = {
        advisor_id: user.id,
        client_type: formData.client_type,
        full_name: formData.full_name || null,
        company_name: formData.company_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        birth_date: formData.birth_date || null,
        bsn: formData.bsn || null,
        marital_status: formData.marital_status || null,
        household_members: formData.household_members ? parseInt(formData.household_members) : null,
        occupation: formData.occupation || null,
        employment_type: formData.employment_type || null,
        gross_annual_income: formData.gross_annual_income ? parseFloat(formData.gross_annual_income) : null,
        net_annual_income: formData.net_annual_income ? parseFloat(formData.net_annual_income) : null,
        company_legal_name: formData.company_legal_name || null,
        kvk_number: formData.kvk_number || null,
        btw_number: formData.btw_number || null,
        legal_form: formData.legal_form || null,
        founding_year: formData.founding_year ? parseInt(formData.founding_year) : null,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
        number_of_employees: formData.number_of_employees ? parseInt(formData.number_of_employees) : null,
        advisor_notes: formData.advisor_notes || null
      };

      if (editingClient) {
        const { error } = await supabase
          .from('client_profiles')
          .update(clientData)
          .eq('id', editingClient.id);
        if (error) throw error;
        toast({ title: "Success", description: "Client profile updated successfully" });
      } else {
        const { error } = await supabase
          .from('client_profiles')
          .insert([clientData]);
        if (error) throw error;
        toast({ title: "Success", description: "Client profile created successfully" });
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: "Error",
        description: "Failed to save client profile",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (client: ClientProfile) => {
    setEditingClient(client);
    setFormData({
      client_type: client.client_type,
      full_name: client.full_name || '',
      company_name: client.company_name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      birth_date: client.birth_date || '',
      bsn: client.bsn || '',
      marital_status: client.marital_status || '',
      household_members: client.household_members?.toString() || '',
      occupation: client.occupation || '',
      employment_type: client.employment_type || '',
      gross_annual_income: client.gross_annual_income?.toString() || '',
      net_annual_income: client.net_annual_income?.toString() || '',
      company_legal_name: client.company_legal_name || '',
      kvk_number: client.kvk_number || '',
      btw_number: client.btw_number || '',
      legal_form: client.legal_form || '',
      founding_year: client.founding_year?.toString() || '',
      annual_revenue: client.annual_revenue?.toString() || '',
      number_of_employees: client.number_of_employees?.toString() || '',
      advisor_notes: client.advisor_notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('client_profiles')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      toast({ title: "Success", description: "Client profile deleted successfully" });
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: "Failed to delete client profile",
        variant: "destructive"
      });
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = !searchTerm || 
      client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || client.client_type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const openNewClientDialog = () => {
    setEditingClient(null);
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Client Profiles</h1>
          <p className="text-muted-foreground">Manage your client information and profiles</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewClientDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Edit Client Profile' : 'Create New Client Profile'}
              </DialogTitle>
              <DialogDescription>
                Fill in the client information below. All fields are optional unless specified.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid gap-4">
                <Label htmlFor="client_type">Client Type</Label>
                <Select 
                  value={formData.client_type} 
                  onValueChange={(value: 'private' | 'business') => 
                    setFormData(prev => ({ ...prev, client_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private Client</SelectItem>
                    <SelectItem value="business">Business Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={formData.client_type} className="w-full">
                <TabsContent value="private" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_date">Birth Date</Label>
                      <Input
                        id="birth_date"
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bsn">BSN</Label>
                      <Input
                        id="bsn"
                        value={formData.bsn}
                        onChange={(e) => setFormData(prev => ({ ...prev, bsn: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="marital_status">Marital Status</Label>
                      <Input
                        id="marital_status"
                        value={formData.marital_status}
                        onChange={(e) => setFormData(prev => ({ ...prev, marital_status: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="household_members">Household Members</Label>
                      <Input
                        id="household_members"
                        type="number"
                        value={formData.household_members}
                        onChange={(e) => setFormData(prev => ({ ...prev, household_members: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="occupation">Occupation</Label>
                      <Input
                        id="occupation"
                        value={formData.occupation}
                        onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employment_type">Employment Type</Label>
                      <Input
                        id="employment_type"
                        value={formData.employment_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, employment_type: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gross_annual_income">Gross Annual Income (€)</Label>
                      <Input
                        id="gross_annual_income"
                        type="number"
                        value={formData.gross_annual_income}
                        onChange={(e) => setFormData(prev => ({ ...prev, gross_annual_income: e.target.value }))}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="business" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company_legal_name">Legal Name</Label>
                      <Input
                        id="company_legal_name"
                        value={formData.company_legal_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_legal_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="kvk_number">KVK Number</Label>
                      <Input
                        id="kvk_number"
                        value={formData.kvk_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, kvk_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="btw_number">BTW Number</Label>
                      <Input
                        id="btw_number"
                        value={formData.btw_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, btw_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="legal_form">Legal Form</Label>
                      <Input
                        id="legal_form"
                        value={formData.legal_form}
                        onChange={(e) => setFormData(prev => ({ ...prev, legal_form: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="founding_year">Founding Year</Label>
                      <Input
                        id="founding_year"
                        type="number"
                        value={formData.founding_year}
                        onChange={(e) => setFormData(prev => ({ ...prev, founding_year: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="annual_revenue">Annual Revenue (€)</Label>
                      <Input
                        id="annual_revenue"
                        type="number"
                        value={formData.annual_revenue}
                        onChange={(e) => setFormData(prev => ({ ...prev, annual_revenue: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="number_of_employees">Number of Employees</Label>
                      <Input
                        id="number_of_employees"
                        type="number"
                        value={formData.number_of_employees}
                        onChange={(e) => setFormData(prev => ({ ...prev, number_of_employees: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="advisor_notes">Advisor Notes</Label>
                <Textarea
                  id="advisor_notes"
                  placeholder="Add any additional notes about this client..."
                  value={formData.advisor_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, advisor_notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingClient ? 'Update' : 'Create'} Client
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name, company, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="private">Private Clients</SelectItem>
            <SelectItem value="business">Business Clients</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No clients found</h3>
            <p className="text-muted-foreground mb-4">
              {clients.length === 0 
                ? "Get started by creating your first client profile"
                : "Try adjusting your search or filter criteria"
              }
            </p>
            {clients.length === 0 && (
              <Button onClick={openNewClientDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {client.client_type === 'private' ? <User className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                      {client.client_type === 'private' ? client.full_name || 'Unnamed Client' : client.company_name || 'Unnamed Company'}
                    </CardTitle>
                    <CardDescription>
                      <Badge variant={client.client_type === 'private' ? 'default' : 'secondary'}>
                        {client.client_type === 'private' ? 'Private' : 'Business'}
                      </Badge>
                      {client.email && <span className="ml-2">{client.email}</span>}
                      {client.phone && <span className="ml-2">• {client.phone}</span>}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(client)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(client.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(client.advisor_notes || client.address) && (
                <CardContent>
                  {client.address && (
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Address:</strong> {client.address}
                    </p>
                  )}
                  {client.advisor_notes && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Notes:</strong> {client.advisor_notes}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}