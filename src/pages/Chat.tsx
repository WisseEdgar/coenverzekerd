import { useState } from "react";
import { Plus, Send, Settings, MessageSquare, Clock, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string>("default");
  const { toast } = useToast();

  // Store conversations with their chat history
  const [conversations, setConversations] = useState<{[key: string]: {
    id: string;
    title: string;
    messages: Array<{type: string; content: string}>;
    lastUpdated: Date;
  }}>({
    default: {
      id: "default",
      title: "Nieuwe chat",
      messages: [
        {
          type: "assistant", 
          content: "Hallo! Ik ben Simon A.I+, je persoonlijke verzekering matching assistent. Beschrijf de situatie van je klant en ik help je de beste verzekeringopties te vinden. Wat kan ik voor je doen?"
        }
      ],
      lastUpdated: new Date()
    }
  });

  // Get current chat messages
  const currentChat = conversations[activeConversationId]?.messages || [];
  const setCurrentChat = (messages: Array<{type: string; content: string}>) => {
    setConversations(prev => ({
      ...prev,
      [activeConversationId]: {
        ...prev[activeConversationId],
        messages,
        lastUpdated: new Date()
      }
    }));
  };

  const generateConversationTitle = (firstMessage: string) => {
    // Generate a title from the first user message, max 40 characters
    return firstMessage.length > 40 ? firstMessage.substring(0, 40) + "..." : firstMessage;
  };

  const handleNewChat = () => {
    const newId = `chat_${Date.now()}`;
    const newConversation = {
      id: newId,
      title: "Nieuwe chat",
      messages: [
        {
          type: "assistant", 
          content: "Hallo! Ik ben Simon A.I+, je persoonlijke verzekering matching assistent. Beschrijf de situatie van je klant en ik help je de beste verzekeringopties te vinden. Wat kan ik voor je doen?"
        }
      ],
      lastUpdated: new Date()
    };

    setConversations(prev => ({
      ...prev,
      [newId]: newConversation
    }));
    setActiveConversationId(newId);
    setMessage("");
  };

  const handleConversationClick = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setMessage("");
  };

  const handleDeleteConversation = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the conversation click
    
    if (conversationId === "default") {
      // Reset default conversation instead of deleting
      setConversations(prev => ({
        ...prev,
        default: {
          id: "default",
          title: "Nieuwe chat",
          messages: [
            {
              type: "assistant", 
              content: "Hallo! Ik ben Simon A.I+, je persoonlijke verzekering matching assistent. Beschrijf de situatie van je klant en ik help je de beste verzekeringopties te vinden. Wat kan ik voor je doen?"
            }
          ],
          lastUpdated: new Date()
        }
      }));
    } else {
      // Delete the conversation
      setConversations(prev => {
        const { [conversationId]: deleted, ...remaining } = prev;
        return remaining;
      });
      
      // If the deleted conversation was active, switch to default
      if (activeConversationId === conversationId) {
        setActiveConversationId("default");
      }
    }
  };

    const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    setIsLoading(true);

    // Add user message to chat
    const newUserMessage = { type: "user", content: userMessage };
    const updatedMessages = [...currentChat, newUserMessage];
    setCurrentChat(updatedMessages);

    // Update conversation title if this is the first user message
    const currentConv = conversations[activeConversationId];
    if (currentConv && currentConv.title === "Nieuwe chat" && currentConv.messages.length === 1) {
      setConversations(prev => ({
        ...prev,
        [activeConversationId]: {
          ...prev[activeConversationId],
          title: generateConversationTitle(userMessage)
        }
      }));
    }

    try {
      // Prepare conversation history for API (exclude the welcome message for API)
      const conversationHistory = updatedMessages
        .filter(msg => !(msg.type === "assistant" && msg.content.includes("Hallo! Ik ben Simon A.I+")))
        .map(msg => ({
          role: msg.type === "user" ? "user" : "assistant",
          content: msg.content
        }));

      const { data, error } = await supabase.functions.invoke('simon-chat', {
        body: {
          message: userMessage,
          conversationHistory: conversationHistory
        }
      });

      if (error) {
        throw error;
      }

      // Add AI response to chat
      const aiMessage = { type: "assistant", content: data.response };
      setCurrentChat([...updatedMessages, aiMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Er is iets misgegaan",
        description: "Probeer het opnieuw. Als het probleem aanhoudt, neem contact op met support.",
        variant: "destructive",
      });
      
      // Remove user message if API call failed
      setCurrentChat(currentChat);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-8 w-8 text-simon-green bg-slate-50" />
            <h1 className="text-xl font-bold text-simon-blue">Simon</h1>
          </div>
          <Button className="w-full" variant="simon" onClick={handleNewChat}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe chat
          </Button>
        </div>

        {/* Conversations */}
        <div className="flex-1 p-4">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Je gesprekken</h2>
          </div>
          
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {Object.values(conversations)
                .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
                .map((conv) => (
                <Card 
                  key={conv.id} 
                  className={`group p-3 hover:bg-accent cursor-pointer transition-colors relative ${
                    activeConversationId === conv.id ? 'bg-accent border-simon-green' : ''
                  }`}
                  onClick={() => handleConversationClick(conv.id)}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <p className="text-sm line-clamp-2 flex-1">{conv.title}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground absolute right-2 top-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Instellingen
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-simon-green text-white">SA</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">Simon A.I+</h2>
              <p className="text-sm text-muted-foreground">{conversations[activeConversationId]?.title || "Verzekering Matching Assistent"}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 max-w-4xl">
            {currentChat.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.type === 'assistant' && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-simon-green text-white text-xs">SA</AvatarFallback>
                  </Avatar>
                )}
                <Card className={`p-4 max-w-2xl ${msg.type === 'user' ? 'bg-simon-green text-white' : 'bg-muted'}`}>
                  <p className="text-sm whitespace-pre-line">{msg.content}</p>
                </Card>
                {msg.type === 'user' && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback>VB</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-simon-green text-white text-xs">SA</AvatarFallback>
                </Avatar>
                <Card className="p-4 max-w-2xl bg-muted">
                  <p className="text-sm text-muted-foreground">Simon denkt na...</p>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2 max-w-4xl">
            <div className="flex-1 relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Beschrijf je klant situatie of stel een vraag over verzekeringen..."
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={isLoading}
                className="pr-12"
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
            Simon kan fouten maken. Controleer belangrijke informatie altijd bij de verzekeraar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;