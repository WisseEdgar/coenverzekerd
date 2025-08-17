import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, FileText, Building2, Calendar, ExternalLink, Loader2, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  searchResults?: SearchResult[];
}

interface Citation {
  document_id: string;
  document_title: string;
  insurer_name: string;
  product_name: string;
  page: number;
  version_label?: string;
  similarity: number;
}

interface SearchResult {
  chunk_id: string;
  document_id: string;
  chunk_text: string;
  page: number;
  similarity: number;
  insurer_name: string;
  product_name: string;
  document_title: string;
  version_label?: string;
}

interface ClientContext {
  client_type: 'particulier' | 'bedrijf';
  company_name?: string;
  full_name?: string;
  employees_count?: number;
  annual_revenue?: number;
  situation_description: string;
  insurance_needs: string;
  current_coverage?: string;
  budget?: string;
}

interface SearchFilters {
  line_of_business?: string;
  insurer?: string;
  version_date_from?: string;
  version_date_to?: string;
}

export function InsuranceChat() {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showIntake, setShowIntake] = useState(true);
  
  // Client context state
  const [clientContext, setClientContext] = useState<ClientContext>({
    client_type: 'particulier',
    situation_description: '',
    insurance_needs: ''
  });

  // Search filters state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});

  // Fetch insurers for filter dropdown
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleIntakeComplete = () => {
    if (!clientContext.situation_description.trim() || !clientContext.insurance_needs.trim()) {
      toast({
        title: "Intake niet compleet",
        description: "Vul alle verplichte velden in om door te gaan.",
        variant: "destructive"
      });
      return;
    }

    setShowIntake(false);
    
    // Add welcome message based on client context
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Welkom! Ik ga je helpen de beste verzekeringopties te vinden voor ${
        clientContext.client_type === 'bedrijf' 
          ? `${clientContext.company_name || 'je bedrijf'}${clientContext.employees_count ? ` met ${clientContext.employees_count} medewerkers` : ''}`
          : clientContext.full_name || 'je persoonlijke situatie'
      }.\n\nJe bent op zoek naar: ${clientContext.insurance_needs}\n\nSituatie: ${clientContext.situation_description}\n\nStel gerust je vragen over specifieke dekking, premies, voorwaarden of vergelijkingen tussen verzekeraars. Ik baseer mijn antwoorden op actuele polisvoorwaarden en kan concrete citaties geven.`,
      timestamp: new Date()
    };

    setMessages([welcomeMessage]);
  };

  const performSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      // The search is now handled within the chat-answer function
      // This function is kept for potential future direct search needs
      return [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, [searchFilters]);

  const generateResponse = useCallback(async (userMessage: string, searchResults: SearchResult[]) => {
    try {
      setIsLoading(true);
      
      // Prepare user context from client context
      const userContextString = clientContext ? `
Klanttype: ${clientContext.client_type}
${clientContext.company_name ? `Bedrijf: ${clientContext.company_name}` : ''}
${clientContext.situation_description ? `Situatie: ${clientContext.situation_description}` : ''}
${clientContext.insurance_needs ? `Verzekeringsbehoefte: ${clientContext.insurance_needs}` : ''}
      `.trim() : undefined;

      // Call the chat-answer Edge Function
      const response = await supabase.functions.invoke('chat-answer', {
        body: {
          query: userMessage,
          filters: {
            lob: searchFilters.line_of_business || null,
            insurer_name: searchFilters.insurer || null
          },
          userContext: userContextString
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Er is een fout opgetreden bij het genereren van het antwoord');
      }

      const { answer, passages } = response.data;

      // Convert passages to citations
      const citations: Citation[] = passages?.slice(0, 5).map((passage: any, index: number) => ({
        id: `citation-${index}`,
        document_id: passage.document_id,
        title: passage.document_title || 'Onbekend document',
        page: passage.page || 1,
        insurer: passage.insurer_name || 'Onbekende verzekeraar',
        product: passage.product_name || 'Onbekend product'
      })) || [];

      return { 
        response: answer || 'Geen antwoord gegenereerd.', 
        citations 
      };

    } catch (error) {
      console.error('Error generating response:', error);
      
      // Fallback response
      return {
        response: `Er is een fout opgetreden bij het verwerken van uw vraag: ${error instanceof Error ? error.message : 'Onbekende fout'}. Probeer het opnieuw of contacteer de ondersteuning.`,
        citations: []
      };
    } finally {
      setIsLoading(false);
    }
  }, [searchFilters, clientContext]);

  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    
    // Add user message to chat
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      citations: []
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      // Generate response using the chat-answer Edge Function
      const { response, citations } = await generateResponse(userMessage, []);
      
      // Add assistant message to chat
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant', 
        content: response,
        timestamp: new Date(),
        citations
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error handling message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Er is een fout opgetreden bij het verwerken van uw bericht. Probeer het opnieuw.',
        timestamp: new Date(),
        citations: []
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [currentMessage, isLoading, generateResponse]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Intake form
  if (showIntake) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Intake Formulier</CardTitle>
            <CardDescription>
              Vertel ons over je situatie zodat we de best passende verzekeringopties kunnen vinden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type klant *</Label>
                <Select 
                  value={clientContext.client_type} 
                  onValueChange={(value: 'particulier' | 'bedrijf') => 
                    setClientContext(prev => ({ ...prev, client_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particulier">Particulier</SelectItem>
                    <SelectItem value="bedrijf">Bedrijf</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {clientContext.client_type === 'bedrijf' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Bedrijfsnaam</Label>
                    <Input
                      id="company_name"
                      value={clientContext.company_name || ''}
                      onChange={(e) => setClientContext(prev => ({ ...prev, company_name: e.target.value }))}
                      placeholder="Bedrijf B.V."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employees_count">Aantal medewerkers</Label>
                    <Input
                      id="employees_count"
                      type="number"
                      value={clientContext.employees_count || ''}
                      onChange={(e) => setClientContext(prev => ({ ...prev, employees_count: parseInt(e.target.value) || undefined }))}
                      placeholder="5"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="full_name">Naam</Label>
                  <Input
                    id="full_name"
                    value={clientContext.full_name || ''}
                    onChange={(e) => setClientContext(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Voor- en achternaam"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="situation_description">Beschrijf je situatie *</Label>
                <Textarea
                  id="situation_description"
                  value={clientContext.situation_description}
                  onChange={(e) => setClientContext(prev => ({ ...prev, situation_description: e.target.value }))}
                  placeholder="Bijv. Ik heb een aannemersbedrijf met 3 werknemers en werk hoofdzakelijk in de bouw..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurance_needs">Welke verzekering zoek je? *</Label>
                <Textarea
                  id="insurance_needs"
                  value={clientContext.insurance_needs}
                  onChange={(e) => setClientContext(prev => ({ ...prev, insurance_needs: e.target.value }))}
                  placeholder="Bijv. Bedrijfsaansprakelijkheidsverzekering, dekking voor gereedschap, werknemers..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current_coverage">Huidige verzekeringen (optioneel)</Label>
                <Textarea
                  id="current_coverage"
                  value={clientContext.current_coverage || ''}
                  onChange={(e) => setClientContext(prev => ({ ...prev, current_coverage: e.target.value }))}
                  placeholder="Welke verzekeringen heb je nu al?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget indicatie (optioneel)</Label>
                <Input
                  id="budget"
                  value={clientContext.budget || ''}
                  onChange={(e) => setClientContext(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="Bijv. €500 per maand, €2000 per jaar"
                />
              </div>
            </div>

            <Button onClick={handleIntakeComplete} className="w-full">
              Start Gesprek
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="flex h-screen">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b p-4 bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Verzekeringsvergelijker</h1>
              <p className="text-sm text-muted-foreground">
                {clientContext.client_type === 'bedrijf' 
                  ? `${clientContext.company_name || 'Bedrijf'} • ${clientContext.employees_count || '?'} medewerkers`
                  : clientContext.full_name || 'Particuliere klant'
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIntake(true)}
              >
                Intake Wijzigen
              </Button>
            </div>
          </div>
        </div>

        {/* Search Filters */}
        {showFilters && (
          <div className="border-b p-4 bg-muted/30">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-48">
                <Select 
                  value={searchFilters.line_of_business || ''} 
                  onValueChange={(value) => setSearchFilters(prev => ({ 
                    ...prev, 
                    line_of_business: value === "all" ? undefined : value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Verzekeringssoort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle soorten</SelectItem>
                    {INSURANCE_LINES.map((line) => (
                      <SelectItem key={line} value={line}>{line}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="min-w-48">
                <Select 
                  value={searchFilters.insurer || ''} 
                  onValueChange={(value) => setSearchFilters(prev => ({ 
                    ...prev, 
                    insurer: value === "all" ? undefined : value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Verzekeraar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle verzekeraars</SelectItem>
                    {insurers?.map((insurer) => (
                      <SelectItem key={insurer.id} value={insurer.name}>{insurer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchFilters({})}
              >
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground ml-2' : 'bg-muted mr-2'
                  }`}>
                    {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  
                  <div className={`rounded-lg px-4 py-2 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {/* Citations */}
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-xs font-medium mb-2 opacity-70">Bronnen:</p>
                        <div className="flex flex-wrap gap-1">
                          {message.citations.map((citation, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-secondary/80"
                              title={`${citation.insurer_name} - ${citation.product_name}\n${citation.document_title}\nPagina ${citation.page}\nRelevantie: ${(citation.similarity * 100).toFixed(1)}%`}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {citation.insurer_name} p.{citation.page}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-[80%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted mr-2">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Zoeken in verzekeringsdocumenten...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t p-4 bg-background">
          <div className="flex space-x-2 max-w-4xl mx-auto">
            <Textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Stel je vraag over verzekeringen..."
              disabled={isLoading}
              rows={1}
              className="min-h-[40px] max-h-32 resize-none"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}