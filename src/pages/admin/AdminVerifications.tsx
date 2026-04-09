import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, FileText, Clock, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useVerificationQueue, type VerificationQueueItem } from '@/hooks/use-admin-verifications';
import { VerificationDetailSheet } from '@/components/admin/VerificationDetailSheet';
import { format } from 'date-fns';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'requires_action', label: 'Requires Action' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'verified':
      return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Verified</Badge>;
    case 'pending_review':
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending Review</Badge>;
    case 'requires_action':
      return <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"><AlertTriangle className="h-3 w-3" />Requires Action</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminVerifications() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBusiness, setSelectedBusiness] = useState<VerificationQueueItem | null>(null);

  const { data: queue, isLoading } = useVerificationQueue(
    statusFilter === 'all' ? null : statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Verifications</h1>
          <p className="text-muted-foreground text-sm">Review and manage business identity verification requests.</p>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Verification Queue
            {queue && <Badge variant="secondary" className="ml-2">{queue.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !queue || queue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No verification requests found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.legal_name && item.legal_name !== item.name && (
                        <span className="text-xs text-muted-foreground block">{item.legal_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{item.entity_type}</TableCell>
                    <TableCell>{getStatusBadge(item.verification_status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.document_count} doc{item.document_count !== 1 ? 's' : ''}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.verification_submitted_at
                        ? format(new Date(item.verification_submitted_at), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{item.jurisdiction || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedBusiness(item)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VerificationDetailSheet
        business={selectedBusiness}
        onClose={() => setSelectedBusiness(null)}
      />
    </div>
  );
}
