import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, 
  Check,
  X,
  AlertCircle,
  Info,
  Plus,
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTaxSchemas, useCreateTaxSchema, useUpdateTaxSchema, TaxSchema } from '@/hooks/use-tax-schemas';
import { toast } from 'sonner';

const JURISDICTIONS = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
];

export default function AdminCountryModules() {
  const { data: taxSchemas, isLoading } = useTaxSchemas();
  const createTaxSchema = useCreateTaxSchema();
  const updateTaxSchema = useUpdateTaxSchema();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSchema, setNewSchema] = useState({
    jurisdiction: '',
    version: '',
    name: '',
    rates: '',
    effective_from: '',
    effective_until: '',
  });

  // Group schemas by jurisdiction
  const schemasByJurisdiction = taxSchemas?.reduce((acc, schema) => {
    if (!acc[schema.jurisdiction]) {
      acc[schema.jurisdiction] = [];
    }
    acc[schema.jurisdiction].push(schema);
    return acc;
  }, {} as Record<string, TaxSchema[]>) || {};

  const enabledJurisdictions = Object.keys(schemasByJurisdiction).filter(
    j => schemasByJurisdiction[j].some(s => s.is_active)
  );

  const handleToggleSchema = async (schema: TaxSchema) => {
    try {
      await updateTaxSchema.mutateAsync({
        id: schema.id,
        updates: { is_active: !schema.is_active }
      });
    } catch (error) {
      console.error('Failed to toggle schema:', error);
    }
  };

  const handleCreateSchema = async () => {
    if (!newSchema.jurisdiction || !newSchema.version || !newSchema.name || !newSchema.rates || !newSchema.effective_from) {
      toast.error('Please fill in all required fields');
      return;
    }

    let parsedRates;
    try {
      parsedRates = JSON.parse(newSchema.rates);
    } catch {
      toast.error('Invalid JSON format for rates');
      return;
    }

    try {
      await createTaxSchema.mutateAsync({
        jurisdiction: newSchema.jurisdiction,
        version: newSchema.version,
        name: newSchema.name,
        rates: parsedRates,
        effective_from: newSchema.effective_from,
        effective_until: newSchema.effective_until || null,
        is_active: true,
      });
      setCreateDialogOpen(false);
      setNewSchema({
        jurisdiction: '',
        version: '',
        name: '',
        rates: '',
        effective_from: '',
        effective_until: '',
      });
    } catch (error) {
      console.error('Failed to create schema:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Country Modules & Tax Schemas</h1>
          <p className="text-muted-foreground">Manage tax schemas and invoice formats by jurisdiction</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Tax Schema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Tax Schema Version</DialogTitle>
              <DialogDescription>
                Create a new version of a tax schema. Existing versions cannot be edited—only new versions can be created.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jurisdiction *</Label>
                  <Select 
                    value={newSchema.jurisdiction} 
                    onValueChange={(v) => setNewSchema({ ...newSchema, jurisdiction: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {JURISDICTIONS.map((j) => (
                        <SelectItem key={j.code} value={j.code}>
                          {j.code} - {j.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Version *</Label>
                  <Input 
                    placeholder="e.g., 2025.1" 
                    value={newSchema.version}
                    onChange={(e) => setNewSchema({ ...newSchema, version: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Schema Name *</Label>
                <Input 
                  placeholder="e.g., Nigeria VAT 2025" 
                  value={newSchema.name}
                  onChange={(e) => setNewSchema({ ...newSchema, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Rates (JSON) *</Label>
                <Textarea 
                  placeholder='{"vat": 7.5, "withholding": 5}'
                  value={newSchema.rates}
                  onChange={(e) => setNewSchema({ ...newSchema, rates: e.target.value })}
                  className="font-mono text-sm"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Effective From *</Label>
                  <Input 
                    type="date" 
                    value={newSchema.effective_from}
                    onChange={(e) => setNewSchema({ ...newSchema, effective_from: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Until (optional)</Label>
                  <Input 
                    type="date" 
                    value={newSchema.effective_until}
                    onChange={(e) => setNewSchema({ ...newSchema, effective_until: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSchema} disabled={createTaxSchema.isPending}>
                {createTaxSchema.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Schema
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4"
      >
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">Tax Schema Versioning</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Tax schemas are immutable once created. To update tax rates, create a new version with new effective dates.
              Invoices capture the active schema at time of issuance, ensuring compliance audit trails.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Schemas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxSchemas?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Jurisdictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{enabledJurisdictions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Schemas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {taxSchemas?.filter(s => s.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Schemas by Jurisdiction */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Tax Schemas by Jurisdiction
          </CardTitle>
          <CardDescription>
            Manage tax schema versions for each country. Toggle schemas to enable/disable them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {JURISDICTIONS.map((jurisdiction) => {
              const schemas = schemasByJurisdiction[jurisdiction.code] || [];
              const hasActiveSchema = schemas.some(s => s.is_active);
              
              return (
                <motion.div
                  key={jurisdiction.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm">
                        {jurisdiction.code}
                      </div>
                      <div>
                        <span className="font-medium">{jurisdiction.name}</span>
                        {hasActiveSchema ? (
                          <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="ml-2 text-muted-foreground">
                            <X className="h-3 w-3 mr-1" />
                            No Active Schema
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {schemas.length > 0 ? (
                    <div className="ml-13 space-y-2">
                      {schemas.map((schema) => (
                        <div
                          key={schema.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            schema.is_active ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : 'border-muted'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{schema.name}</span>
                                <Badge variant="secondary" className="text-xs font-mono">
                                  v{schema.version}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(schema.effective_from)}
                                  {schema.effective_until && ` → ${formatDate(schema.effective_until)}`}
                                </span>
                                <span>•</span>
                                <span className="font-mono">
                                  {JSON.stringify(schema.rates)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`toggle-${schema.id}`} className="sr-only">
                              Toggle {schema.name}
                            </Label>
                            <Switch
                              id={`toggle-${schema.id}`}
                              checked={schema.is_active}
                              onCheckedChange={() => handleToggleSchema(schema)}
                              disabled={updateTaxSchema.isPending}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ml-13 text-sm text-muted-foreground italic">
                      No tax schemas configured for this jurisdiction
                    </p>
                  )}
                  
                  <Separator className="mt-4" />
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-muted bg-muted/30 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Schema Changes Logged</p>
            <p className="text-sm text-muted-foreground">
              All changes to tax schemas are recorded in the audit log. Creating or toggling schemas 
              does not affect existing invoices—they retain the schema snapshot from time of issuance.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
