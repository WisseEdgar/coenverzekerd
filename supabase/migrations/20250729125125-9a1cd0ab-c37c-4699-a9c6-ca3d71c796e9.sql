-- Create message_feedback table to store user reactions/feedback
CREATE TABLE public.message_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helpful', 'unhelpful', 'thumbs_up', 'thumbs_down')),
  additional_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for message feedback
CREATE POLICY "Users can view feedback on messages from their conversations" 
ON public.message_feedback 
FOR SELECT 
USING (
  message_id IN (
    SELECT m.id FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create feedback on messages from their conversations" 
ON public.message_feedback 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  message_id IN (
    SELECT m.id FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own feedback" 
ON public.message_feedback 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" 
ON public.message_feedback 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_message_feedback_updated_at
BEFORE UPDATE ON public.message_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();