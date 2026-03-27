import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCsvImport, getFieldsForType, type ImportType } from '@/hooks/use-csv-import';

interface CsvImportDialogProps {
  importType: ImportType;
  trigger?: React.ReactNode;
}

export function CsvImportDialog({ importType, trigger }: CsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useCsvImport();

  const fields = getFieldsForType(importType);
  const requiredFields = fields.filter((f) => 'required' in f && f.required).map((f) => f.value);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    switch (importType) {
      case 'expenses': await importExpenses(); break;
      case 'clients': await importClients(); break;
      case 'invoices': await importInvoices(); break;
      case 'products': await importProducts(); break;
    }
  };

  const handleClose = () => {
    reset();
    setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Check if required fields are mapped
  const mappedDbFields = new Set(Object.values(mapping).filter(Boolean));
  const missingRequired = requiredFields.filter((f) => !mappedDbFields.has(f));

  const label = importType === 'expenses' ? 'Expenses' : importType === 'clients' ? 'Clients' : importType === 'invoices' ? 'Invoices' : 'Products';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import {label} from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file (max 1,000 rows), map columns, then import.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File upload */}
        {parsedRows.length === 0 && !result && (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Select a CSV file to import</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Choose File
            </Button>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {parsedRows.length > 0 && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{parsedRows.length} rows detected</Badge>
              <Button variant="ghost" size="sm" onClick={() => { reset(); if (fileRef.current) fileRef.current.value = ''; }}>
                Choose different file
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Map CSV columns to fields</p>
              {csvColumns.map((col) => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate text-muted-foreground" title={col}>{col}</span>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={mapping[col] || '_skip'}
                    onValueChange={(val) =>
                      setMapping((prev) => ({ ...prev, [col]: val === '_skip' ? '' : val }))
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">Skip</SelectItem>
                      {fields.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label} {'required' in f && f.required ? '*' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Required fields not mapped: {missingRequired.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {/* Preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Preview (first 5 rows)</p>
              <div className="border rounded-lg overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvColumns.slice(0, 6).map((col) => (
                        <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {csvColumns.slice(0, 6).map((col) => (
                          <TableCell key={col} className="text-xs truncate max-w-[120px]">{row[col]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Import button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={importing || missingRequired.length > 0}
              >
                {importing ? 'Importing...' : `Import ${parsedRows.length} ${label}`}
              </Button>
            </div>

            {importing && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{progress}%</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Results */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <p className="font-medium">
                {result.success} of {result.total} {label.toLowerCase()} imported
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-lg p-3 max-h-32 overflow-auto text-xs text-destructive space-y-1">
                {result.errors.slice(0, 20).map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
                {result.errors.length > 20 && (
                  <p className="text-muted-foreground">...and {result.errors.length - 20} more</p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
