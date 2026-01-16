import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  FileText, 
  Plus, 
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Send,
  Trash2,
  Lock,
  Ban,
  Loader2,
  X,
  Calendar,
  Download,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useInvoices, useDeleteInvoice, useVoidInvoice } from '@/hooks/use-invoices';
import { useClients } from '@/hooks/use-clients';
import { SendInvoiceDialog } from '@/components/invoices/SendInvoiceDialog';
import { useExportRecords } from '@/hooks/use-export';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  viewed: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  voided: 'bg-destructive/10 text-destructive',
  credited: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  voided: 'Voided',
  credited: 'Credited',
};

const allStatuses: InvoiceStatus[] = ['draft', 'issued', 'sent', 'viewed', 'paid', 'voided', 'credited'];

export default function Invoices() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedSendInvoice, setSelectedSendInvoice] = useState<typeof filteredInvoices[0] | null>(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  
  // Custom date range states
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [dateFromPopoverOpen, setDateFromPopoverOpen] = useState(false);
  const [dateToPopoverOpen, setDateToPopoverOpen] = useState(false);

  const { data: invoices, isLoading, error } = useInvoices();
  const { data: clients } = useClients();
  const deleteInvoice = useDeleteInvoice();
  const voidInvoice = useVoidInvoice();
  const { exportRecords, isExporting } = useExportRecords();

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== 'all' || clientFilter !== 'all' || dateRangeFilter !== 'all' || customDateFrom || customDateTo;

  const clearFilters = () => {
    setStatusFilter('all');
    setClientFilter('all');
    setDateRangeFilter('all');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  // Date range helpers
  const getDateRangeStart = (range: string): Date | null => {
    const now = new Date();
    switch (range) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return weekAgo;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return monthAgo;
      case 'quarter':
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(now.getMonth() - 3);
        return quarterAgo;
      case 'year':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(now.getFullYear() - 1);
        return yearAgo;
      default:
        return null;
    }
  };

  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter(invoice => {
      // Tab filter
      if (activeTab !== 'all' && invoice.status !== activeTab) return false;
      
      // Search filter
      if (searchQuery && 
          !invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !invoice.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Status dropdown filter (only if tab is 'all')
      if (activeTab === 'all' && statusFilter !== 'all' && invoice.status !== statusFilter) {
        return false;
      }
      
      // Client filter
      if (clientFilter !== 'all' && invoice.client_id !== clientFilter) {
        return false;
      }
      
      // Date range filter
      if (dateRangeFilter === 'custom') {
        const invoiceDate = invoice.issue_date ? new Date(invoice.issue_date) : new Date(invoice.created_at);
        if (customDateFrom && invoiceDate < customDateFrom) return false;
        if (customDateTo) {
          const endOfDay = new Date(customDateTo);
          endOfDay.setHours(23, 59, 59, 999);
          if (invoiceDate > endOfDay) return false;
        }
      } else if (dateRangeFilter !== 'all') {
        const rangeStart = getDateRangeStart(dateRangeFilter);
        if (rangeStart) {
          const invoiceDate = invoice.issue_date ? new Date(invoice.issue_date) : new Date(invoice.created_at);
          if (invoiceDate < rangeStart) return false;
        }
      }
      
      return true;
    });
  }, [invoices, activeTab, searchQuery, statusFilter, clientFilter, dateRangeFilter, customDateFrom, customDateTo]);

  // Handle export
  const handleExport = async (exportFormat: 'csv' | 'json') => {
    await exportRecords({
      export_type: 'invoices',
      format: exportFormat,
      date_from: dateRangeFilter === 'custom' && customDateFrom 
        ? customDateFrom.toISOString() 
        : dateRangeFilter !== 'all' 
          ? getDateRangeStart(dateRangeFilter)?.toISOString() 
          : undefined,
      date_to: dateRangeFilter === 'custom' && customDateTo 
        ? customDateTo.toISOString() 
        : undefined,
    });
  };

  // Get the date range display label
  const getDateRangeLabel = () => {
    if (dateRangeFilter === 'custom') {
      if (customDateFrom && customDateTo) {
        return `${format(customDateFrom, 'MMM d')} - ${format(customDateTo, 'MMM d, yyyy')}`;
      } else if (customDateFrom) {
        return `From ${format(customDateFrom, 'MMM d, yyyy')}`;
      } else if (customDateTo) {
        return `Until ${format(customDateTo, 'MMM d, yyyy')}`;
      }
      return 'Custom range';
    }
    const labels: Record<string, string> = {
      all: 'All time',
      today: 'Today',
      week: 'Last 7 days',
      month: 'Last 30 days',
      quarter: 'Last 3 months',
      year: 'Last year',
    };
    return labels[dateRangeFilter] || 'All time';
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedInvoiceId) {
      await deleteInvoice.mutateAsync(selectedInvoiceId);
    }
    setDeleteDialogOpen(false);
    setSelectedInvoiceId(null);
  };

  const handleVoid = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const confirmVoid = async () => {
    if (selectedInvoiceId && voidReason.trim()) {
      await voidInvoice.mutateAsync({ 
        invoiceId: selectedInvoiceId, 
        reason: voidReason.trim() 
      });
    }
    setVoidDialogOpen(false);
    setSelectedInvoiceId(null);
    setVoidReason('');
  };

  const isImmutable = (status: InvoiceStatus) => status !== 'draft';

  const handleSend = (invoice: typeof filteredInvoices[0]) => {
    setSelectedSendInvoice(invoice);
    setSendDialogOpen(true);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Error loading invoices: {error.message}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track your compliance-ready invoices
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {[statusFilter !== 'all', clientFilter !== 'all', dateRangeFilter !== 'all' || customDateFrom || customDateTo].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filter Invoices</h4>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
                        <X className="h-3 w-3 mr-1" />
                        Clear all
                      </Button>
                    )}
                  </div>
                  
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {allStatuses.map(status => (
                          <SelectItem key={status} value={status}>
                            {statusLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Client Filter */}
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All clients</SelectItem>
                        {clients?.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Date Range Filter */}
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <Select 
                      value={dateRangeFilter} 
                      onValueChange={(value) => {
                        setDateRangeFilter(value);
                        if (value !== 'custom') {
                          setCustomDateFrom(undefined);
                          setCustomDateTo(undefined);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <Calendar className="h-4 w-4 mr-2" />
                        <span className="truncate">{getDateRangeLabel()}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">Last 7 days</SelectItem>
                        <SelectItem value="month">Last 30 days</SelectItem>
                        <SelectItem value="quarter">Last 3 months</SelectItem>
                        <SelectItem value="year">Last year</SelectItem>
                        <SelectItem value="custom">Custom range...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Custom Date Pickers */}
                  {dateRangeFilter === 'custom' && (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Popover open={dateFromPopoverOpen} onOpenChange={setDateFromPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !customDateFrom && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {customDateFrom ? format(customDateFrom, "PPP") : "Select start date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={customDateFrom}
                              onSelect={(date) => {
                                setCustomDateFrom(date);
                                setDateFromPopoverOpen(false);
                              }}
                              disabled={(date) => customDateTo ? date > customDateTo : false}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Popover open={dateToPopoverOpen} onOpenChange={setDateToPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !customDateTo && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {customDateTo ? format(customDateTo, "PPP") : "Select end date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={customDateTo}
                              onSelect={(date) => {
                                setCustomDateTo(date);
                                setDateToPopoverOpen(false);
                              }}
                              disabled={(date) => customDateFrom ? date < customDateFrom : false}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {(customDateFrom || customDateTo) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setCustomDateFrom(undefined);
                            setCustomDateTo(undefined);
                          }}
                          className="w-full text-xs"
                        >
                          Clear dates
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="issued">Issued</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="voided">Voided</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            {isLoading ? (
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            ) : filteredInvoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link 
                          to={`/invoices/${invoice.id}`}
                          className="hover:text-primary transition-colors flex items-center gap-2"
                        >
                          {invoice.invoice_number}
                          {isImmutable(invoice.status) && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.clients?.name || 'Unknown'}</TableCell>
                      <TableCell>{formatCurrency(Number(invoice.total_amount), invoice.currency)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[invoice.status]} variant="secondary">
                          {isImmutable(invoice.status) && (
                            <Lock className="h-3 w-3 mr-1" />
                          )}
                          {statusLabels[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/invoices/${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            {invoice.status === 'issued' && (
                              <DropdownMenuItem onClick={() => handleSend(invoice)}>
                                <Send className="h-4 w-4 mr-2" />
                                Send
                              </DropdownMenuItem>
                            )}
                            {invoice.status !== 'draft' && invoice.status !== 'voided' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleVoid(invoice.id)}
                                  className="text-destructive"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Void Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                            {invoice.status === 'draft' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(invoice.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">No invoices found</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    {activeTab === 'all' 
                      ? "Create your first invoice to get started with compliance-ready invoicing."
                      : `No ${activeTab} invoices found.`
                    }
                  </p>
                  <Button asChild>
                    <Link to="/invoices/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Invoice
                    </Link>
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compliance Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Immutable Invoice Records</p>
            <p className="text-xs text-muted-foreground">
              Once issued, invoices cannot be modified or deleted. This ensures compliance with financial record-keeping regulations.
              To correct an issued invoice, create a credit note by voiding it.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft invoice. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvoice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Void Invoice
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action <strong>does not erase</strong> the original invoice. A credit note will be created 
                and the original invoice will be permanently marked as voided.
              </p>
              <p className="text-xs text-muted-foreground">
                A permanent audit record of this action will be created.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="voidReason">Reason for voiding (required)</Label>
            <Textarea
              id="voidReason"
              placeholder="Enter the reason for voiding this invoice..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmVoid}
              disabled={!voidReason.trim() || voidInvoice.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidInvoice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Void Invoice'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Invoice Dialog */}
      {selectedSendInvoice && (
        <SendInvoiceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          invoice={selectedSendInvoice}
        />
      )}
    </motion.div>
  );
}
