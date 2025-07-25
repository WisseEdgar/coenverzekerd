import { useState } from "react";
import { Plus, Send, Settings, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [conversations] = useState([
    "Klant matching voor auto verzekering",
    "Voorwaarden vergelijken woonverzekering", 
    "Zakelijke verzekering advies",
    "Rechtsbijstand polis analyse",
    "Pensioen verzekering matching",
    "Zorgverzekering optimalisatie"
  ]);

  const [currentChat] = useState([
    {
      type: "user",
      content: "Ik heb een klant van 35 jaar met een Tesla Model 3. Hij wil een autoverzekering met uitgebreide dekking en no-claim bescherming. Wat zijn de beste opties?"
    },
    {
      type: "assistant", 
      content: "Ik kan je helpen met het vinden van de beste autoverzekering voor je klant. Op basis van de Tesla Model 3 en de gewenste uitgebreide dekking, zijn hier de top matches:\n\n1. **Allianz Direct All-Risk Plus** - Uitstekende dekking voor elektrische voertuigen met speciale accu garantie\n2. **ANWB Royaal Pakket** - Inclusief pechhulp en vervangend vervoer, ideaal voor Tesla\n3. **Nationale Nederlanden Premium** - Goede no-claim regeling en schadevrije jaren bescherming\n\nWil je dat ik de specifieke voorwaarden en prijzen voor deze opties opzoek?"
    },
    {
      type: "user",
      content: "Ja graag, en let vooral op de dekking voor de accu en laadpaal thuis"
    }
  ]);

  const handleSendMessage = () => {
    if (message.trim()) {
      // Here you would typically send the message to your AI service
      setMessage("");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-6 w-6 text-simon-green" />
            <h1 className="text-xl font-bold">SIMON A.I</h1>
          </div>
          <Button className="w-full" variant="simon">
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe chat
          </Button>
        </div>

        {/* Conversations */}
        <div className="flex-1 p-4">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Je gesprekken</h2>
            <Button variant="ghost" size="sm" className="text-simon-blue hover:text-simon-blue-light">
              Wis alles
            </Button>
          </div>
          
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {conversations.map((conv, index) => (
                <Card key={index} className="p-3 hover:bg-accent cursor-pointer transition-colors">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <p className="text-sm line-clamp-2">{conv}</p>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Afgelopen 7 dagen
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Instellingen
          </Button>
          <div className="flex items-center gap-2 mt-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>VB</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">Verzekering Bot</span>
          </div>
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
              <p className="text-sm text-muted-foreground">Verzekering Matching Assistent</p>
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
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="pr-12"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSendMessage}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-simon-green hover:text-white"
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