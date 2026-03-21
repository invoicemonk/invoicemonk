import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPartners, useUpdatePartnerStatus, useMarkPayoutPaid } from '@/hooks/use-admin-partners';
import { useAdminPartnerApplications, useApprovePartnerApplication, useRejectPartnerApplication } from '@/hooks/use-partner-applications';
import { toast } from '@/hooks/use-toast';
import { Users, Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
  const { data: applications, isLoading: appsLoading } = useAdminPartnerApplications();
  const updateStatus = useUpdatePartnerStatus();
  const approveApp = useApprovePartnerApplication();
  const rejectApp = useRejectPartnerApplication();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const pendingApps = applications?.filter((a: any) => a.status === 'pending') || [];

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: `Partner ${status}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleApprove = async (app: any) => {
    try {
      await approveApp.mutateAsync(app);
      toast({ title: 'Partner approved', description: `${app.name} is now a partner.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleReject = async (app: any) => {
    try {
      await rejectApp.mutateAsync({ id: app.id });
      toast({ title: 'Application rejected' });
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

      <Tabs defaultValue="partners">
        <TabsList>
          <TabsTrigger value="partners">Partners ({partners?.length || 0})</TabsTrigger>
          <TabsTrigger value="applications">
            Applications
            {pendingApps.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{pendingApps.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
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
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Partner Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {appsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !applications || applications.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No applications yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Motivation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app: any) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.name}</TableCell>
                        <TableCell className="text-muted-foreground">{app.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {app.motivation || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={app.status === 'pending' ? 'secondary' : app.status === 'approved' ? 'default' : 'destructive'}>
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(app.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(app)}
                                disabled={approveApp.isPending}
                              >
                                {approveApp.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(app)}
                                disabled={rejectApp.isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
