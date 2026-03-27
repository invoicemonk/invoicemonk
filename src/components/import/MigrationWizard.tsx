import { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
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
import { COMPETITOR_TEMPLATES, type ImportDataType } from '@/lib/import-templates';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['Choose Source', 'Choose Data Type', 'Upload & Map', 'Import'];

export function MigrationWizard() {
  const [step, setStep] = useState(0);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<ImportDataType[]>([]);
  const [currentTypeIndex, setCurrentTypeIndex] = useState(0);
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

  const competitor = COMPETITOR_TEMPLATES.find((t) => t.id === selectedCompetitor);
  const currentType = selectedTypes[currentTypeIndex] as ImportType | undefined;
  const fields = currentType ? getFieldsForType(currentType) : [];
  const requiredFields = fields
    .filter((f) => 'required' in f && f.required)
    .map((f) => f.value);
  const mappedDbFields = new Set(Object.values(mapping).filter(Boolean));
  const missingRequired = requiredFields.filter((f) => !mappedDbFields.has(f));

  const handleSelectCompetitor = (id: string) => {
    setSelectedCompetitor(id);
    setSelectedTypes([]);
    setStep(1);
  };

  const toggleType = (type: ImportDataType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentType) {
      parseFile(file, selectedCompetitor || undefined, currentType as ImportDataType);
    }
  };

  const handleImport = async () => {
    if (!currentType) return;
    switch (currentType) {
      case 'expenses': await importExpenses(); break;
      case 'clients': await importClients(); break;
      case 'invoices': await importInvoices(); break;
      case 'products': await importProducts(); break;
    }
  };

  const handleNextType = () => {
    reset();
    if (fileRef.current) fileRef.current.value = '';
    if (currentTypeIndex < selectedTypes.length - 1) {
      setCurrentTypeIndex(currentTypeIndex + 1);
    } else {
      // All done — reset wizard
      setStep(0);
      setSelectedCompetitor(null);
      setSelectedTypes([]);
      setCurrentTypeIndex(0);
    }
  };

  const handleBack = () => {
    if (step === 3 && !result) {
      reset();
      if (fileRef.current) fileRef.current.value = '';
    }
    if (step > 0) setStep(step - 1);
  };

  const typeLabels: Record<ImportDataType, string> = {
    clients: 'Clients',
    invoices: 'Invoices',
    expenses: 'Expenses',
    products: 'Products & Services',
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border',
                i === step
                  ? 'bg-primary text-primary-foreground border-primary'
                  : i < step
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-border'
              )}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={cn('hidden sm:inline', i === step ? 'font-medium' : 'text-muted-foreground')}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Choose Source */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Where are you migrating from?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {COMPETITOR_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectCompetitor(t.id)}
                className={cn(
                  'p-4 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-accent/50',
                  selectedCompetitor === t.id && 'border-primary bg-primary/5'
                )}
              >
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.supportedTypes.length} data type{t.supportedTypes.length !== 1 ? 's' : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Choose Data Type */}
      {step === 1 && competitor && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
          <h2 className="text-lg font-semibold">What data do you want to import from {competitor.name}?</h2>

          {/* Export instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{competitor.exportInstructions}</AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-3">
            {(['clients', 'invoices', 'expenses', 'products'] as ImportDataType[]).map((type) => {
              const supported = competitor.supportedTypes.includes(type);
              return (
                <label
                  key={type}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all',
                    !supported && 'opacity-50 cursor-not-allowed',
                    selectedTypes.includes(type) && 'border-primary bg-primary/5'
                  )}
                >
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => supported && toggleType(type)}
                    disabled={!supported}
                  />
                  <div>
                    <p className="font-medium text-sm">{typeLabels[type]}</p>
                    {!supported && <p className="text-xs text-muted-foreground">Not available</p>}
                    {type === 'invoices' && supported && (
                      <p className="text-xs text-muted-foreground">Imported as drafts</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <Button
            onClick={() => { setCurrentTypeIndex(0); setStep(2); }}
            disabled={selectedTypes.length === 0}
          >
            Continue <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Step 2→3: Upload & Map */}
      {step === 2 && currentType && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Upload {typeLabels[currentType as ImportDataType]} CSV
              {selectedTypes.length > 1 && (
                <span className="text-sm text-muted-foreground font-normal ml-2">
                  ({currentTypeIndex + 1} of {selectedTypes.length})
                </span>
              )}
            </h2>
          </div>

          {/* File upload */}
          {parsedRows.length === 0 && !result && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a CSV file to import {typeLabels[currentType as ImportDataType].toLowerCase()}
              </p>
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

          {/* Column mapping */}
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
                <Button variant="outline" onClick={() => { reset(); if (fileRef.current) fileRef.current.value = ''; }}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing || missingRequired.length > 0}>
                  {importing ? 'Importing...' : `Import ${parsedRows.length} ${typeLabels[currentType as ImportDataType]}`}
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

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {result.failed === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <p className="font-medium">
                  {result.success} of {result.total} {typeLabels[currentType as ImportDataType].toLowerCase()} imported
                </p>
              </div>

              {currentType === 'invoices' && result.success > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    All imported invoices have been created as <strong>drafts</strong> with an "IMP-" prefix. Review and issue them when ready.
                  </AlertDescription>
                </Alert>
              )}

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
                <Button onClick={handleNextType}>
                  {currentTypeIndex < selectedTypes.length - 1
                    ? `Next: Import ${typeLabels[selectedTypes[currentTypeIndex + 1]]}`
                    : 'Done'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
