import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, MessageCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { useSupportTickets, TICKET_STATUSES, TICKET_CATEGORIES } from '@/hooks/use-support-tickets';
import { SupportTicketForm } from '@/components/support/SupportTicketForm';

export default function Support() {
  const { businessId } = useParams<{ businessId: string }>();
  const { data: tickets, isLoading } = useSupportTickets();

  const baseUrl = `/b/${businessId}`;

  const openTickets = tickets?.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting') || [];
  const resolvedTickets = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">
            Get help from our team. We typically respond within 24 hours.
          </p>
        </div>
        <SupportTicketForm />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tickets?.filter(t => t.status === 'in_progress').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Being handled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedTickets.length}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tickets</CardTitle>
          <CardDescription>
            View and manage your support requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !tickets || tickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tickets yet</h3>
              <p className="text-muted-foreground mb-4">
                Need help? Create a support ticket and we'll get back to you.
              </p>
              <SupportTicketForm />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const status = TICKET_STATUSES.find(s => s.value === ticket.status);
                  const category = TICKET_CATEGORIES.find(c => c.value === ticket.category);

                  return (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div className="font-medium">{ticket.subject}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {ticket.description.slice(0, 60)}...
                        </div>
                      </TableCell>
                      <TableCell>{category?.label}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-white', status?.color)}>
                          {status?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ticket.priority === 'urgent' || ticket.priority === 'high'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`${baseUrl}/support/${ticket.id}`}>View</Link>
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
    </div>
  );
}
