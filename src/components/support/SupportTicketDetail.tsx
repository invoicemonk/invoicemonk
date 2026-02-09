import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, Send, User, Headphones } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSupportTicket, useAddTicketMessage, TICKET_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/hooks/use-support-tickets';
import { useAuth } from '@/contexts/AuthContext';

export function SupportTicketDetail() {
  const { ticketId, businessId } = useParams<{ ticketId: string; businessId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useSupportTicket(ticketId || '');
  const addMessage = useAddTicketMessage();
  const [newMessage, setNewMessage] = useState('');

  const baseUrl = businessId ? `/b/${businessId}` : '';

  const handleSendMessage = async () => {
    if (!ticketId || !newMessage.trim()) return;

    await addMessage.mutateAsync({
      ticketId,
      message: newMessage.trim(),
    });

    setNewMessage('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found or access denied</p>
        <Button variant="link" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  // CRITICAL: Defense in depth - verify ownership even though query already filters
  if (data.ticket.userId !== user?.id) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-semibold text-destructive">Access Denied</p>
        <p className="text-muted-foreground mb-4">You don't have permission to view this ticket.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const { ticket, messages } = data;
  const status = TICKET_STATUSES.find(s => s.value === ticket.status);
  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);
  const priority = TICKET_PRIORITIES.find(p => p.value === ticket.priority);
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`${baseUrl}/support`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">
            Ticket #{ticket.id.slice(0, 8)} · Opened {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
        <Badge className={cn('text-white', status?.color)}>
          {status?.label}
        </Badge>
      </div>

      {/* Ticket Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category:</span>{' '}
                <span className="font-medium">{category?.label}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>{' '}
                <Badge variant={priority?.value === 'urgent' || priority?.value === 'high' ? 'destructive' : 'secondary'}>
                  {priority?.label}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      {/* Messages */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Conversation</h2>
        
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No replies yet. Our support team will respond shortly.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <Card
                key={msg.id}
                className={cn(
                  msg.isAdmin && 'border-primary/30 bg-primary/5'
                )}
              >
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                      msg.isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      {msg.isAdmin ? (
                        <Headphones className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {msg.isAdmin ? 'Support Team' : 'You'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reply Form */}
        {!isResolved && (
          <>
            <Separator />
            <div className="space-y-3">
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || addMessage.isPending}
                >
                  {addMessage.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Reply
                </Button>
              </div>
            </div>
          </>
        )}

        {isResolved && (
          <Card className="bg-muted/50">
            <CardContent className="py-4 text-center text-sm text-muted-foreground">
              This ticket has been {ticket.status}. If you need further assistance, please create a new ticket.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
