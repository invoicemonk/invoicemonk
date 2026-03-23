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

export type ImportType = 'expenses' | 'clients';

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

export function getFieldsForType(type: ImportType) {
  return type === 'expenses' ? EXPENSE_FIELDS : CLIENT_FIELDS;
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

  const parseFile = useCallback((file: File) => {
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
        // Auto-map by fuzzy matching column names
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

    // Audit log
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
  };
}
