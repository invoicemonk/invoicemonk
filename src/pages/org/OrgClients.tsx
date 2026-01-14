import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { Plus, Search, Mail, Phone, Building2, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgClients, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/use-clients';
import { toast } from 'sonner';

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  tax_id: string;
  notes: string;
}

const initialFormData: ClientFormData = {
  name: '',
  email: '',
  phone: '',
  tax_id: '',
  notes: ''
};

export default function OrgClients() {
  const { orgId } = useParams();
  const { currentOrg } = useOrganization();
  const { data: clients, isLoading } = useOrgClients(orgId);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);

  const filteredClients = clients?.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDialog = (clientId?: string) => {
    if (clientId) {
      const client = clients?.find(c => c.id === clientId);
      if (client) {
        setFormData({
          name: client.name,
          email: client.email || '',
          phone: client.phone || '',
          tax_id: client.tax_id || '',
          notes: client.notes || ''
        });
        setEditingClient(clientId);
      }
    } else {
      setFormData(initialFormData);
      setEditingClient(null);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Client name is required');
      return;
    }

    try {
      if (editingClient) {
        await updateClient.mutateAsync({
          clientId: editingClient,
          updates: {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            tax_id: formData.tax_id || null,
            notes: formData.notes || null
          }
        });
        toast.success('Client updated');
      } else {
        await createClient.mutateAsync({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          tax_id: formData.tax_id || null,
          notes: formData.notes || null,
          business_id: orgId
        });
        toast.success('Client created');
      }
      setDialogOpen(false);
      setFormData(initialFormData);
      setEditingClient(null);
    } catch (error) {
      console.error('Failed to save client:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    try {
      await deleteClient.mutateAsync(deletingClient);
      toast.success('Client deleted');
      setDeleteDialogOpen(false);
      setDeletingClient(null);
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage clients for {currentOrg?.name}</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />Add Client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredClients?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-4">Add your first client to get started</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />Add Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients?.map(client => (
            <Card key={client.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-lg">{client.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenDialog(client.id)}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => {
                        setDeletingClient(client.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.tax_id && (
                  <div className="text-xs text-muted-foreground">
                    Tax ID: {client.tax_id}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Update client information' : 'Add a new client to your organization'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input 
                value={formData.phone} 
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+234..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tax ID</Label>
              <Input 
                value={formData.tax_id} 
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="Tax identification number"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={formData.notes} 
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createClient.isPending || updateClient.isPending}>
              {(createClient.isPending || updateClient.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingClient ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
