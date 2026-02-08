-- Add foreign key from support_tickets.user_id to profiles.id
-- This enables Supabase's automatic join syntax for querying user emails
ALTER TABLE public.support_tickets
ADD CONSTRAINT support_tickets_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key from support_ticket_messages.sender_id to profiles.id
ALTER TABLE public.support_ticket_messages
ADD CONSTRAINT support_ticket_messages_sender_id_profiles_fkey 
FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;