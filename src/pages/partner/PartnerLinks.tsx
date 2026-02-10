import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePartnerLinks, useCreateLink, useUpdateLink } from '@/hooks/use-partner';
import { toast } from '@/hooks/use-toast';
import { Link2, Plus, Copy, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PartnerLinks = () => {
  const { data: links, isLoading } = usePartnerLinks();
  const createLink = useCreateLink();
  const updateLink = useUpdateLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLandingPage, setNewLandingPage] = useState('');

  const handleCreate = async () => {
    if (!newCode.trim()) {
      toast({ title: 'Code is required', variant: 'destructive' });
      return;
    }
    try {
      await createLink.mutateAsync({ code: newCode.trim().toLowerCase(), landingPage: newLandingPage.trim() || undefined });
      toast({ title: 'Referral link created' });
      setDialogOpen(false);
      setNewCode('');
      setNewLandingPage('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateLink.mutateAsync({ id, is_active: !currentActive });
      toast({ title: currentActive ? 'Link deactivated' : 'Link activated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Referral Links</h1>
          <p className="text-muted-foreground mt-1">Manage your referral tracking links</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Referral Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Short Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. john20"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                />
                <p className="text-xs text-muted-foreground">
                  Your link will be: {window.location.origin}/r/{newCode || 'your-code'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="landing">Landing Page (optional)</Label>
                <Input
                  id="landing"
                  placeholder="https://invoicemonk.com/pricing"
                  value={newLandingPage}
                  onChange={(e) => setNewLandingPage(e.target.value)}
                />
              </div>
              <Button onClick={handleCreate} disabled={createLink.isPending} className="w-full">
                {createLink.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Your Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !links || links.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No referral links yet. Create one to start tracking referrals.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-mono font-medium">{link.code}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {window.location.origin}/r/{link.code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={link.is_active ? 'default' : 'secondary'}>
                        {link.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(link.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => copyLink(link.code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={link.is_active}
                          onCheckedChange={() => handleToggleActive(link.id, link.is_active)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerLinks;
