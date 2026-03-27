import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useCurrencyAccount } from '@/contexts/CurrencyAccountContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { stripUrls } from '@/lib/utils';
import { INPUT_LIMITS } from '@/lib/input-limits';
import { applyTemplate, type ImportDataType } from '@/lib/import-templates';

export type ImportType = 'expenses' | 'clients' | 'invoices' | 'products';

export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

const MAX_ROWS = 1000;
const BATCH_SIZE = 50;

const EXPENSE_FIELDS = [
  { value: 'category', label: 'Category', required: true },
  { value: 'amount', label: 'Amount', required: true },
  { value: 'description', label: 'Description' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'expense_date', label: 'Date' },
  { value: 'notes', label: 'Notes' },
] as const;

const CLIENT_FIELDS = [
  { value: 'name', label: 'Name', required: true },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'contact_person', label: 'Contact Person' },
  { value: 'tax_id', label: 'Tax ID' },
  { value: 'notes', label: 'Notes' },
] as const;

const INVOICE_FIELDS = [
  { value: 'invoice_number', label: 'Invoice Number' },
  { value: 'issue_date', label: 'Issue Date' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'client_name', label: 'Client Name', required: true },
  { value: 'client_email', label: 'Client Email' },
  { value: 'item_description', label: 'Item Description', required: true },
  { value: 'item_quantity', label: 'Quantity' },
  { value: 'item_unit_price', label: 'Unit Price', required: true },
  { value: 'item_amount', label: 'Line Amount' },
  { value: 'item_tax_rate', label: 'Tax Rate (%)' },
  { value: 'item_tax_label', label: 'Tax Label' },
  { value: 'total_amount', label: 'Total Amount' },
  { value: 'currency', label: 'Currency' },
  { value: 'notes', label: 'Notes' },
  { value: 'terms', label: 'Terms' },
] as const;

const PRODUCT_FIELDS = [
  { value: 'name', label: 'Name', required: true },
  { value: 'description', label: 'Description' },
  { value: 'default_price', label: 'Price', required: true },
  { value: 'tax_rate', label: 'Tax Rate (%)' },
  { value: 'sku', label: 'SKU' },
  { value: 'type', label: 'Type (product/service)' },
] as const;

export function getFieldsForType(type: ImportType) {
  switch (type) {
    case 'expenses': return EXPENSE_FIELDS;
    case 'clients': return CLIENT_FIELDS;
    case 'invoices': return INVOICE_FIELDS;
    case 'products': return PRODUCT_FIELDS;
  }
}

function sanitize(val: unknown, maxLen: number): string {
  if (val == null) return '';
  const s = stripUrls(String(val).trim());
  return s.slice(0, maxLen);
}

