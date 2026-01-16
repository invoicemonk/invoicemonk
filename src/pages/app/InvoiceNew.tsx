import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  Sparkles,
  Eye
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
import { useCreateInvoice, useIssueInvoice } from '@/hooks/use-invoices';
import { useInvoiceTemplates, TemplateWithAccess } from '@/hooks/use-invoice-templates';
import { useInvoiceLimitCheck, useSubscription } from '@/hooks/use-subscription';
import { useBusinessCurrency } from '@/hooks/use-business-currency';
import { useUserOrganizations } from '@/hooks/use-organization';
import { InvoiceLimitBanner } from '@/components/app/InvoiceLimitBanner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { InvoicePreviewDialog } from '@/components/invoices/InvoicePreviewDialog';
import type { Tables } from '@/integrations/supabase/types';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export default function InvoiceNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmailVerified = user?.email_confirmed_at;

  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: templates } = useInvoiceTemplates();
  const { data: invoiceLimitCheck } = useInvoiceLimitCheck();
  const { isStarter } = useSubscription();
  const { data: organizations } = useUserOrganizations();
  const currentBusiness = organizations?.[0]?.business;
  const { data: businessCurrency } = useBusinessCurrency(currentBusiness?.id);
  const createClient = useCreateClient();
  const createInvoice = useCreateInvoice();
  const issueInvoice = useIssueInvoice();

  // Currency lock state
  const isCurrencyLocked = businessCurrency?.currency_locked || false;
  const lockedCurrency = businessCurrency?.default_currency;

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [currency, setCurrency] = useState('NGN');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, taxRate: 0 }
  ]);

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Get selected client for preview
  const selectedClient = clients?.find(c => c.id === selectedClientId);

  // Build a preview invoice object from current form state
  const buildPreviewInvoice = (): Tables<'invoices'> & { clients?: Tables<'clients'> | null; invoice_items?: Tables<'invoice_items'>[] } => {
    const validItems = items.filter(item => item.description || item.unitPrice > 0);
    return {
      id: 'preview',
      invoice_number: 'PREVIEW',
      user_id: user?.id || null,
      business_id: currentBusiness?.id || null,
      client_id: selectedClientId || '',
      status: 'draft',
      currency: isCurrencyLocked && lockedCurrency ? lockedCurrency : currency,
      issue_date: issueDate,
      due_date: dueDate || null,
      notes: notes || null,
      terms: terms || null,
      summary: summary || null,
      subtotal: calculateSubtotal(),
      tax_amount: calculateTax(),
      discount_amount: 0,
      total_amount: calculateTotal(),
      amount_paid: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      issued_at: null,
      issued_by: null,
      voided_at: null,
      voided_by: null,
      void_reason: null,
      invoice_hash: null,
      verification_id: null,
      template_id: selectedTemplateId || null,
      template_snapshot: null,
      tax_schema_id: null,
      tax_schema_snapshot: null,
      tax_schema_version: null,
      issuer_snapshot: currentBusiness ? {
        name: currentBusiness.name,
        legal_name: currentBusiness.legal_name,
        tax_id: currentBusiness.tax_id,
        address: currentBusiness.address,
        contact_email: currentBusiness.contact_email,
        contact_phone: currentBusiness.contact_phone,
        jurisdiction: currentBusiness.jurisdiction,
      } : null,
      recipient_snapshot: selectedClient ? {
        name: selectedClient.name,
        email: selectedClient.email,
        phone: selectedClient.phone,
        tax_id: selectedClient.tax_id,
        address: selectedClient.address,
      } : null,
      retention_locked_until: null,
      currency_locked_at: null,
      clients: selectedClient || null,
      invoice_items: validItems.map((item, index) => ({
        id: `item-${index}`,
        invoice_id: 'preview',
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate,
        tax_amount: (item.quantity * item.unitPrice * item.taxRate) / 100,
        discount_percent: 0,
        amount: item.quantity * item.unitPrice,
        sort_order: index,
        created_at: new Date().toISOString(),
      })),
    };
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, taxRate: 0 }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
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

  const handleSaveDraft = async () => {
    // Validate business exists
    if (!currentBusiness?.id) {
      toast({
        title: 'Business profile required',
        description: 'Please complete your business profile before creating invoices.',
        variant: 'destructive',
      });
      navigate('/business-profile');
      return;
    }

    if (!validateForm()) return;

    const validItems = items.filter(item => item.description && item.unitPrice > 0);
    const effectiveCurrency = isCurrencyLocked && lockedCurrency ? lockedCurrency : currency;

    await createInvoice.mutateAsync({
      invoice: {
        business_id: currentBusiness.id,
        client_id: selectedClientId,
        currency: effectiveCurrency,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes || null,
        terms: terms || null,
        summary: summary || null,
        subtotal: calculateSubtotal(),
        tax_amount: calculateTax(),
        total_amount: calculateTotal(),
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

    navigate('/invoices');
  };

  const handleIssue = async () => {
    // Validate business exists
    if (!currentBusiness?.id) {
      toast({
        title: 'Business profile required',
        description: 'Please complete your business profile before issuing invoices.',
        variant: 'destructive',
      });
      navigate('/business-profile');
      return;
    }

    if (!isEmailVerified) {
      toast({
        title: 'Email verification required',
        description: 'Please verify your email before issuing invoices.',
        variant: 'destructive',
      });
      return;
    }

    // Check invoice limit before issuing
    if (invoiceLimitCheck && !invoiceLimitCheck.allowed) {
      toast({
        title: 'Invoice limit reached',
        description: `You have issued ${invoiceLimitCheck.current_count} of ${invoiceLimitCheck.limit_value} invoices this month. Upgrade to Professional for unlimited invoices.`,
        variant: 'destructive',
      });
      return;
    }

    if (!validateForm()) return;

    const validItems = items.filter(item => item.description && item.unitPrice > 0);
    const effectiveCurrency = isCurrencyLocked && lockedCurrency ? lockedCurrency : currency;

    // First create the invoice with template
    const invoice = await createInvoice.mutateAsync({
      invoice: {
        business_id: currentBusiness.id,
        client_id: selectedClientId,
        currency: effectiveCurrency,
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes || null,
        terms: terms || null,
        summary: summary || null,
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

    if (invoice) {
      // Then issue it
      await issueInvoice.mutateAsync(invoice.id);
      navigate('/invoices');
    }
  };

  const isLoading = createInvoice.isPending || issueInvoice.isPending;

  // Check if user is at invoice limit
  const isAtInvoiceLimit = invoiceLimitCheck && !invoiceLimitCheck.allowed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
          <p className="text-muted-foreground mt-1">
            Create a new draft invoice
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
                          <p>Your business currency is permanently locked to {lockedCurrency} after issuing your first invoice. This ensures consistency across all financial records for compliance.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <>
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
                    <p className="text-xs text-muted-foreground">
                      Currency will be locked after your first issued invoice
                    </p>
                  </>
                )}
              </div>

              {/* Summary / Description */}
              <div className="space-y-2">
                <Label htmlFor="summary">Summary / Description</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value.slice(0, 500))}
                  placeholder="Brief description of what this invoice is for..."
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground text-right">{summary.length}/500</p>
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
                          {template.watermark_required && (
                            <Badge variant="secondary" className="text-xs">
                              Watermark
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates?.find(t => t.id === selectedTemplateId)?.watermark_required && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    This template includes Invoicemonk watermark
                  </p>
                )}
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
                  variant="ghost"
                  className="w-full"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview as Recipient
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                >
                  {createInvoice.isPending && !issueInvoice.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save as Draft
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

      {/* Invoice Preview Dialog */}
      <InvoicePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        invoice={buildPreviewInvoice()}
        showWatermark={isStarter}
        business={currentBusiness ? {
          name: currentBusiness.name,
          legal_name: currentBusiness.legal_name,
          tax_id: currentBusiness.tax_id,
          address: currentBusiness.address as { street?: string; city?: string; state?: string; postal_code?: string; country?: string } | null,
          contact_email: currentBusiness.contact_email,
          contact_phone: currentBusiness.contact_phone,
        } : null}
      />
    </motion.div>
  );
}
