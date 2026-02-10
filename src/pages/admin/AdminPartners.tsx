import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminPartners, useUpdatePartnerStatus } from '@/hooks/use-admin-partners';
import { toast } from '@/hooks/use-toast';
import { Users, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreatePartnerDialog } from '@/components/admin/CreatePartnerDialog';
import { PartnerDetailSheet } from '@/components/admin/PartnerDetailSheet';

const statusVariant = (status: string) => {
  switch (status) {
    case 'active': return 'default' as const;
    case 'paused': return 'secondary' as const;
    case 'suspended': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

const AdminPartners = () => {
  const { data: partners, isLoading } = useAdminPartners();
  const updateStatus = useUpdatePartnerStatus();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: `Partner ${status}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const selectedPartner = partners?.find((p) => p.id === selectedPartnerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Partners</h1>
          <p className="text-muted-foreground mt-1">Manage referral partners and commissions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Partners ({partners?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !partners || partners.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No partners yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedPartnerId(p.id)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>{(Number(p.commission_rate) * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={p.status}
                        onValueChange={(val) => handleStatusChange(p.id, val)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePartnerDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PartnerDetailSheet
        partner={selectedPartner || null}
        open={!!selectedPartnerId}
        onOpenChange={(open) => !open && setSelectedPartnerId(null)}
      />
    </div>
  );
};

export default AdminPartners;
