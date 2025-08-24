import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, User, Bot, Settings, Filter, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CitationPill } from './CitationPill';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface Citation {
  label: string;
  source_id?: string;
  page?: number;
  section_path?: string;
  confidence?: number;
}

interface SearchFilters {
  line_of_business?: string;
  insurer?: string;
  document_type?: string;
}

interface PipelineStats {
  initial_search: number;
  mmr_results: number;
  reranked_results: number;
  final_results: number;
}

import { INSURANCE_LINES, INSURERS } from '@/lib/insuranceTypes';

export function EnhancedInsuranceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [useEnhancedPipeline, setUseEnhancedPipeline] = useState(true);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const generateResponse = useCallback(async (userQuery: string) => {
    try {
      setIsLoading(true);

      const functionName = useEnhancedPipeline ? 'enhanced-search' : 'search-insurance-enhanced';
      
      const requestBody = useEnhancedPipeline ? {
        query: userQuery,
        filters: searchFilters,
        topN: 100,
        mmrK: 24,
        lambda: 0.7,
        topK: 8,
        tokenLimit: 2200,
        useStitching: true,
        useReranking: true
      } : {
        query: userQuery,
        filters: searchFilters
      };

      console.log(`Using ${functionName} with body:`, requestBody);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody
      });

      if (error) {
        throw new Error(error.message);
      }

      const { results, pipeline_stats } = data;
      
      // Set pipeline stats for enhanced pipeline
      if (pipeline_stats) {
        setPipelineStats(pipeline_stats);
      }

      if (!results || results.length === 0) {
        const noResultsMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Ik kon geen relevante informatie vinden in de beschikbare polisdocumenten. Kun je je vraag specifieker formuleren of andere zoektermen gebruiken?',
          citations: [],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, noResultsMessage]);
        return;
      }

      // Generate AI response using chat-answer function
      const { data: answerData, error: answerError } = await supabase.functions.invoke('chat-answer', {
        body: {
          query: userQuery,
          filters: searchFilters,
          userContext: null,
          maxResults: results.length
        }
      });

      if (answerError) {
        throw new Error(answerError.message);
      }

      const citations: Citation[] = results.map((result: any) => ({
        label: result.citation_label || `${result.insurer_name} ${result.product_name}`,
        source_id: result.document_id,
        page: result.page,
        section_path: result.section_path,
        confidence: result.similarity
      }));

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: answerData.answer || 'Er is een probleem opgetreden bij het genereren van het antwoord.',
        citations,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      toast({
        title: "Antwoord gegenereerd",
        description: `Gevonden ${citations.length} relevante bronnen`,
      });

    } catch (error) {
      console.error('Error generating response:', error);
      toast({
        title: "Fout bij zoeken",
        description: error instanceof Error ? error.message : "Er is een onbekende fout opgetreden",
        variant: "destructive"
      });

      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, er is een fout opgetreden bij het verwerken van je vraag. Probeer het opnieuw.',
        citations: [],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [searchFilters, useEnhancedPipeline, toast]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    const query = currentMessage;
    setCurrentMessage('');

    await generateResponse(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPipelineStats(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Enhanced Insurance Assistant
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={useEnhancedPipeline ? "default" : "secondary"}>
                {useEnhancedPipeline ? "Enhanced Pipeline" : "Basic Pipeline"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseEnhancedPipeline(!useEnhancedPipeline)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
              >
                Clear
              </Button>
            </div>
          </div>
          
          {/* Pipeline Stats */}
          {pipelineStats && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Initial: {pipelineStats.initial_search}</span>
              <span>MMR: {pipelineStats.mmr_results}</span>
              <span>Reranked: {pipelineStats.reranked_results}</span>
              <span>Final: {pipelineStats.final_results}</span>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="rounded-none border-x-0 border-t-0">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="line-of-business">Verzekeringslijn</Label>
                <Select 
                  value={searchFilters.line_of_business || ""} 
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, line_of_business: value || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle lijnen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle lijnen</SelectItem>
                    {INSURANCE_LINES.map((line) => (
                      <SelectItem key={line} value={line}>{line}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="insurer">Verzekeraar</Label>
                <Select 
                  value={searchFilters.insurer || ""} 
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, insurer: value || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle verzekeraars" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle verzekeraars</SelectItem>
                    {INSURERS.map((insurer) => (
                      <SelectItem key={insurer} value={insurer}>{insurer}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="document-type">Document Type</Label>
                <Select 
                  value={searchFilters.document_type || ""} 
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, document_type: value || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alle types</SelectItem>
                    <SelectItem value="AVB">AVB</SelectItem>
                    <SelectItem value="Productinformatie">Productinformatie</SelectItem>
                    <SelectItem value="Voorwaarden">Voorwaarden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg mb-2">Welkom bij de Enhanced Insurance Assistant</p>
              <p>Stel een vraag over verzekeringen en ik help je met gedetailleerde informatie uit onze database.</p>
              <p className="text-sm mt-2">
                {useEnhancedPipeline ? "🚀 Enhanced pipeline actief: MMR diversiteit + cross-encoder reranking + section stitching" : "📋 Basic pipeline actief"}
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === 'assistant' ? '' : 'flex-row-reverse'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'assistant' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {message.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <Card className={`inline-block max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground ml-auto' 
                    : 'bg-muted'
                }`}>
                  <CardContent className="p-3">
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                    
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="text-xs text-muted-foreground mb-2">Bronnen:</div>
                        <div className="flex flex-wrap gap-1">
                          {message.citations.map((citation, index) => (
                            <CitationPill
                              key={index}
                              label={citation.label}
                              variant="outline"
                              onClick={() => {
                                toast({
                                  title: "Citatie",
                                  description: `${citation.label}${citation.page ? ` - Pagina ${citation.page}` : ''}`,
                                });
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <div className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <Card className="bg-muted">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Aan het zoeken en analyseren...
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <Card className="rounded-none border-x-0 border-b-0">
        <CardContent className="p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Stel een vraag over verzekeringen..."
              className="flex-1 min-h-[60px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isLoading}
              size="lg"
              className="px-6"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}