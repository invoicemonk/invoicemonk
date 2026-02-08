import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, MessageCircle, Search, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { TICKET_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/hooks/use-support-tickets';

interface AdminTicket {
  id: string;
  userId: string;
  userEmail?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminTicketMessage {
  id: string;
  senderId: string;
  isAdmin: boolean;
  message: string;
  createdAt: string;
}

export default function AdminSupport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<AdminTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  // Fetch all tickets for admin
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin-support-tickets', statusFilter],
    queryFn: async (): Promise<AdminTicket[]> => {
      let query = supabase
        .from('support_tickets' as any)
        .select('*, profiles:user_id(email)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        userEmail: t.profiles?.email,
        subject: t.subject,
        description: t.description,
        category: t.category,
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    },
    enabled: !!user,
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ['admin-ticket-messages', selectedTicket?.id],
    queryFn: async (): Promise<AdminTicketMessage[]> => {
      if (!selectedTicket) return [];

      const { data, error } = await supabase
        .from('support_ticket_messages' as any)
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        isAdmin: m.is_admin,
        message: m.message,
        createdAt: m.created_at,
      }));
    },
    enabled: !!selectedTicket,
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase
        .from('support_tickets' as any)
        .update({ status, resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      toast({ title: 'Status updated' });
    },
  });

  // Send reply mutation
  const sendReply = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('support_ticket_messages' as any)
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          is_admin: true,
          message,
        })
        .select()
        .single();

      if (error) throw error;
      const messageData = data as any;

      // Update ticket status to in_progress if it was open
      await supabase
        .from('support_tickets' as any)
        .update({ status: 'in_progress' })
        .eq('id', ticketId)
        .eq('status', 'open');

      // Trigger email notification to user (in-app notification created by DB trigger)
      try {
        await supabase.functions.invoke('send-support-notification', {
          body: { 
            type: 'admin_reply', 
            ticket_id: ticketId,
            message_id: messageData.id 
          }
        });
      } catch (emailError) {
        console.error('Failed to send support reply notification email:', emailError);
        // Don't fail the mutation if email fails
      }

      return messageData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-messages'] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
      setReplyMessage('');
      toast({ title: 'Reply sent' });
    },
  });

  const filteredTickets = tickets?.filter(t =>
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.userEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCount = tickets?.filter(t => t.status === 'open').length || 0;
  const inProgressCount = tickets?.filter(t => t.status === 'in_progress').length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
        <p className="text-muted-foreground">Manage and respond to user support requests</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{inProgressCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TICKET_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !filteredTickets?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tickets found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => {
                  const status = TICKET_STATUSES.find(s => s.value === ticket.status);
                  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);

                  return (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div className="font-medium">{ticket.subject}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {ticket.description.slice(0, 50)}...
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ticket.userEmail || 'Unknown'}
                      </TableCell>
                      <TableCell>{category?.label}</TableCell>
                      <TableCell>
                        <Badge variant={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'destructive' : 'secondary'}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-white', status?.color)}>
                          {status?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Sheet */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedTicket && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTicket.subject}</SheetTitle>
                <SheetDescription>
                  From: {selectedTicket.userEmail} · {format(new Date(selectedTicket.createdAt), 'MMM d, yyyy h:mm a')}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status Update */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Status:</span>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(value) => {
                      updateStatus.mutate({ ticketId: selectedTicket.id, status: value });
                      setSelectedTicket({ ...selectedTicket, status: value });
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Original Message */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Original Request</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                  </CardContent>
                </Card>

                {/* Message Thread */}
                {messages && messages.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Conversation</h4>
                    {messages.map((msg) => (
                      <Card key={msg.id} className={cn(msg.isAdmin && 'border-primary/30 bg-primary/5')}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {msg.isAdmin ? 'Support Team' : 'User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Send Reply</h4>
                    <Textarea
                      placeholder="Type your response..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={4}
                    />
                    <Button
                      onClick={() => sendReply.mutate({ ticketId: selectedTicket.id, message: replyMessage })}
                      disabled={!replyMessage.trim() || sendReply.isPending}
                    >
                      {sendReply.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Send Reply
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
