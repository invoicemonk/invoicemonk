import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Save,
  Send,
  ArrowLeft,
  Calculator,
  AlertCircle,
  Loader2,
  Lock,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useClients, useCreateClient } from '@/hooks/use-clients';
import { useInvoice, useUpdateInvoice, useIssueInvoice } from '@/hooks/use-invoices';
import { useInvoiceTemplates } from '@/hooks/use-invoice-templates';
import { useInvoiceLimitCheck, useSubscription } from '@/hooks/use-subscription';
import { useBusinessCurrency } from '@/hooks/use-business-currency';
import { useUserOrganizations } from '@/hooks/use-organization';
import { InvoiceLimitBanner } from '@/components/app/InvoiceLimitBanner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export default function InvoiceEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmailVerified = user?.email_confirmed_at;

  const { data: invoice, isLoading: invoiceLoading } = useInvoice(id);
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: templates } = useInvoiceTemplates();
  const { data: invoiceLimitCheck } = useInvoiceLimitCheck();
  const { isStarter } = useSubscription();
  const { data: organizations } = useUserOrganizations();
  const currentBusiness = organizations?.[0]?.business;
  const { data: businessCurrency } = useBusinessCurrency(currentBusiness?.id);
  const createClient = useCreateClient();
  const updateInvoice = useUpdateInvoice();
  const issueInvoice = useIssueInvoice();

  // Currency lock state
  const isCurrencyLocked = businessCurrency?.currency_locked || false;
  const lockedCurrency = businessCurrency?.default_currency;

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [currency, setCurrency] = useState('NGN');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Initialize form with invoice data
  useEffect(() => {
    if (invoice && !isInitialized) {
      setSelectedClientId(invoice.client_id);
      setSelectedTemplateId(invoice.template_id || '');
      setCurrency(invoice.currency);
      setIssueDate(invoice.issue_date || new Date().toISOString().split('T')[0]);
      setDueDate(invoice.due_date || '');
      setNotes(invoice.notes || '');
      setTerms(invoice.terms || '');
      
      if (invoice.invoice_items && invoice.invoice_items.length > 0) {
        setItems(invoice.invoice_items.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          taxRate: item.tax_rate,
        })));
      } else {
        setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]);
      }
      setIsInitialized(true);
    }
  }, [invoice, isInitialized]);

  // Redirect if not a draft
  useEffect(() => {
    if (invoice && invoice.status !== 'draft') {
      toast({
        title: 'Cannot edit',
        description: 'Only draft invoices can be edited.',
        variant: 'destructive',
      });
      navigate(`/invoices/${id}`);
    }
  }, [invoice, id, navigate]);

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, taxRate: 0 }
    ]);
  };

  const removeItem = (itemId: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== itemId));
    }
  };

  const updateItem = (itemId: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      return sum + (lineTotal * item.taxRate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const formatCurrency = (amount: number) => {
    const currencyCode = currency || 'NGN';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  };

  const validateForm = () => {
    if (!selectedClientId) {
      toast({
        title: 'Client required',
        description: 'Please select or create a client.',
        variant: 'destructive',
      });
      return false;
    }
    if (!items.some(item => item.description && item.unitPrice > 0)) {
      toast({
        title: 'Line items required',
        description: 'Please add at least one line item with a description and price.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.email) return;

    const result = await createClient.mutateAsync({
      name: newClient.name,
      email: newClient.email,
      phone: newClient.phone || null,
    });

    if (result) {
      setSelectedClientId(result.id);
      setIsAddClientDialogOpen(false);
      setNewClient({ name: '', email: '', phone: '' });
    }
  };

  const handleSave = async () => {
    if (!validateForm() || !id) return;

    const validItems = items.filter(item => item.description && item.unitPrice > 0);

    await updateInvoice.mutateAsync({
      invoiceId: id,
      updates: {
        business_id: currentBusiness?.id || invoice?.business_id || null,
        client_id: selectedClientId,
        currency,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes || null,
        terms: terms || null,
        subtotal: calculateSubtotal(),
        tax_amount: calculateTax(),
        total_amount: calculateTotal(),
        template_id: selectedTemplateId || null,
      },
      items: validItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate,
        tax_amount: (item.quantity * item.unitPrice * item.taxRate) / 100,
        amount: item.quantity * item.unitPrice,
      })),
    });

    navigate(`/invoices/${id}`);
  };

  const handleIssue = async () => {
    if (!isEmailVerified) {
      toast({
        title: 'Email verification required',
        description: 'Please verify your email before issuing invoices.',
        variant: 'destructive',
      });
      return;
    }

    if (invoiceLimitCheck && !invoiceLimitCheck.allowed) {
      toast({
        title: 'Invoice limit reached',
        description: `You have issued ${invoiceLimitCheck.current_count} of ${invoiceLimitCheck.limit_value} invoices this month. Upgrade to Professional for unlimited invoices.`,
        variant: 'destructive',
      });
      return;
    }

    if (!validateForm() || !id) return;

    // First save, then issue
    const validItems = items.filter(item => item.description && item.unitPrice > 0);

    await updateInvoice.mutateAsync({
      invoiceId: id,
      updates: {
        business_id: currentBusiness?.id || invoice?.business_id || null,
        client_id: selectedClientId,
        currency,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes || null,
        terms: terms || null,
        subtotal: calculateSubtotal(),
        tax_amount: calculateTax(),
        total_amount: calculateTotal(),
        template_id: selectedTemplateId || null,
      },
      items: validItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate,
        tax_amount: (item.quantity * item.unitPrice * item.taxRate) / 100,
        amount: item.quantity * item.unitPrice,
      })),
    });

    await issueInvoice.mutateAsync(id);
    navigate('/invoices');
  };

  const isLoading = updateInvoice.isPending || issueInvoice.isPending;
  const isAtInvoiceLimit = invoiceLimitCheck && !invoiceLimitCheck.allowed;

  if (invoiceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Invoice Not Found</h1>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Invoice</h1>
          <p className="text-muted-foreground mt-1">
            {invoice.invoice_number} • Draft
          </p>
        </div>
      </div>

      {/* Invoice Limit Banner */}
      <InvoiceLimitBanner />

      {/* Email verification warning */}
      {!isEmailVerified && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Email verification required to issue invoices
              </p>
              <p className="text-sm text-muted-foreground">
                You can save drafts, but issuing requires email verification.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Starter tier watermark notice */}
      {isStarter && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-primary">
                Free tier: Invoices include Invoicemonk watermark
              </p>
              <p className="text-sm text-muted-foreground">
                Upgrade to Professional to remove watermarks and access premium templates.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/billing">Upgrade</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
              <CardDescription>Select or create a client for this invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" onClick={() => setIsAddClientDialogOpen(true)}>
                      + Add New Client
                    </SelectItem>
                    {clientsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} {client.email && `(${client.email})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  variant="link" 
                  className="px-0 h-auto" 
                  onClick={() => setIsAddClientDialogOpen(true)}
                >
                  + Create new client
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Set invoice dates and terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input 
                    id="issueDate" 
                    type="date" 
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input 
                    id="dueDate" 
                    type="date" 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                {isCurrencyLocked && lockedCurrency ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{lockedCurrency}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Your business currency is permanently locked to {lockedCurrency} after issuing your first invoice.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Invoice Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem 
                        key={template.id} 
                        value={template.id}
                        disabled={!template.available}
                      >
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          {!template.available && (
                            <Badge variant="outline" className="text-xs">
                              <Lock className="h-2.5 w-2.5 mr-1" />
                              {template.tier_required}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>Add products or services to the invoice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="space-y-4 pb-4 border-b last:border-0 last:pb-0">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          placeholder="Service or product description"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tax Rate (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.taxRate}
                            onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    Line total: {formatCurrency(item.quantity * item.unitPrice)}
                  </div>
                </div>
              ))}
              
              <Button variant="outline" onClick={addItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader>
              <CardTitle>Notes & Terms</CardTitle>
              <CardDescription>Add any additional information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Additional notes for the client..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Payment Terms</Label>
                <Textarea 
                  id="terms" 
                  placeholder="Payment terms and conditions..."
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  {updateInvoice.isPending && !issueInvoice.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
                <Button 
                  className="w-full"
                  onClick={handleIssue}
                  disabled={isLoading || !isEmailVerified || isAtInvoiceLimit}
                >
                  {issueInvoice.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : isAtInvoiceLimit ? (
                    <Lock className="h-4 w-4 mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isAtInvoiceLimit ? 'Limit Reached' : 'Issue Invoice'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Once issued, this invoice becomes an immutable financial record.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Client Dialog */}
      <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client to add to this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Name *</Label>
              <Input
                id="clientName"
                placeholder="Client name"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email *</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="client@example.com"
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">Phone</Label>
              <Input
                id="clientPhone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddClientDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddClient}
              disabled={!newClient.name || !newClient.email || createClient.isPending}
            >
              {createClient.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add Client'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