export function useCsvImport() {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { currentCurrencyAccount, activeCurrency } = useCurrencyAccount();
  const queryClient = useQueryClient();

  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseFile = useCallback((file: File, competitorId?: string, dataType?: ImportDataType) => {
    setResult(null);
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          toast({ title: 'Parse error', description: res.errors[0].message, variant: 'destructive' });
          return;
        }
        const rows = res.data as Record<string, string>[];
        if (rows.length > MAX_ROWS) {
          toast({ title: 'Too many rows', description: `Maximum ${MAX_ROWS} rows allowed. Your file has ${rows.length}.`, variant: 'destructive' });
          return;
        }
        if (rows.length === 0) {
          toast({ title: 'Empty file', description: 'The CSV file contains no data rows.', variant: 'destructive' });
          return;
        }
        const cols = Object.keys(rows[0]);
        setCsvColumns(cols);
        setParsedRows(rows);

        // Use template-aware mapping if competitor selected, else fuzzy fallback
        if (competitorId && dataType) {
          setMapping(applyTemplate(competitorId, dataType, cols));
        } else {
          // Legacy fuzzy mapping
          const autoMap: Record<string, string> = {};
          cols.forEach((col) => {
            const lower = col.toLowerCase().replace(/[^a-z]/g, '');
            if (lower.includes('category')) autoMap[col] = 'category';
            else if (lower.includes('amount') || lower.includes('price') || lower.includes('cost')) autoMap[col] = 'amount';
            else if (lower.includes('description') || lower.includes('desc')) autoMap[col] = 'description';
            else if (lower.includes('vendor') || lower.includes('supplier')) autoMap[col] = 'vendor';
            else if (lower.includes('date')) autoMap[col] = 'expense_date';
            else if (lower === 'name' || lower.includes('clientname') || lower.includes('companyname')) autoMap[col] = 'name';
            else if (lower.includes('email')) autoMap[col] = 'email';
            else if (lower.includes('phone') || lower.includes('tel')) autoMap[col] = 'phone';
            else if (lower.includes('contact')) autoMap[col] = 'contact_person';
            else if (lower.includes('tax') || lower.includes('tin') || lower.includes('vat')) autoMap[col] = 'tax_id';
            else if (lower.includes('note')) autoMap[col] = 'notes';
          });
          setMapping(autoMap);
        }
      },
    });
  }, []);

  const reset = useCallback(() => {
    setParsedRows([]);
    setCsvColumns([]);
    setMapping({});
    setProgress(0);
    setResult(null);
    setImporting(false);
  }, []);

  const importExpenses = useCallback(async () => {
    if (!user || !currentBusiness) return;
    setImporting(true);
    setProgress(0);

    const errors: string[] = [];
    let success = 0;
    const reverseMap: Record<string, string> = {};
    Object.entries(mapping).forEach(([csv, db]) => { if (db) reverseMap[db] = csv; });

    if (!reverseMap.category || !reverseMap.amount) {
      toast({ title: 'Missing mapping', description: 'Category and Amount are required fields.', variant: 'destructive' });
      setImporting(false);
      return;
    }

    const records = parsedRows.map((row, idx) => {
      const amt = parseFloat(row[reverseMap.amount] || '');
      if (isNaN(amt) || amt <= 0) {
        errors.push(`Row ${idx + 1}: invalid amount`);
        return null;
      }
      return {
        user_id: user.id,
        business_id: currentBusiness.id,
        currency_account_id: currentCurrencyAccount?.id || null,
        currency: activeCurrency || 'NGN',
        category: sanitize(row[reverseMap.category], INPUT_LIMITS.SHORT_TEXT) || 'other',
        amount: amt,
        description: reverseMap.description ? sanitize(row[reverseMap.description], INPUT_LIMITS.SHORT_TEXT) : null,
        vendor: reverseMap.vendor ? sanitize(row[reverseMap.vendor], INPUT_LIMITS.NAME) : null,
        expense_date: reverseMap.expense_date ? row[reverseMap.expense_date] || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: reverseMap.notes ? sanitize(row[reverseMap.notes], INPUT_LIMITS.TEXTAREA) : null,
      };
    }).filter(Boolean) as any[];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('expenses').insert(batch);
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        success += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / records.length) * 100));
    }

    const finalResult: ImportResult = { total: parsedRows.length, success, failed: parsedRows.length - success, errors };
    setResult(finalResult);
    setImporting(false);

    queryClient.invalidateQueries({ queryKey: ['expenses'] });

    await supabase.from('audit_logs').insert({
      event_type: 'export.downloaded' as any,
      entity_type: 'expense_import',
      entity_id: currentBusiness.id,
      user_id: user.id,
      business_id: currentBusiness.id,
      metadata: { import_type: 'expenses', total: parsedRows.length, success, failed: parsedRows.length - success },
    });

    toast({
      title: 'Import complete',
      description: `${success} of ${parsedRows.length} expenses imported.`,
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
  }, [parsedRows, mapping, user, currentBusiness, currentCurrencyAccount, activeCurrency, queryClient]);

  const importClients = useCallback(async () => {
    if (!user || !currentBusiness) return;
    setImporting(true);
    setProgress(0);

    const errors: string[] = [];
    let success = 0;
    const reverseMap: Record<string, string> = {};
    Object.entries(mapping).forEach(([csv, db]) => { if (db) reverseMap[db] = csv; });

    if (!reverseMap.name) {
      toast({ title: 'Missing mapping', description: 'Name is a required field.', variant: 'destructive' });
      setImporting(false);
      return;
    }

    const records = parsedRows.map((row, idx) => {
      const name = sanitize(row[reverseMap.name], INPUT_LIMITS.NAME);
      if (!name) {
        errors.push(`Row ${idx + 1}: empty name`);
        return null;
      }
      return {
        user_id: user.id,
        business_id: currentBusiness.id,
        name,
        email: reverseMap.email ? sanitize(row[reverseMap.email], INPUT_LIMITS.EMAIL) || null : null,
        phone: reverseMap.phone ? sanitize(row[reverseMap.phone], INPUT_LIMITS.PHONE) || null : null,
        contact_person: reverseMap.contact_person ? sanitize(row[reverseMap.contact_person], INPUT_LIMITS.NAME) || null : null,
        tax_id: reverseMap.tax_id ? sanitize(row[reverseMap.tax_id], INPUT_LIMITS.TAX_ID) || null : null,
        notes: reverseMap.notes ? sanitize(row[reverseMap.notes], INPUT_LIMITS.TEXTAREA) || null : null,
      };
    }).filter(Boolean) as any[];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('clients').insert(batch);
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        success += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / records.length) * 100));
    }

    const finalResult: ImportResult = { total: parsedRows.length, success, failed: parsedRows.length - success, errors };
    setResult(finalResult);
    setImporting(false);

    queryClient.invalidateQueries({ queryKey: ['clients'] });

    await supabase.from('audit_logs').insert({
      event_type: 'export.downloaded' as any,
      entity_type: 'client_import',
      entity_id: currentBusiness.id,
      user_id: user.id,
      business_id: currentBusiness.id,
      metadata: { import_type: 'clients', total: parsedRows.length, success, failed: parsedRows.length - success },
    });

    toast({
      title: 'Import complete',
      description: `${success} of ${parsedRows.length} clients imported.`,
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
  }, [parsedRows, mapping, user, currentBusiness, queryClient]);

  const importInvoices = useCallback(async () => {
    if (!user || !currentBusiness) return;
    setImporting(true);
    setProgress(0);

    const errors: string[] = [];
    let success = 0;
    const reverseMap: Record<string, string> = {};
    Object.entries(mapping).forEach(([csv, db]) => { if (db) reverseMap[db] = csv; });

    if (!reverseMap.client_name || !reverseMap.item_description || !reverseMap.item_unit_price) {
      toast({ title: 'Missing mapping', description: 'Client Name, Item Description, and Unit Price are required.', variant: 'destructive' });
      setImporting(false);
      return;
    }

    // Group rows by invoice number (or treat each row as a separate invoice)
    const invoiceGroups = new Map<string, Record<string, string>[]>();
    parsedRows.forEach((row, idx) => {
      const invNum = reverseMap.invoice_number ? sanitize(row[reverseMap.invoice_number], INPUT_LIMITS.INVOICE_NUMBER) : `ROW-${idx + 1}`;
      const key = invNum || `ROW-${idx + 1}`;
      if (!invoiceGroups.has(key)) invoiceGroups.set(key, []);
      invoiceGroups.get(key)!.push(row);
    });

    const totalInvoices = invoiceGroups.size;
    let processed = 0;

    for (const [invNum, rows] of invoiceGroups) {
      try {
        const firstRow = rows[0];
        const clientName = sanitize(firstRow[reverseMap.client_name], INPUT_LIMITS.NAME);
        if (!clientName) {
          errors.push(`Invoice ${invNum}: empty client name`);
          processed++;
          setProgress(Math.round((processed / totalInvoices) * 100));
          continue;
        }

        // Find or create client
        const clientEmail = reverseMap.client_email ? sanitize(firstRow[reverseMap.client_email], INPUT_LIMITS.EMAIL) : null;
        let clientId: string;

        // Try to find existing client by email or name
        let clientQuery = supabase
          .from('clients')
          .select('id')
          .eq('business_id', currentBusiness.id);

        if (clientEmail) {
          clientQuery = clientQuery.eq('email', clientEmail);
        } else {
          clientQuery = clientQuery.eq('name', clientName);
        }

        const { data: existingClients } = await clientQuery.limit(1);

        if (existingClients && existingClients.length > 0) {
          clientId = existingClients[0].id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              user_id: user.id,
              business_id: currentBusiness.id,
              name: clientName,
              email: clientEmail || null,
            })
            .select('id')
            .single();

          if (clientError || !newClient) {
            errors.push(`Invoice ${invNum}: failed to create client "${clientName}"`);
            processed++;
            setProgress(Math.round((processed / totalInvoices) * 100));
            continue;
          }
          clientId = newClient.id;
        }

        // Build line items
        const lineItems = rows.map((row) => {
          const desc = sanitize(row[reverseMap.item_description], INPUT_LIMITS.SHORT_TEXT) || 'Imported item';
          const qty = parseFloat(row[reverseMap.item_quantity] || '1') || 1;
          const unitPrice = parseFloat(row[reverseMap.item_unit_price] || '0') || 0;
          const taxRate = reverseMap.item_tax_rate ? parseFloat(row[reverseMap.item_tax_rate] || '0') || 0 : 0;
          const taxLabel = reverseMap.item_tax_label ? sanitize(row[reverseMap.item_tax_label], INPUT_LIMITS.SHORT_TEXT) : null;
          const amount = qty * unitPrice;
          const taxAmount = amount * (taxRate / 100);

          return {
            description: desc,
            quantity: qty,
            unit_price: unitPrice,
            amount,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            tax_label: taxLabel,
            discount_percent: 0,
          };
        });

        const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
        const taxAmount = lineItems.reduce((sum, li) => sum + li.tax_amount, 0);
        const totalAmount = subtotal + taxAmount;
        const invoiceCurrency = reverseMap.currency ? sanitize(firstRow[reverseMap.currency], INPUT_LIMITS.CURRENCY_CODE) || activeCurrency || 'NGN' : activeCurrency || 'NGN';
        const invoiceNumber = `IMP-${invNum}`;

        // Create draft invoice
        const { data: invoice, error: invError } = await supabase
          .from('invoices')
          .insert({
            user_id: user.id,
            business_id: currentBusiness.id,
            client_id: clientId,
            currency_account_id: currentCurrencyAccount?.id || null,
            invoice_number: invoiceNumber,
            currency: invoiceCurrency,
            status: 'draft',
            issue_date: reverseMap.issue_date ? firstRow[reverseMap.issue_date] || null : null,
            due_date: reverseMap.due_date ? firstRow[reverseMap.due_date] || null : null,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total_amount: totalAmount,
            notes: reverseMap.notes ? sanitize(firstRow[reverseMap.notes], INPUT_LIMITS.TEXTAREA) : null,
            terms: reverseMap.terms ? sanitize(firstRow[reverseMap.terms], INPUT_LIMITS.TEXTAREA) : null,
          })
          .select('id')
          .single();

        if (invError || !invoice) {
          errors.push(`Invoice ${invNum}: ${invError?.message || 'insert failed'}`);
          processed++;
          setProgress(Math.round((processed / totalInvoices) * 100));
          continue;
        }

        // Insert line items
        const itemsPayload = lineItems.map((li, idx) => ({
          invoice_id: invoice.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          amount: li.amount,
          tax_rate: li.tax_rate,
          tax_amount: li.tax_amount,
          tax_label: li.tax_label,
          discount_percent: 0,
          sort_order: idx,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsPayload);
        if (itemsError) {
          errors.push(`Invoice ${invNum} items: ${itemsError.message}`);
        }

        success++;
      } catch (err: any) {
        errors.push(`Invoice ${invNum}: ${err.message}`);
      }

      processed++;
      setProgress(Math.round((processed / totalInvoices) * 100));
    }

    const finalResult: ImportResult = { total: totalInvoices, success, failed: totalInvoices - success, errors };
    setResult(finalResult);
    setImporting(false);

    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });

    await supabase.from('audit_logs').insert({
      event_type: 'export.downloaded' as any,
      entity_type: 'invoice_import',
      entity_id: currentBusiness.id,
      user_id: user.id,
      business_id: currentBusiness.id,
      metadata: { import_type: 'invoices', total: totalInvoices, success, failed: totalInvoices - success },
    });

    toast({
      title: 'Import complete',
      description: `${success} of ${totalInvoices} invoices imported as drafts.`,
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
  }, [parsedRows, mapping, user, currentBusiness, currentCurrencyAccount, activeCurrency, queryClient]);

  const importProducts = useCallback(async () => {
    if (!user || !currentBusiness) return;
    setImporting(true);
    setProgress(0);

    const errors: string[] = [];
    let success = 0;
    let skipped = 0;
    const reverseMap: Record<string, string> = {};
    Object.entries(mapping).forEach(([csv, db]) => { if (db) reverseMap[db] = csv; });

    if (!reverseMap.name || !reverseMap.default_price) {
      toast({ title: 'Missing mapping', description: 'Name and Price are required fields.', variant: 'destructive' });
      setImporting(false);
      return;
    }

    // Get existing product names for duplicate detection
    const { data: existingProducts } = await supabase
      .from('products_services')
      .select('name')
      .eq('business_id', currentBusiness.id);

    const existingNames = new Set((existingProducts || []).map((p) => p.name.toLowerCase()));

    const records: any[] = [];
    parsedRows.forEach((row, idx) => {
      const name = sanitize(row[reverseMap.name], INPUT_LIMITS.NAME);
      if (!name) {
        errors.push(`Row ${idx + 1}: empty name`);
        return;
      }
      if (existingNames.has(name.toLowerCase())) {
        skipped++;
        return;
      }
      existingNames.add(name.toLowerCase()); // prevent dups within import

      const price = parseFloat(row[reverseMap.default_price] || '0') || 0;
      const taxRate = reverseMap.tax_rate ? parseFloat(row[reverseMap.tax_rate] || '0') || 0 : 0;
      const rawType = reverseMap.type ? sanitize(row[reverseMap.type], 20).toLowerCase() : '';
      const type = rawType === 'service' ? 'service' : 'product';

      records.push({
        business_id: currentBusiness.id,
        currency_account_id: currentCurrencyAccount?.id || null,
        currency: activeCurrency || 'NGN',
        name,
        description: reverseMap.description ? sanitize(row[reverseMap.description], INPUT_LIMITS.SHORT_TEXT) || null : null,
        default_price: price,
        tax_rate: taxRate > 0 ? taxRate : null,
        tax_applicable: taxRate > 0,
        sku: reverseMap.sku ? sanitize(row[reverseMap.sku], INPUT_LIMITS.SHORT_TEXT) || null : null,
        type,
        is_active: true,
      });
    });

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('products_services').insert(batch);
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        success += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / records.length) * 100));
    }

    const totalAttempted = parsedRows.length;
    const finalResult: ImportResult = {
      total: totalAttempted,
      success,
      failed: totalAttempted - success - skipped,
      errors: skipped > 0 ? [`${skipped} duplicate(s) skipped`, ...errors] : errors,
    };
    setResult(finalResult);
    setImporting(false);

    queryClient.invalidateQueries({ queryKey: ['products-services'] });

    await supabase.from('audit_logs').insert({
      event_type: 'export.downloaded' as any,
      entity_type: 'product_import',
      entity_id: currentBusiness.id,
      user_id: user.id,
      business_id: currentBusiness.id,
      metadata: { import_type: 'products', total: totalAttempted, success, skipped, failed: totalAttempted - success - skipped },
    });

    toast({
      title: 'Import complete',
      description: `${success} of ${totalAttempted} products imported.${skipped > 0 ? ` ${skipped} duplicates skipped.` : ''}`,
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
  }, [parsedRows, mapping, user, currentBusiness, currentCurrencyAccount, activeCurrency, queryClient]);

  return {
    parsedRows,
    csvColumns,
    mapping,
    setMapping,
    parseFile,
    reset,
    importing,
    progress,
    result,
    importExpenses,
    importClients,
    importInvoices,
    importProducts,
  };
}
