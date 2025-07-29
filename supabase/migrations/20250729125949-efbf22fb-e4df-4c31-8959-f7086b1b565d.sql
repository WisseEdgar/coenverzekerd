-- Add foreign key constraint between message_feedback and messages
ALTER TABLE public.message_feedback 
ADD CONSTRAINT fk_message_feedback_message_id 
FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;