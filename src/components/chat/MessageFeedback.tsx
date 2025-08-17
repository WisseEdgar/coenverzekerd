import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

interface MessageFeedbackProps {
  messageId: string;
  className?: string;
}

interface Feedback {
  id: string;
  feedback_type: 'helpful' | 'unhelpful' | 'thumbs_up' | 'thumbs_down';
  additional_feedback?: string | null;
}

type FeedbackFromDB = {
  id: string;
  message_id: string;
  user_id: string;
  feedback_type: string;
  additional_feedback: string | null;
  created_at: string;
  updated_at: string;
}

const MessageFeedback = ({ messageId, className = "" }: MessageFeedbackProps) => {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalFeedback, setAdditionalFeedback] = useState("");
  const [showAdditionalFeedback, setShowAdditionalFeedback] = useState(false);
  const { toast } = useToast();

  // Load existing feedback on mount
  useEffect(() => {
    loadFeedback();
  }, [messageId]);

  const loadFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('message_feedback')
        .select('*')
        .eq('message_id', messageId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const feedback: Feedback = {
          id: data.id,
          feedback_type: data.feedback_type as 'helpful' | 'unhelpful' | 'thumbs_up' | 'thumbs_down',
          additional_feedback: data.additional_feedback
        };
        setFeedback(feedback);
        setAdditionalFeedback(data.additional_feedback || "");
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  };

  const handleFeedback = async (type: 'thumbs_up' | 'thumbs_down') => {
    setIsLoading(true);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      if (feedback) {
        // Update existing feedback
        const { error } = await supabase
          .from('message_feedback')
          .update({ 
            feedback_type: type,
            additional_feedback: additionalFeedback || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', feedback.id);

        if (error) throw error;
      } else {
        // Create new feedback
        const { data, error } = await supabase
          .from('message_feedback')
          .insert({
            message_id: messageId,
            user_id: user.user.id,
            feedback_type: type,
            additional_feedback: additionalFeedback || null
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const newFeedback: Feedback = {
            id: data.id,
            feedback_type: data.feedback_type as 'helpful' | 'unhelpful' | 'thumbs_up' | 'thumbs_down',
            additional_feedback: data.additional_feedback
          };
          setFeedback(newFeedback);
        }
      }

      setFeedback(prev => prev ? { ...prev, feedback_type: type } : null);
      
      toast({
        title: "Feedback opgeslagen",
        description: "Bedankt voor je feedback!"
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Fout bij opslaan feedback",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setShowAdditionalFeedback(false);
    }
  };

  const handleAdditionalFeedbackSave = async () => {
    if (!feedback) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('message_feedback')
        .update({ 
          additional_feedback: additionalFeedback || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', feedback.id);

      if (error) throw error;

      setFeedback(prev => prev ? { ...prev, additional_feedback: additionalFeedback } : null);
      
      toast({
        title: "Feedback bijgewerkt",
        description: "Je extra feedback is opgeslagen."
      });
      
      setShowAdditionalFeedback(false);
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        title: "Fout bij bijwerken feedback",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        size="sm"
        variant={feedback?.feedback_type === 'thumbs_up' ? 'default' : 'ghost'}
        onClick={() => handleFeedback('thumbs_up')}
        disabled={isLoading}
        className="h-7 w-7 p-0 hover:bg-accent"
      >
        <ThumbsUp className={`h-3 w-3 ${feedback?.feedback_type === 'thumbs_up' ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
      </Button>
      
      <Button
        size="sm"
        variant={feedback?.feedback_type === 'thumbs_down' ? 'default' : 'ghost'}
        onClick={() => handleFeedback('thumbs_down')}
        disabled={isLoading}
        className="h-7 w-7 p-0 hover:bg-accent"
      >
        <ThumbsDown className={`h-3 w-3 ${feedback?.feedback_type === 'thumbs_down' ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
      </Button>

      <Popover open={showAdditionalFeedback} onOpenChange={setShowAdditionalFeedback}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-accent"
          >
            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Extra feedback</h4>
            <Textarea
              placeholder="Deel je gedachten over dit antwoord..."
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAdditionalFeedback(false)}
              >
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={handleAdditionalFeedbackSave}
                disabled={isLoading}
              >
                Opslaan
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageFeedback;