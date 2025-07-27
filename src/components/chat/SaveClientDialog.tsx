import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";

interface SaveClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (clientId: string) => void;
  initialData?: any;
  conversationSummary?: string;
}

export default function SaveClientDialog({ 
  isOpen, 
  onClose, 
  onSaved, 
  initialData = {},
  conversationSummary 
}: SaveClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Create a comprehensive summary from intake data
  const createAdvisorNotes = () => {
    if (!initialData) return conversationSummary || '';
    
    console.log('SaveClientDialog initialData:', initialData);
    
    const notes = [];
    if (conversationSummary) notes.push(conversationSummary);
    
    if (initialData.situation_description) {
      notes.push(`Situatie: ${initialData.situation_description}`);
    }
    if (initialData.insurance_needs) {
      notes.push(`Verzekeringsbehoefte: ${initialData.insurance_needs}`);
    }
    if (initialData.current_coverage) {
      notes.push(`Huidige verzekeringen: ${initialData.current_coverage}`);
    }
    if (initialData.budget) {
      notes.push(`Budget: ${initialData.budget}`);
    }
    if (initialData.timeline) {
      notes.push(`Tijdslijn: ${initialData.timeline}`);
    }
    
    return notes.join('\n\n');
  };

  const [formData, setFormData] = useState({
    client_type: (initialData?.client_type === 'business' ? 'business' : 'private') as 'private' | 'business',
    full_name: initialData?.full_name || '',
    company_name: initialData?.company_name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    address: '', // Address is not captured in the intake questionnaire
    advisor_notes: createAdvisorNotes()
  });

  // Update form data when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        client_type: (initialData?.client_type === 'business' ? 'business' : 'private') as 'private' | 'business',
        full_name: initialData?.full_name || '',
        company_name: initialData?.company_name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        address: '', // Address is not captured in the intake questionnaire
        advisor_notes: createAdvisorNotes()
      });
    }
  }, [isOpen, initialData, conversationSummary]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Geen geauthenticeerde gebruiker');

      const clientData = {
        advisor_id: user.id,
        client_type: formData.client_type,
        full_name: formData.full_name || null,
        company_name: formData.company_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        advisor_notes: formData.advisor_notes || null,
        // Store initial intake data in intake_responses
        intake_responses: initialData
      };

      const { data, error } = await supabase
        .from('client_profiles')
        .insert([clientData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Gelukt",
        description: "Klantprofiel succesvol aangemaakt"
      });

      onSaved(data.id);
      onClose();
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: "Fout",
        description: "Kon klantprofiel niet opslaan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opslaan als Klantprofiel</DialogTitle>
          <DialogDescription>
            Maak een permanent klantprofiel aan op basis van dit gesprek
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="client_type">Klanttype</Label>
            <Select 
              value={formData.client_type} 
              onValueChange={(value: 'private' | 'business') => 
                setFormData(prev => ({ ...prev, client_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer klanttype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Particuliere Klant</SelectItem>
                <SelectItem value="business">Zakelijke Klant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.client_type === 'private' ? (
            <div>
              <Label htmlFor="full_name">Volledige Naam</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Voor- en achternaam"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="company_name">Bedrijfsnaam</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Naam van het bedrijf"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="naam@voorbeeld.nl"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefoonnummer</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+31 6 12345678"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Adres</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Straatnaam 1, 1234 AB Stad"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="advisor_notes">Gesprek Samenvatting & Notities</Label>
            <Textarea
              id="advisor_notes"
              value={formData.advisor_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, advisor_notes: e.target.value }))}
              placeholder="Samenvatting van het gesprek en belangrijke opmerkingen..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              <X className="mr-2 h-4 w-4" />
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Opslaan...' : 'Klant Opslaan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}