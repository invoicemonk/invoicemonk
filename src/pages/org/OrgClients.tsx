import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { Plus, Search, Mail, Phone, Building2, Loader2, MoreHorizontal, Pencil, Trash2, User, Info, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgClients, useCreateClient, useUpdateClient, useDeleteClient } from '@/hooks/use-clients';
import { getJurisdictionConfig } from '@/lib/jurisdiction-config';
import { toast } from 'sonner';

interface AddressData {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  tax_id: string;
  notes: string;
  client_type: 'individual' | 'company';
  cac_number: string;
  contact_person: string;
  address: AddressData;
}

const initialFormData: ClientFormData = {
  name: '',
  email: '',
  phone: '',
  tax_id: '',
  notes: '',
  client_type: 'company',
  cac_number: '',
  contact_person: '',
  address: { street: '', city: '', state: '', postal_code: '', country: '' }
};

export default function OrgClients() {
  const { orgId } = useParams();
  const { currentOrg } = useOrganization();
  const { data: clients, isLoading } = useOrgClients(orgId);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  // Get jurisdiction config based on org's jurisdiction
  const jurisdictionConfig = getJurisdictionConfig(currentOrg?.jurisdiction || 'NG');

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const [showAddress, setShowAddress] = useState(false);

  const filteredClients = clients?.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDialog = (clientId?: string) => {
    if (clientId) {
      const client = clients?.find(c => c.id === clientId);
      if (client) {
        const clientAddress = client.address as Record<string, string> | null;
        const parsedAddress: AddressData = {
          street: clientAddress?.street || '',
          city: clientAddress?.city || '',
          state: clientAddress?.state || '',
          postal_code: clientAddress?.postal_code || '',
          country: clientAddress?.country || ''
        };
        setFormData({
          name: client.name,
          email: client.email || '',
          phone: client.phone || '',
          tax_id: client.tax_id || '',
          notes: client.notes || '',
          client_type: (client.client_type as 'individual' | 'company') || 'company',
          cac_number: client.cac_number || '',
          contact_person: client.contact_person || '',
          address: parsedAddress
        });
        setEditingClient(clientId);
        // Show address section if client has address data
        setShowAddress(!!clientAddress && Object.values(clientAddress).some(v => v));
      }
    } else {
      setFormData(initialFormData);
      setEditingClient(null);
      setShowAddress(false);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Client name is required');
      return;
    }

    // Build address object only if any field is filled
    const hasAddress = Object.values(formData.address).some(v => v.trim() !== '');
    const addressData = hasAddress ? { ...formData.address } : null;

    try {
      if (editingClient) {
        await updateClient.mutateAsync({
          clientId: editingClient,
          updates: {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            tax_id: formData.tax_id || null,
            notes: formData.notes || null,
            client_type: formData.client_type,
            cac_number: formData.client_type === 'company' ? (formData.cac_number || null) : null,
            contact_person: formData.client_type === 'company' ? (formData.contact_person || null) : null,
            address: addressData
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
          client_type: formData.client_type,
          cac_number: formData.client_type === 'company' ? (formData.cac_number || null) : null,
          contact_person: formData.client_type === 'company' ? (formData.contact_person || null) : null,
          address: addressData,
          business_id: orgId
        });
        toast.success('Client created');
      }
      setDialogOpen(false);
      setShowAddress(false);
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
            {/* Client Type */}
            <div className="space-y-3">
              <Label>Client Type</Label>
              <RadioGroup
                value={formData.client_type}
                onValueChange={(v) => setFormData({ ...formData, client_type: v as 'individual' | 'company' })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="company" id="org-company" />
                  <Label htmlFor="org-company" className="flex items-center gap-1.5 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Company
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="org-individual" />
                  <Label htmlFor="org-individual" className="flex items-center gap-1.5 cursor-pointer">
                    <User className="h-4 w-4" />
                    Individual
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>{formData.client_type === 'company' ? 'Company Name' : 'Full Name'} *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.client_type === 'company' ? 'Acme Corporation Ltd.' : 'John Doe'}
              />
            </div>

            {/* Contact Person (for companies) */}
            {formData.client_type === 'company' && (
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input 
                  value={formData.contact_person} 
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
            )}

            {/* Contact Details */}
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder={`${jurisdictionConfig.phonePrefix} ...`}
                />
              </div>
            </div>

            {/* Tax & Compliance */}
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-muted-foreground" />
                Tax & Compliance
              </div>
              
              <div className="space-y-2">
                <Label>{jurisdictionConfig.clientTaxIdLabel}</Label>
                <Input 
                  value={formData.tax_id} 
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder={jurisdictionConfig.clientTaxIdPlaceholder}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {jurisdictionConfig.clientTaxIdHint}
                </p>
              </div>

              {formData.client_type === 'company' && jurisdictionConfig.showClientReg && (
                <div className="space-y-2">
                  <Label>{jurisdictionConfig.clientRegLabel}</Label>
                  <Input 
                    value={formData.cac_number} 
                    onChange={(e) => setFormData({ ...formData, cac_number: e.target.value })}
                    placeholder={jurisdictionConfig.clientRegPlaceholder}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {jurisdictionConfig.clientRegHint}
                  </p>
                </div>
              )}
            </div>

            {/* Address Section */}
            <Collapsible open={showAddress} onOpenChange={setShowAddress} className="space-y-2 pt-2 border-t">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Address (Optional)
                  </div>
                  {showAddress ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input
                    placeholder="123 Main Street"
                    value={formData.address.street}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      address: { ...formData.address, street: e.target.value } 
                    })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="Lagos"
                      value={formData.address.city}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        address: { ...formData.address, city: e.target.value } 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State / Region</Label>
                    <Input
                      placeholder="Lagos State"
                      value={formData.address.state}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        address: { ...formData.address, state: e.target.value } 
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input
                      placeholder="100001"
                      value={formData.address.postal_code}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        address: { ...formData.address, postal_code: e.target.value } 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      placeholder="Nigeria"
                      value={formData.address.country}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        address: { ...formData.address, country: e.target.value } 
                      })}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Notes */}
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
