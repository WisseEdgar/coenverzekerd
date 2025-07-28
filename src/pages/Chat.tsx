import { useState, useEffect } from "react";
import { Plus, Send, Settings, MessageSquare, X, BarChart3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ClientSelector from "@/components/chat/ClientSelector";
import IntakeQuestionnaire from "@/components/chat/IntakeQuestionnaire";
import SaveClientDialog from "@/components/chat/SaveClientDialog";
import { ProfileDropdown } from "@/components/layout/ProfileDropdown";
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
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
  const {
    toast
  } = useToast();

  // Check auth and load conversations on mount
  useEffect(() => {
    checkAuth();
  }, []);
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
        // Add welcome message if conversation is empty
        await addWelcomeMessage(conversation.id);
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
    let welcomeContent = "Hallo! Ik ben Simon A.I+, je persoonlijke verzekering matching assistent.";
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

      // Prepare conversation history for API (exclude welcome messages)
      const conversationHistory = updatedMessages.filter(msg => !(msg.role === "assistant" && msg.content.includes("Hallo! Ik ben Simon A.I+"))).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call Simon AI with client context
      const {
        data: aiData,
        error: aiError
      } = await supabase.functions.invoke('simon-chat', {
        body: {
          message: userMessage,
          conversationHistory: conversationHistory,
          clientProfile: selectedClient,
          intakeData: intakeData
        }
      });
      if (aiError) throw aiError;

      // Add AI response to database
      const {
        data: aiMessageData,
        error: aiMessageError
      } = await supabase.from('messages').insert({
        conversation_id: activeConversation.id,
        role: 'assistant',
        content: aiData.response
      }).select().single();
      if (aiMessageError) throw aiMessageError;

      // Update local messages
      setMessages(prev => [...prev, aiMessageData as Message]);
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
                <BarChart3 className="h-8 w-8 text-simon-green bg-slate-50" />
                <span className="text-xl font-bold text-simon-blue">Simon</span>
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
              <Button variant="ghost" size="sm" className="w-full justify-start">
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
                <AvatarFallback className="bg-simon-green text-white">SA</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">Simon A.I+</h2>
                <p className="text-sm text-muted-foreground">{activeConversation?.title || "Verzekering Matching Assistent"}</p>
              </div>
            </div>
            <ProfileDropdown />
          </div>
        </div>

        {/* Client Selection and Intake */}
        {showIntake ? <div className="flex-1 flex items-center justify-center p-4 font-normal">
            <IntakeQuestionnaire onComplete={handleIntakeComplete} onSkip={handleIntakeSkip} onSaveAsClient={handleSaveAsClient} />
          </div> : <>
            {/* Client Selector */}
            <div className="p-4 border-b border-border bg-card">
              <ClientSelector selectedClient={selectedClient} onClientSelect={handleClientSelect} />
              {!selectedClient && !intakeData && <Button onClick={handleStartChat} variant="outline" className="w-full mt-4">
                  Start Gesprek (met intake)
                </Button>}
              {!selectedClient && !intakeData && messages.length > 0 && <div className="flex gap-2 mt-4">
                  <Button onClick={() => setShowSaveDialog(true)} variant="outline" size="sm" className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    Opslaan als Klant
                  </Button>
                </div>}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6 max-w-4xl">
                {messages.map(msg => <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-simon-green text-white text-xs">SA</AvatarFallback>
                      </Avatar>}
                    <Card className={`p-4 max-w-2xl ${msg.role === 'user' ? 'bg-simon-green text-white' : 'bg-muted'}`}>
                      <p className="whitespace-pre-line text-sm font-medium">{msg.content}</p>
                    </Card>
                    {msg.role === 'user' && <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback>VB</AvatarFallback>
                      </Avatar>}
                  </div>)}
                {isLoading && <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-simon-green text-white text-xs">SA</AvatarFallback>
                    </Avatar>
                    <Card className="p-4 max-w-2xl bg-muted">
                      <p className="text-sm text-muted-foreground">Simon denkt na...</p>
                    </Card>
                  </div>}
              </div>
            </ScrollArea>
          </>}

        {/* Save Client Dialog */}
        <SaveClientDialog isOpen={showSaveDialog} onClose={() => setShowSaveDialog(false)} onSaved={handleClientSaved} initialData={intakeData} conversationSummary={messages.filter(msg => msg.role === 'user' || msg.role === 'assistant').map(msg => `${msg.role === 'user' ? 'Klant' : 'Simon'}: ${msg.content}`).join('\n\n')} />

        {/* Input Area - Hidden during intake */}
        {!showIntake && <div className="p-4 border-t border-border bg-card">
            <div className="flex gap-2 max-w-4xl">
              <div className="flex-1 relative">
                <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Beschrijf je klant situatie of stel een vraag over verzekeringen..." onKeyPress={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()} disabled={isLoading} className="pr-12" />
                <Button size="sm" variant="ghost" onClick={handleSendMessage} disabled={isLoading || !message.trim()} className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-simon-green hover:text-white disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 max-w-4xl">
              Simon kan fouten maken. Controleer belangrijke informatie altijd bij de verzekeraar.
            </p>
          </div>}
      </div>
      </div>
    </SidebarProvider>;
};
export default Chat;