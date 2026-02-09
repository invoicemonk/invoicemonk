import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface SupportTicket {
  id: string;
  userId: string;
  businessId: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  attachments: string[];
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  isAdmin: boolean;
  message: string;
  attachments: string[];
  createdAt: string;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  category?: string;
  priority?: string;
  businessId?: string;
  attachments?: string[];
}

export interface CreateMessageInput {
  ticketId: string;
  message: string;
  attachments?: string[];
}

export const TICKET_CATEGORIES = [
  { value: 'general', label: 'General Question' },
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'account', label: 'Account Help' },
] as const;

export const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export const TICKET_STATUSES = [
  { value: 'open', label: 'Open', color: 'bg-yellow-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'waiting', label: 'Waiting on User', color: 'bg-orange-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
] as const;

// Fetch user's tickets
export function useSupportTickets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-tickets', user?.id],
    queryFn: async (): Promise<SupportTicket[]> => {
      if (!user) throw new Error('Not authenticated');

      // CRITICAL: Filter by user_id for defense in depth (RLS also enforces)
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((ticket) => ({
        id: ticket.id,
        userId: ticket.user_id,
        businessId: ticket.business_id,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        attachments: ticket.attachments || [],
        assignedTo: ticket.assigned_to,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        resolvedAt: ticket.resolved_at,
      }));
    },
    enabled: !!user,
  });
}

// Fetch single ticket with messages
export function useSupportTicket(ticketId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async (): Promise<{ ticket: SupportTicket; messages: SupportTicketMessage[] }> => {
      if (!user || !ticketId) throw new Error('Not authenticated or missing ticket ID');

      // CRITICAL: Filter by user_id for ownership verification (defense in depth)
      const { data: ticketData, error: ticketError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('user_id', user.id)
        .single();

      if (ticketError) throw ticketError;

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      return {
        ticket: {
          id: ticketData.id,
          userId: ticketData.user_id,
          businessId: ticketData.business_id,
          subject: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category,
          priority: ticketData.priority,
          status: ticketData.status,
          attachments: ticketData.attachments || [],
          assignedTo: ticketData.assigned_to,
          createdAt: ticketData.created_at,
          updatedAt: ticketData.updated_at,
          resolvedAt: ticketData.resolved_at,
        },
        messages: (messagesData || []).map((msg) => ({
          id: msg.id,
          ticketId: msg.ticket_id,
          senderId: msg.sender_id,
          isAdmin: msg.is_admin,
          message: msg.message,
          attachments: msg.attachments || [],
          createdAt: msg.created_at,
        })),
      };
    },
    enabled: !!user && !!ticketId,
  });
}

// Create new ticket
export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          business_id: input.businessId || null,
          subject: input.subject,
          description: input.description,
          category: input.category || 'general',
          priority: input.priority || 'normal',
          attachments: input.attachments || [],
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger email notification to admins (in-app notification created by DB trigger)
      try {
        await supabase.functions.invoke('send-support-notification', {
          body: { type: 'ticket_created', ticket_id: data.id }
        });
      } catch (emailError) {
        console.error('Failed to send support notification email:', emailError);
        // Don't fail the mutation if email fails
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({
        title: 'Ticket created',
        description: 'Our support team will respond shortly.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create ticket',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Add message to ticket
export function useAddTicketMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateMessageInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: input.ticketId,
          sender_id: user.id,
          is_admin: false,
          message: input.message,
          attachments: input.attachments || [],
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger email notification to admins (in-app notification created by DB trigger)
      if (data) {
        try {
          await supabase.functions.invoke('send-support-notification', {
            body: { type: 'user_reply', ticket_id: input.ticketId, message_id: data.id }
          });
        } catch (emailError) {
          console.error('Failed to send user reply notification email:', emailError);
          // Don't fail the mutation if email fails
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      toast({
        title: 'Message sent',
        description: 'Your message has been added to the ticket.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update ticket status (for admins)
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const updates: Record<string, any> = { status };
      
      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      toast({
        title: 'Ticket updated',
        description: 'Status has been changed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update ticket',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Count open tickets (for badges)
export function useOpenTicketCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['support-tickets-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user) return 0;

      // CRITICAL: Filter by user_id for defense in depth
      const { count, error } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress', 'waiting']);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });
}
