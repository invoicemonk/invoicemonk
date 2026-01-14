import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useClients } from '@/hooks/use-clients';
import { useCreateInvoice } from '@/hooks/use-invoices';
import { useBusinessCurrency } from '@/hooks/use-business-currency';
import { toast } from 'sonner';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export default function OrgInvoiceNew() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const createInvoice = useCreateInvoice();
  const { data: businessCurrency, isLoading: currencyLoading } = useBusinessCurrency(orgId);

  const defaultCurrency = businessCurrency?.default_currency || 'NGN';
  const isCurrencyLocked = businessCurrency?.currency_locked || false;

  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0, tax_rate: 0 }
  ]);

  const addItem = () => {
    setItems([...items, { 
      id: Date.now().toString(), 
      description: '', 
      quantity: 1, 
      unit_price: 0, 
      tax_rate: 0 
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unit_price;
      return sum + (lineTotal * item.tax_rate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }

    if (items.some(item => !item.description.trim())) {
      toast.error('Please fill in all item descriptions');
      return;
    }

    try {
      const result = await createInvoice.mutateAsync({
        invoice: {
          client_id: clientId,
          business_id: orgId,
          currency: currency || 'NGN',
          due_date: dueDate || null,
          notes: notes || null,
          terms: terms || null,
          subtotal: calculateSubtotal(),
          tax_amount: calculateTax(),
          total_amount: calculateTotal(),
        },
        items: items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100,
          amount: item.quantity * item.unit_price,
          discount_percent: 0,
          sort_order: index
        }))
      });
      toast.success('Invoice created as draft');
      navigate(`/org/${orgId}/invoices/${result.id}`);
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  if (clientsLoading || currencyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Invoice</h1>
          <p className="text-muted-foreground">Create a new invoice for {currentOrg?.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client *</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={setCurrency} disabled={isCurrencyLocked}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCurrencyLocked && (
                      <p className="text-xs text-muted-foreground">Currency locked after first invoice</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />Add Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="grid gap-4 sm:grid-cols-12 items-end p-4 border rounded-lg">
                    <div className="sm:col-span-5 space-y-2">
                      <Label>Description</Label>
                      <Input 
                        value={item.description} 
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Qty</Label>
                      <Input 
                        type="number" 
                        min="1"
                        value={item.quantity} 
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Price</Label>
                      <Input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={item.unit_price} 
                        onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label>Tax %</Label>
                      <Input 
                        type="number" 
                        min="0"
                        max="100"
                        value={item.tax_rate} 
                        onChange={(e) => updateItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
                </div>
                <div className="space-y-2">
                  <Label>Terms</Label>
                  <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms..." />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-3">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Draft Invoice
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
