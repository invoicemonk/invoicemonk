import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  Plus, 
  Filter, 
  Pencil, 
  Trash2, 
  Search,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminRetentionPolicies,
  useDeleteRetentionPolicy,
  useRetentionPolicyFilters,
  type RetentionPolicy,
} from '@/hooks/use-admin-retention-policies';
import { RetentionPolicyDialog } from '@/components/admin/RetentionPolicyDialog';

const FLAG_EMOJIS: Record<string, string> = {
  NG: '🇳🇬',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
  DE: '🇩🇪',
  FR: '🇫🇷',
  ZA: '🇿🇦',
  KE: '🇰🇪',
  GH: '🇬🇭',
};

const JURISDICTION_NAMES: Record<string, string> = {
  NG: 'Nigeria',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  ZA: 'South Africa',
  KE: 'Kenya',
  GH: 'Ghana',
};

const ENTITY_LABELS: Record<string, string> = {
  invoice: 'Invoices',
  payment: 'Payments',
  credit_note: 'Credit Notes',
  audit_log: 'Audit Logs',
  export_manifest: 'Export Records',
  client: 'Clients',
  business: 'Businesses',
};

export default function AdminRetentionPolicies() {
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<RetentionPolicy | null>(null);

  const { data: policies, isLoading } = useAdminRetentionPolicies({
    jurisdiction: jurisdictionFilter || undefined,
    entity_type: entityTypeFilter || undefined,
  });

  const { data: filterOptions } = useRetentionPolicyFilters();
  const deleteMutation = useDeleteRetentionPolicy();

  const filteredPolicies = policies?.filter((policy) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      policy.jurisdiction.toLowerCase().includes(search) ||
      policy.entity_type.toLowerCase().includes(search) ||
      policy.legal_basis?.toLowerCase().includes(search) ||
      JURISDICTION_NAMES[policy.jurisdiction]?.toLowerCase().includes(search) ||
      ENTITY_LABELS[policy.entity_type]?.toLowerCase().includes(search)
    );
  });

  const handleEdit = (policy: RetentionPolicy) => {
    setEditingPolicy(policy);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletingPolicy) {
      await deleteMutation.mutateAsync(deletingPolicy.id);
      setDeletingPolicy(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingPolicy(null);
    }
  };

  // Group policies by jurisdiction for summary
  const policyStats = policies?.reduce((acc, policy) => {
    acc[policy.jurisdiction] = (acc[policy.jurisdiction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retention Policies</h1>
          <p className="text-muted-foreground mt-1">
            Manage data retention periods by jurisdiction
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Policies</CardDescription>
            <CardTitle className="text-2xl">{policies?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jurisdictions</CardDescription>
            <CardTitle className="text-2xl">
              {Object.keys(policyStats).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Entity Types</CardDescription>
            <CardTitle className="text-2xl">
              {filterOptions?.entityTypes.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Max Retention</CardDescription>
            <CardTitle className="text-2xl">
              {policies?.reduce((max, p) => Math.max(max, p.retention_years), 0) || 0} years
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search policies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jurisdictions</SelectItem>
                  {filterOptions?.jurisdictions.map((j) => (
                    <SelectItem key={j} value={j}>
                      {FLAG_EMOJIS[j] || ''} {JURISDICTION_NAMES[j] || j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {filterOptions?.entityTypes.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ENTITY_LABELS[e] || e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredPolicies && filteredPolicies.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead className="text-center">Retention</TableHead>
                    <TableHead className="hidden md:table-cell">Legal Basis</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{FLAG_EMOJIS[policy.jurisdiction] || '🌍'}</span>
                          <span className="font-medium">
                            {JURISDICTION_NAMES[policy.jurisdiction] || policy.jurisdiction}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ENTITY_LABELS[policy.entity_type] || policy.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{policy.retention_years}</span>
                          <span className="text-muted-foreground text-sm">years</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground line-clamp-1">
                          {policy.legal_basis || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(policy)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingPolicy(policy)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No policies found</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm || jurisdictionFilter || entityTypeFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first retention policy'}
              </p>
              {!searchTerm && !jurisdictionFilter && !entityTypeFilter && (
                <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Policy
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <RetentionPolicyDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        policy={editingPolicy}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPolicy} onOpenChange={() => setDeletingPolicy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Retention Policy
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the retention policy for{' '}
              <strong>
                {ENTITY_LABELS[deletingPolicy?.entity_type || ''] || deletingPolicy?.entity_type}
              </strong>{' '}
              in{' '}
              <strong>
                {JURISDICTION_NAMES[deletingPolicy?.jurisdiction || ''] || deletingPolicy?.jurisdiction}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Policy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
