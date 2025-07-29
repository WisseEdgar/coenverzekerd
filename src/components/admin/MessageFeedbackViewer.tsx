import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface FeedbackData {
  id: string;
  message_id: string;
  user_id: string;
  feedback_type: string;
  additional_feedback: string | null;
  created_at: string;
  updated_at: string;
  message_content?: string;
  conversation_title?: string;
}

export const MessageFeedbackViewer: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      
      // Get all feedback with related message and conversation data
      const { data, error } = await supabase
        .from('message_feedback')
        .select(`
          *,
          messages(
            content,
            conversation_id,
            conversations(title)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to flatten the structure
      const transformedData = data?.map((item: any) => ({
        id: item.id,
        message_id: item.message_id,
        user_id: item.user_id,
        feedback_type: item.feedback_type,
        additional_feedback: item.additional_feedback,
        created_at: item.created_at,
        updated_at: item.updated_at,
        message_content: item.messages?.content,
        conversation_title: item.messages?.conversations?.title
      })) || [];

      setFeedback(transformedData);
    } catch (error) {
      console.error('Error loading feedback:', error);
      toast({
        title: "Fout bij laden feedback",
        description: "Er is iets misgegaan bij het laden van de feedback data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFeedbackIcon = (type: string) => {
    switch (type) {
      case 'thumbs_up':
        return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case 'thumbs_down':
        return <ThumbsDown className="h-4 w-4 text-red-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getFeedbackBadgeVariant = (type: string) => {
    switch (type) {
      case 'thumbs_up':
        return 'default';
      case 'thumbs_down':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
        <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
        <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Message Feedback</h2>
          <p className="text-muted-foreground">
            Bekijk gebruikersfeedback op AI berichten ({feedback.length} reacties)
          </p>
        </div>
        <Button onClick={loadFeedback} variant="outline">
          Vernieuwen
        </Button>
      </div>

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Geen feedback gevonden</h3>
            <p className="text-muted-foreground">
              Er is nog geen feedback gegeven op berichten.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {feedback.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFeedbackIcon(item.feedback_type)}
                    <Badge variant={getFeedbackBadgeVariant(item.feedback_type)}>
                      {item.feedback_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.created_at).toLocaleString('nl-NL')}
                  </div>
                </div>
                <CardTitle className="text-base">
                  {item.conversation_title || 'Onbekende conversatie'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">AI Bericht:</h4>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    {item.message_content ? (
                      item.message_content.length > 200 
                        ? `${item.message_content.substring(0, 200)}...`
                        : item.message_content
                    ) : (
                      'Bericht niet beschikbaar'
                    )}
                  </div>
                </div>

                {item.additional_feedback && (
                  <div>
                    <h4 className="font-medium mb-2">Extra Feedback:</h4>
                    <div className="bg-muted/50 p-3 rounded-lg text-sm">
                      {item.additional_feedback}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">User ID:</span> {item.user_id}
                  </div>
                  <div>
                    <span className="font-medium">Message ID:</span> {item.message_id}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};