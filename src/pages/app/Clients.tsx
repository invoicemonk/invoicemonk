import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  FileText,
  Loader2,
  Building2,
  User,
  Info,
  MapPin,
  ChevronDown,
  ChevronUp,
  Globe
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClients, useCreateClient, type Client } from '@/hooks/use-clients';
import { useBusiness } from '@/contexts/BusinessContext';
import { getJurisdictionConfig, JURISDICTION_CONFIG } from '@/lib/jurisdiction-config';
import { useNavigate } from 'react-router-dom';
import { gaEvents } from '@/hooks/use-google-analytics';
import { COUNTRY_OPTIONS_WITH_OTHER } from '@/lib/countries';

export default function Clients() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const { data: clients = [], isLoading, error } = useClients(currentBusiness?.id);
  const createClient = useCreateClient();
  
  // Default to business jurisdiction
  const [clientCountry, setClientCountry] = useState(currentBusiness?.jurisdiction || 'NG');
  
  // Get jurisdiction config based on selected client country
  const jurisdictionConfig = getJurisdictionConfig(clientCountry);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    tax_id: '',
    client_type: 'company' as 'individual' | 'company',
    cac_number: '',
    contact_person: '',
    address: {
      street: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
    },
  });
  const [showAddress, setShowAddress] = useState(false);

  // Reset client country when dialog opens
  useEffect(() => {
    if (isAddDialogOpen) {
      setClientCountry(currentBusiness?.jurisdiction || 'NG');
    }
  }, [isAddDialogOpen, currentBusiness?.jurisdiction]);

  // Auto-fill country name when client country changes
  useEffect(() => {
    if (clientCountry !== 'OTHER') {
      setNewClient(prev => ({
        ...prev,
        address: {
          ...prev.address,
          country: jurisdictionConfig.countryName
        }
      }));
    }
  }, [clientCountry, jurisdictionConfig.countryName]);

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClient = async () => {
    if (!newClient.name) return;
    
    // Build address object only if any field is filled
    const hasAddress = Object.values(newClient.address).some(v => v.trim() !== '');
    const addressData = hasAddress ? newClient.address : null;
    
    await createClient.mutateAsync({
      name: newClient.name,
      email: newClient.email || null,
      phone: newClient.phone || null,
      tax_id: newClient.tax_id || null,
      client_type: newClient.client_type,
      cac_number: newClient.client_type === 'company' ? (newClient.cac_number || null) : null,
      contact_person: newClient.client_type === 'company' ? (newClient.contact_person || null) : null,
      address: addressData,
      business_id: currentBusiness?.id,
    });
    
    // Track client created event
    gaEvents.clientCreated();
    
    setIsAddDialogOpen(false);
    setShowAddress(false);
    setNewClient({ 
      name: '', 
      email: '', 
      phone: '', 
      tax_id: '', 
      client_type: 'company',
      cac_number: '',
      contact_person: '',
      address: { street: '', city: '', state: '', postal_code: '', country: '' },
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your client database
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Add a new client to your database for compliance-ready invoicing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Client Type */}
              <div className="space-y-3">
                <Label>Client Type</Label>
                <RadioGroup
                  value={newClient.client_type}
                  onValueChange={(v) => setNewClient({ ...newClient, client_type: v as 'individual' | 'company' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="company" id="company" />
                    <Label htmlFor="company" className="flex items-center gap-1.5 cursor-pointer">
                      <Building2 className="h-4 w-4" />
                      Company
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="flex items-center gap-1.5 cursor-pointer">
                      <User className="h-4 w-4" />
                      Individual
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  {newClient.client_type === 'company' ? 'Company Name' : 'Full Name'} *
                </Label>
                <Input
                  id="name"
                  placeholder={newClient.client_type === 'company' ? 'Acme Corporation Ltd.' : 'John Doe'}
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
              </div>

              {/* Contact Person (for companies) */}
              {newClient.client_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    placeholder="Jane Smith"
                    value={newClient.contact_person}
                    onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
                  />
                </div>
              )}

              {/* Client Country */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Client Location
                </Label>
                <Select value={clientCountry} onValueChange={setClientCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS_WITH_OTHER.map(country => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={`${jurisdictionConfig.phonePrefix} ...`}
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
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
                  <Label htmlFor="tax_id">{jurisdictionConfig.clientTaxIdLabel}</Label>
                  <Input
                    id="tax_id"
                    placeholder={jurisdictionConfig.clientTaxIdPlaceholder}
                    value={newClient.tax_id}
                    onChange={(e) => setNewClient({ ...newClient, tax_id: e.target.value })}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {jurisdictionConfig.clientTaxIdHint}
                  </p>
                </div>

              {newClient.client_type === 'company' && jurisdictionConfig.showClientReg && (
                  <div className="space-y-2">
                    <Label htmlFor="cac_number">{jurisdictionConfig.clientRegLabel}</Label>
                    <Input
                      id="cac_number"
                      placeholder={jurisdictionConfig.clientRegPlaceholder}
                      value={newClient.cac_number}
                      onChange={(e) => setNewClient({ ...newClient, cac_number: e.target.value })}
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
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      placeholder="123 Main Street"
                      value={newClient.address.street}
                      onChange={(e) => setNewClient({ 
                        ...newClient, 
                        address: { ...newClient.address, street: e.target.value } 
                      })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder={jurisdictionConfig.cityPlaceholder}
                        value={newClient.address.city}
                        onChange={(e) => setNewClient({ 
                          ...newClient, 
                          address: { ...newClient.address, city: e.target.value } 
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">{jurisdictionConfig.stateLabel}</Label>
                      <Input
                        id="state"
                        placeholder={jurisdictionConfig.statePlaceholder}
                        value={newClient.address.state}
                        onChange={(e) => setNewClient({ 
                          ...newClient, 
                          address: { ...newClient.address, state: e.target.value } 
                        })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">{jurisdictionConfig.postalCodeLabel}</Label>
                      <Input
                        id="postal_code"
                        placeholder={jurisdictionConfig.postalCodePlaceholder}
                        value={newClient.address.postal_code}
                        onChange={(e) => setNewClient({ 
                          ...newClient, 
                          address: { ...newClient.address, postal_code: e.target.value } 
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        placeholder={clientCountry === 'OTHER' ? 'Enter country' : jurisdictionConfig.countryName}
                        value={newClient.address.country}
                        onChange={(e) => setNewClient({ 
                          ...newClient, 
                          address: { ...newClient.address, country: e.target.value } 
                        })}
                        disabled={clientCountry !== 'OTHER'}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddClient} 
                disabled={!newClient.name || createClient.isPending}
              >
                {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <Users className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="font-semibold mb-1">Error loading clients</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm text-center">
              {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Client List */}
      {!isLoading && !error && filteredClients.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(client.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{client.name}</h3>
                      {client.tax_id && (
                        <p className="text-sm text-muted-foreground font-mono">{client.tax_id}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/clients/${client.id}`)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/invoices/new?client=${client.id}`)}>
                        Create Invoice
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="mt-4 space-y-2">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredClients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">
              {searchQuery ? 'No clients found' : 'No clients yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm text-center">
              {searchQuery 
                ? 'Try adjusting your search query.'
                : 'Add your first client to start creating invoices for them.'
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
