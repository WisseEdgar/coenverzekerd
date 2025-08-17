import { useState, useEffect } from "react";
import { Plus, Send, Settings, MessageSquare, X, BarChart3, Save, ChevronDown, ChevronUp, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import ClientSelector from "@/components/chat/ClientSelector";
import IntakeQuestionnaire from "@/components/chat/IntakeQuestionnaire";
import SaveClientDialog from "@/components/chat/SaveClientDialog";
import MessageFeedback from "@/components/chat/MessageFeedback";
import { ProfileDropdown } from "@/components/layout/ProfileDropdown";
import ReactMarkdown from 'react-markdown';
import { getPreflightQuestionnaire } from "@/lib/preflightQuestionnaires";
interface Citation {
  document_id: string;
  document_title: string;
  insurer_name: string;
  product_name: string;
  page: number;
  version_label?: string;
  similarity: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  citations?: Citation[];
}
interface ClientProfile {
  id: string;
  client_type: 'private' | 'business';
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  advisor_notes?: string;
  intake_responses?: any;
  created_at: string;
}
interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SearchFilters {
  line_of_business?: string;
  insurer?: string;
}

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
const Chat = () => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [intakeData, setIntakeData] = useState<any>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [clientPanelOpen, setClientPanelOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const { toast } = useToast();
  const navigate = useNavigate();

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

  // Check auth and load conversations on mount
  useEffect(() => {
    checkAuth();
  }, []);
  // Auto-collapse client options after first message, but allow manual reopen
  useEffect(() => {
    if (messages.length > 0) setClientPanelOpen(false);
  }, [messages.length]);
  const checkAuth = async () => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      await loadConversations();
    } else {
      // Redirect to auth if not authenticated
      window.location.href = '/auth';
    }
  };
  const loadConversations = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('conversations').select('*').order('updated_at', {
        ascending: false
      });
      if (error) throw error;
      if (data && data.length > 0) {
        setConversations(data);
        // Load the most recent conversation by default
        await loadConversation(data[0]);
      } else {
        // Create first conversation if none exist
        await handleNewChat();
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Fout bij laden gesprekken",
        description: "Er is iets misgegaan bij het laden van je gesprekken.",
        variant: "destructive"
      });
    }
  };
  const loadConversation = async (conversation: Conversation) => {
    try {
      setActiveConversation(conversation);
      const {
        data,
        error
      } = await supabase.from('messages').select('*').eq('conversation_id', conversation.id).order('created_at', {
        ascending: true
      });
      if (error) throw error;
      if (data && data.length === 0) {
        // Empty conversation - no welcome message needed, AI will handle first interaction
        setMessages([]);
      } else {
        setMessages((data || []) as Message[]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast({
        title: "Fout bij laden gesprek",
        description: "Er is iets misgegaan bij het laden van dit gesprek.",
        variant: "destructive"
      });
    }
  };
  const addWelcomeMessage = async (conversationId: string) => {
    let welcomeContent = "Hallo! Ik ben Coen A.I+, je persoonlijke verzekering matching assistent.";
    if (selectedClient) {
      const clientName = selectedClient.client_type === 'private' ? selectedClient.full_name : selectedClient.company_name;
      welcomeContent += ` Ik zie dat we spreken over ${clientName}. Ik heb toegang tot hun profiel en kan gepersonaliseerd advies geven.`;
    } else {
      welcomeContent += " Beschrijf de situatie van je klant en ik help je de beste verzekeringopties te vinden.";
    }
    welcomeContent += " Wat kan ik voor je doen?";
    try {
      const {
        data,
        error
      } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: welcomeContent
      }).select().single();
      if (error) throw error;
      if (data) {
        setMessages([data as Message]);
      }
    } catch (error) {
      console.error('Error adding welcome message:', error);
    }
  };
  const generateConversationTitle = (firstMessage: string) => {
    return firstMessage.length > 40 ? firstMessage.substring(0, 40) + "..." : firstMessage;
  };
  const handleNewChat = async () => {
    try {
      // Reset client selection and intake data
      setSelectedClient(null);
      setIntakeData(null);
      setShowIntake(false);
      const {
        data,
        error
      } = await supabase.from('conversations').insert({
        user_id: user.id,
        title: "Nieuwe chat"
      }).select().single();
      if (error) throw error;
      if (data) {
        const newConversation = data;
        setConversations(prev => [newConversation, ...prev]);
        await loadConversation(newConversation);
      }
    } catch (error) {
      console.error('Error creating new conversation:', error);
      toast({
        title: "Fout bij maken nieuwe chat",
        description: "Er is iets misgegaan bij het maken van een nieuwe chat.",
        variant: "destructive"
      });
    }
  };
  const handleClientSelect = (client: ClientProfile | null) => {
    setSelectedClient(client);
    setShowIntake(false);
    setIntakeData(null);
  };
  const handleStartChat = () => {
    if (!selectedClient && !intakeData) {
      setShowIntake(true);
    } else {
      setShowIntake(false);
    }
  };
  const handleIntakeComplete = (data: any) => {
    setIntakeData(data);
    setShowIntake(false);
  };
  const handleIntakeSkip = () => {
    setShowIntake(false);
  };
  const handleSaveAsClient = async (data: any) => {
    setIntakeData(data);
    setShowSaveDialog(true);
  };
  const handleClientSaved = (clientId: string) => {
    // Optionally load the saved client
    toast({
      title: "Klant opgeslagen",
      description: "Het klantprofiel is succesvol aangemaakt"
    });
  };
  const handleConversationClick = async (conversation: Conversation) => {
    await loadConversation(conversation);
  };
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const {
        error
      } = await supabase.from('conversations').delete().eq('id', conversationId);
      if (error) throw error;

      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));

      // If deleted conversation was active, load another one or create new
      if (activeConversation?.id === conversationId) {
        const remainingConversations = conversations.filter(conv => conv.id !== conversationId);
        if (remainingConversations.length > 0) {
          await loadConversation(remainingConversations[0]);
        } else {
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Fout bij verwijderen gesprek",
        description: "Er is iets misgegaan bij het verwijderen van dit gesprek.",
        variant: "destructive"
      });
    }
  };
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading || !activeConversation) return;
    const userMessage = message.trim();
    setMessage("");
    setIsLoading(true);
    try {
      // Add user message to database
      const {
        data: userMessageData,
        error: userError
      } = await supabase.from('messages').insert({
        conversation_id: activeConversation.id,
        role: 'user',
        content: userMessage
      }).select().single();
      if (userError) throw userError;

      // Update local messages
      const updatedMessages = [...messages, userMessageData as Message];
      setMessages(updatedMessages);

      // Update conversation title if this is the first user message
      const userMessages = updatedMessages.filter(msg => msg.role === 'user');
      if (userMessages.length === 1) {
        const newTitle = generateConversationTitle(userMessage);
        const {
          error: titleError
        } = await supabase.from('conversations').update({
          title: newTitle
        }).eq('id', activeConversation.id);
        if (!titleError) {
          setActiveConversation(prev => prev ? {
            ...prev,
            title: newTitle
          } : null);
          setConversations(prev => prev.map(conv => conv.id === activeConversation.id ? {
            ...conv,
            title: newTitle
          } : conv));
        }
      }

      // Prepare conversation history for API
      const conversationHistory = updatedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));


      // Prepare user context from client context
      let userContextString = '';
      if (selectedClient) {
        userContextString = `
Klanttype: ${selectedClient.client_type === 'private' ? 'particulier' : 'bedrijf'}
${selectedClient.company_name ? `Bedrijf: ${selectedClient.company_name}` : ''}
${selectedClient.full_name ? `Naam: ${selectedClient.full_name}` : ''}
${selectedClient.advisor_notes ? `Situatie: ${selectedClient.advisor_notes}` : ''}
        `.trim();
      } else if (intakeData) {
        userContextString = `
Klanttype: ${intakeData.client_type || 'particulier'}
${intakeData.company_name ? `Bedrijf: ${intakeData.company_name}` : ''}
${intakeData.full_name ? `Naam: ${intakeData.full_name}` : ''}
${intakeData.situation_description ? `Situatie: ${intakeData.situation_description}` : ''}
${intakeData.insurance_needs ? `Verzekeringsbehoefte: ${intakeData.insurance_needs}` : ''}
        `.trim();
      }

      // Call RAG system for insurance advice
      const { data: aiData, error: aiError } = await supabase.functions.invoke('chat-answer', {
        body: {
          query: userMessage,
          filters: {
            lob: searchFilters.line_of_business || null,
            insurer_name: searchFilters.insurer || null
          },
          userContext: userContextString || undefined
        }
      });
      if (aiError) throw aiError;

      // Convert passages to citations
      const citations: Citation[] = aiData.passages?.slice(0, 5).map((passage: any, index: number) => ({
        document_id: passage.document_id,
        document_title: passage.document_title || 'Onbekend document',
        page: passage.page || 1,
        insurer_name: passage.insurer_name || 'Onbekende verzekeraar',
        product_name: passage.product_name || 'Onbekend product',
        similarity: passage.similarity || 0
      })) || [];

      // Add AI response to database
      const {
        data: aiMessageData,
        error: aiMessageError
      } = await supabase.from('messages').insert({
        conversation_id: activeConversation.id,
        role: 'assistant',
        content: aiData.answer || 'Geen antwoord gegenereerd.'
      }).select().single();
      if (aiMessageError) throw aiMessageError;

      // Update local messages with citations
      const messageWithCitations = { ...aiMessageData, citations } as Message;
      setMessages(prev => [...prev, messageWithCitations]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Er is iets misgegaan",
        description: "Probeer het opnieuw. Als het probleem aanhoudt, neem contact op met support.",
        variant: "destructive"
      });

      // Remove failed user message if it was added
      setMessages(prev => prev.filter(msg => msg.content !== userMessage || msg.role !== 'user'));
    } finally {
      setIsLoading(false);
    }
  };
  if (!user) {
    return <div className="flex items-center justify-center h-screen">Laden...</div>;
  }
  return <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar */}
        <Sidebar collapsible="icon">
          <SidebarContent>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <Link to="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/3544deff-46ae-4aca-a6bb-36d9729ebfa5.png" alt="Coenverzekerd" className="h-8" />
              </Link>
              <Button className="w-full" variant="simon" onClick={handleNewChat}>
                <Plus className="h-4 w-4 mr-2" />
                <span>Nieuwe chat</span>
              </Button>
            </div>

            {/* Conversations */}
            <div className="flex-1 p-4">
              <div className="mb-4">
                <h2 className="text-sm font-medium text-muted-foreground mb-2">Je gesprekken</h2>
              </div>
              
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {conversations.map(conv => <Card key={conv.id} className={`group p-3 hover:bg-accent cursor-pointer transition-colors relative ${activeConversation?.id === conv.id ? 'bg-accent border-simon-green' : ''}`} onClick={() => handleConversationClick(conv)}>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <p className="text-sm line-clamp-2 flex-1">{conv.title}</p>
                        <Button size="sm" variant="ghost" onClick={e => handleDeleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground absolute right-2 top-2">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>)}
                </div>
              </ScrollArea>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start" 
                onClick={() => navigate('/dashboard/settings')}
              >
                <Settings className="h-4 w-4 mr-2" />
                <span>Instellingen</span>
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-screen">
        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="mr-2" />
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-simon-green text-white">CA</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">Coen A.I+</h2>
                <p className="text-sm text-muted-foreground">{activeConversation?.title || "Verzekering RAG Assistent"}</p>
              </div>
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
              <ProfileDropdown />
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
                    line_of_business: value || undefined 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Verzekeringssoort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle soorten</SelectItem>
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
                    insurer: value || undefined 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Verzekeraar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle verzekeraars</SelectItem>
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

        {/* Client Selection and Intake */}
        {showIntake ? <div className="flex-1 flex items-center justify-center p-4 font-normal">
            <IntakeQuestionnaire onComplete={handleIntakeComplete} onSkip={handleIntakeSkip} onSaveAsClient={handleSaveAsClient} />
          </div> : <>
            {/* Client Selector */}
            <Collapsible open={clientPanelOpen} onOpenChange={setClientPanelOpen}>
              <div className="p-3 border-b border-border bg-card flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Klantopties</span>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label={clientPanelOpen ? "Verberg klantopties" : "Toon klantopties"}>
                    {clientPanelOpen ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="p-4 border-b border-border bg-card">
                  <ClientSelector selectedClient={selectedClient} onClientSelect={handleClientSelect} />
                  {!selectedClient && !intakeData && (
                    <Button onClick={handleStartChat} variant="outline" className="w-full mb-4">
                      Start Gesprek (met intake)
                    </Button>
                  )}
                  {!selectedClient && !intakeData && messages.length > 0 && (
                    <div className="flex gap-2">
                      <Button onClick={() => setShowSaveDialog(true)} variant="outline" size="sm" className="flex-1">
                        <Save className="mr-2 h-4 w-4" />
                        Opslaan als Klant
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6 max-w-4xl">
                 {messages.map(msg => <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     {msg.role === 'assistant' && <Avatar className="h-8 w-8 mt-1">
                          <AvatarFallback className="bg-simon-green text-white text-xs">CA</AvatarFallback>
                       </Avatar>}
                     <div className="flex flex-col max-w-2xl">
                        <Card className={`p-4 ${msg.role === 'user' ? 'bg-simon-green text-white' : 'bg-muted'}`}>
                          {msg.role === 'assistant' ? (
                            <>
                              <div className="text-sm font-medium prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                              
                              {/* Citations */}
                              {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/30">
                                  <p className="text-xs font-medium mb-2 opacity-70">Bronnen:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {msg.citations.map((citation, index) => (
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
                            </>
                          ) : (
                            <p className="whitespace-pre-line text-sm font-medium">{msg.content}</p>
                          )}
                        </Card>
                       {msg.role === 'assistant' && (
                         <MessageFeedback messageId={msg.id} className="mt-2 ml-2" />
                       )}
                     </div>
                     {msg.role === 'user' && <Avatar className="h-8 w-8 mt-1">
                         <AvatarFallback>VB</AvatarFallback>
                       </Avatar>}
                   </div>)}
                {isLoading && <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-simon-green text-white text-xs">CA</AvatarFallback>
                    </Avatar>
                    <Card className="p-4 max-w-2xl bg-muted">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-simon-green"></div>
                        <span className="text-sm text-muted-foreground">Zoeken in verzekeringsdocumenten...</span>
                      </div>
                    </Card>
                  </div>}
              </div>
            </ScrollArea>
          </>}

        {/* Save Client Dialog */}
        <SaveClientDialog isOpen={showSaveDialog} onClose={() => setShowSaveDialog(false)} onSaved={handleClientSaved} initialData={intakeData} conversationSummary={messages.filter(msg => msg.role === 'user' || msg.role === 'assistant').map(msg => `${msg.role === 'user' ? 'Klant' : 'Coen'}: ${msg.content}`).join('\n\n')} />

        {/* Input Area - Hidden during intake */}
        {!showIntake && <div className="p-4 border-t border-border bg-card">
            <div className="flex gap-2 max-w-4xl">
              <div className="flex-1 relative">
                <Textarea 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  placeholder="Beschrijf je klant situatie of stel een vraag over verzekeringen..." 
                  onKeyPress={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }} 
                  disabled={isLoading} 
                  rows={1}
                  className="min-h-[40px] max-h-32 resize-none pr-12" 
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleSendMessage} 
                  disabled={isLoading || !message.trim()} 
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-simon-green hover:text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 max-w-4xl">
              Coen gebruikt actuele polisvoorwaarden om je vragen te beantwoorden. Controleer belangrijke informatie altijd bij de verzekeraar.
            </p>
          </div>}
      </div>
      </div>
    </SidebarProvider>;
};
export default Chat;