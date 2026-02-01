import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin,
  Building2,
  FileText,
  Plus,
  Loader2,
  Lock,
  Edit
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useClient, useClientInvoices } from '@/hooks/use-clients';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-blue-500/10 text-blue-600',
  sent: 'bg-amber-500/10 text-amber-600',
  viewed: 'bg-purple-500/10 text-purple-600',
  paid: 'bg-emerald-500/10 text-emerald-600',
  voided: 'bg-destructive/10 text-destructive',
  credited: 'bg-orange-500/10 text-orange-600',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading: clientLoading } = useClient(id);
  const { data: invoices, isLoading: invoicesLoading } = useClientInvoices(id);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatAddress = (address: Record<string, unknown> | null) => {
    if (!address) return null;
    const parts = [address.street, address.city, address.state, address.postal_code, address.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Check if client has any issued invoices (for edit lock)
  const hasIssuedInvoices = invoices?.some(inv => inv.status !== 'draft') || false;

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Client Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">This client doesn't exist or you don't have access.</p>
            <Button onClick={() => navigate('/clients')}>Back to Clients</Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{client.name}</h1>
            {client.tax_id && (
              <p className="text-muted-foreground font-mono text-sm">{client.tax_id}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {hasIssuedInvoices ? (
            <Button variant="outline" disabled>
              <Lock className="h-4 w-4 mr-2" />
              Edit Locked
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate(`/clients/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Client
            </Button>
          )}
          <Button onClick={() => navigate(`/invoices/new?client=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Edit Lock Notice */}
      {hasIssuedInvoices && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="flex items-center gap-4 py-4">
            <Lock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Client profile locked</p>
              <p className="text-sm text-muted-foreground">
                This client has issued invoices and cannot be edited for compliance reasons.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Profile */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {client.client_type === 'individual' ? (
                  <>
                    <Building2 className="h-4 w-4" />
                    Individual
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    Company
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.contact_person && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Contact:</span> {client.contact_person}
                  </span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{formatAddress(client.address as Record<string, unknown>)}</span>
                </div>
              )}
              {!client.email && !client.phone && !client.address && !client.contact_person && (
                <p className="text-muted-foreground text-sm">No contact information available</p>
              )}
            </CardContent>
          </Card>

          {/* Tax & Compliance Card */}
          {(client.tax_id || client.cac_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tax & Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.tax_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">TIN</p>
                    <p className="font-mono text-sm">{client.tax_id}</p>
                  </div>
                )}
                {client.cac_number && (
                  <div>
                    <p className="text-xs text-muted-foreground">CAC Number</p>
                    <p className="font-mono text-sm">{client.cac_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Invoice History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice History
              </CardTitle>
              <CardDescription>
                {invoices?.length || 0} invoice{invoices?.length !== 1 ? 's' : ''} for this client
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invoices && invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow 
                        key={invoice.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[invoice.status]}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(invoice.total_amount), invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No invoices yet for this client</p>
                  <Button onClick={() => navigate(`/invoices/new?client=${id}`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
