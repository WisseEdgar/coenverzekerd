import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, Building, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientProfile {
  id: string;
  client_type: 'private' | 'business';
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  created_at: string;
}

interface ClientSelectorProps {
  onClientSelect: (client: ClientProfile | null) => void;
  selectedClient: ClientProfile | null;
}

export default function ClientSelector({ onClientSelect, selectedClient }: ClientSelectorProps) {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_profiles')
        .select('id, client_type, full_name, company_name, email, phone, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients((data as ClientProfile[]) || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(search) ||
      client.company_name?.toLowerCase().includes(search) ||
      client.email?.toLowerCase().includes(search)
    );
  });

  const handleClientSelect = (client: ClientProfile) => {
    onClientSelect(client);
    setIsDialogOpen(false);
  };

  const handleNewChat = () => {
    onClientSelect(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="mb-4">
      {selectedClient ? (
        <Card className="bg-simon-green-light border-simon-green">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedClient.client_type === 'private' ? 
                  <User className="h-5 w-5 text-simon-green" /> : 
                  <Building className="h-5 w-5 text-simon-green" />
                }
                <div>
                  <p className="font-medium">
                    {selectedClient.client_type === 'private' 
                      ? selectedClient.full_name 
                      : selectedClient.company_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                </div>
                <Badge variant="secondary">
                  {selectedClient.client_type === 'private' ? 'Particulier' : 'Zakelijk'}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClientSelect(null)}
                className="hover:bg-red-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <User className="mr-2 h-4 w-4" />
              Selecteer Klant (optioneel)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Klant Selecteren</DialogTitle>
              <DialogDescription>
                Kies een bestaande klant voor een gepersonaliseerd gesprek, of start een nieuw gesprek zonder klantprofiel.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek op naam, bedrijf of e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleNewChat} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuw Gesprek
                </Button>
              </div>

              <ScrollArea className="h-96">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">Laden...</p>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <User className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {clients.length === 0 ? 'Nog geen klanten gevonden' : 'Geen klanten gevonden voor deze zoekopdracht'}
                    </p>
                    <Button onClick={handleNewChat}>
                      Start Nieuw Gesprek
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredClients.map((client) => (
                      <Card 
                        key={client.id} 
                        className="hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => handleClientSelect(client)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {client.client_type === 'private' ? 
                              <User className="h-5 w-5 text-muted-foreground" /> : 
                              <Building className="h-5 w-5 text-muted-foreground" />
                            }
                            <div className="flex-1">
                              <p className="font-medium">
                                {client.client_type === 'private' 
                                  ? client.full_name || 'Naamloze Klant'
                                  : client.company_name || 'Naamloos Bedrijf'}
                              </p>
                              {client.email && (
                                <p className="text-sm text-muted-foreground">{client.email}</p>
                              )}
                            </div>
                            <Badge variant={client.client_type === 'private' ? 'default' : 'secondary'}>
                              {client.client_type === 'private' ? 'Particulier' : 'Zakelijk'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}