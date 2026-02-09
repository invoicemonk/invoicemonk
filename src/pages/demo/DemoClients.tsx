import { motion } from 'framer-motion';
import { 
  Users, Plus, Search, MoreHorizontal, Mail, Phone, 
  FileText, Building2, User, MapPin
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DemoLayout } from './DemoLayout';

// Sample Nigerian client data
const sampleClients = [
  {
    id: '1',
    name: 'Afritech Solutions Ltd',
    email: 'accounts@afritech.ng',
    phone: '+234 803 123 4567',
    client_type: 'company',
    tax_id: '12345678-0001',
    address: { city: 'Lagos', state: 'Lagos State' },
    invoice_count: 5,
    total_revenue: 2850000
  },
  {
    id: '2',
    name: 'Green Energy Nigeria',
    email: 'finance@greenenergy.ng',
    phone: '+234 805 987 6543',
    client_type: 'company',
    tax_id: '23456789-0001',
    address: { city: 'Abuja', state: 'FCT' },
    invoice_count: 3,
    total_revenue: 1650000
  },
  {
    id: '3',
    name: 'Fintech Partners',
    email: 'billing@fintechpartners.ng',
    phone: '+234 809 555 1234',
    client_type: 'company',
    tax_id: '34567890-0001',
    address: { city: 'Victoria Island', state: 'Lagos State' },
    invoice_count: 8,
    total_revenue: 4200000
  },
  {
    id: '4',
    name: 'Lagos Consulting Group',
    email: 'payments@lagosconsulting.ng',
    phone: '+234 801 222 3344',
    client_type: 'company',
    tax_id: '45678901-0001',
    address: { city: 'Ikeja', state: 'Lagos State' },
    invoice_count: 2,
    total_revenue: 640000
  },
  {
    id: '5',
    name: 'Naija Logistics',
    email: 'accounts@naijalogistics.ng',
    phone: '+234 802 333 4455',
    client_type: 'company',
    tax_id: '56789012-0001',
    address: { city: 'Port Harcourt', state: 'Rivers State' },
    invoice_count: 4,
    total_revenue: 1360000
  },
  {
    id: '6',
    name: 'Oluwaseun Adeyemi',
    email: 'seun.adeyemi@gmail.com',
    phone: '+234 806 444 5566',
    client_type: 'individual',
    tax_id: '67890123-0001',
    address: { city: 'Ibadan', state: 'Oyo State' },
    invoice_count: 1,
    total_revenue: 180000
  },
  {
    id: '7',
    name: 'West African Trade Co',
    email: 'finance@watrade.ng',
    phone: '+234 808 666 7788',
    client_type: 'company',
    tax_id: '78901234-0001',
    address: { city: 'Kano', state: 'Kano State' },
    invoice_count: 6,
    total_revenue: 3500000
  },
  {
    id: '8',
    name: 'Chidiebere Okonkwo',
    email: 'chidi.okonkwo@outlook.com',
    phone: '+234 807 555 8899',
    client_type: 'individual',
    tax_id: null,
    address: { city: 'Enugu', state: 'Enugu State' },
    invoice_count: 2,
    total_revenue: 420000
  },
];

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const formatCurrency = (amount: number) => {
  return `₦${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Stats
const stats = {
  total: sampleClients.length,
  companies: sampleClients.filter(c => c.client_type === 'company').length,
  individuals: sampleClients.filter(c => c.client_type === 'individual').length,
  totalRevenue: sampleClients.reduce((sum, c) => sum + c.total_revenue, 0)
};

export default function DemoClients() {
  return (
    <DemoLayout>
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
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Companies</p>
                  <p className="text-2xl font-bold">{stats.companies}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Individuals</p>
                  <p className="text-2xl font-bold">{stats.individuals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-9"
                disabled
              />
            </div>
          </CardContent>
        </Card>

        {/* Client Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sampleClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className={
                      client.client_type === 'company' 
                        ? 'bg-blue-500/10 text-blue-600' 
                        : 'bg-purple-500/10 text-purple-600'
                    }>
                      {getInitials(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold truncate">{client.name}</h3>
                        <Badge variant="outline" className="text-xs mt-1">
                          {client.client_type === 'company' ? (
                            <><Building2 className="h-3 w-3 mr-1" /> Company</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" /> Individual</>
                          )}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Client</DropdownMenuItem>
                          <DropdownMenuItem>Create Invoice</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone}</span>
                  </div>
                  {client.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{client.address.city}, {client.address.state}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{client.invoice_count} invoices</span>
                  </div>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(client.total_revenue)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </DemoLayout>
  );
}
