import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Search, 
  MoreHorizontal,
  Users,
  CreditCard,
  Eye,
  Globe,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminBusinesses } from '@/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { BusinessDetailSheet } from '@/components/admin/BusinessDetailSheet';
import { MembersDialog } from '@/components/admin/MembersDialog';
import { SubscriptionDialog } from '@/components/admin/SubscriptionDialog';

export default function AdminBusinesses() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: businesses, isLoading } = useAdminBusinesses(searchQuery || undefined);

  // Dialog/Sheet state
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const getSubscriptionBadge = (subscriptions: any[]) => {
    if (!subscriptions || subscriptions.length === 0) {
      return <Badge variant="outline">No subscription</Badge>;
    }
    const sub = subscriptions[0];
    const tierVariant = sub.tier === 'business' ? 'default' : 
                        sub.tier === 'professional' ? 'secondary' : 'outline';
    return (
      <div className="flex items-center gap-2">
        <Badge variant={tierVariant} className="capitalize">{sub.tier}</Badge>
        {sub.status !== 'active' && (
          <Badge variant="destructive" className="text-xs">{sub.status}</Badge>
        )}
      </div>
    );
  };

  // Handlers
  const handleViewDetails = (business: any) => {
    setSelectedBusiness(business);
    setDetailsOpen(true);
  };

  const handleViewMembers = (business: any) => {
    setSelectedBusiness(business);
    setMembersOpen(true);
  };

  const handleManageSubscription = (business: any) => {
    setSelectedBusiness(business);
    setSubscriptionOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Management</h1>
        <p className="text-muted-foreground">View organization profiles and subscription status</p>
      </div>

      {/* Admin Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Admin Access</p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Business data is for inspection only. Subscription changes require mandatory reason logging.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search businesses by name, legal name, or tax ID..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Businesses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Businesses
          </CardTitle>
          <CardDescription>
            {businesses?.length || 0} organizations found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Legal Name</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : businesses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No businesses found</p>
                  </TableCell>
                </TableRow>
              ) : (
                businesses?.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell className="font-medium">{business.name}</TableCell>
                    <TableCell>{business.legal_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {business.jurisdiction}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {(business as any).business_members?.[0]?.count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getSubscriptionBadge((business as any).subscriptions || [])}
                    </TableCell>
                    <TableCell>
                      {format(new Date(business.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(business)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewMembers(business)}>
                            <Users className="mr-2 h-4 w-4" />
                            View Members
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageSubscription(business)}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Manage Subscription
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs & Sheets */}
      <BusinessDetailSheet 
        business={selectedBusiness} 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
      />
      <MembersDialog 
        business={selectedBusiness} 
        open={membersOpen} 
        onOpenChange={setMembersOpen} 
      />
      <SubscriptionDialog 
        business={selectedBusiness} 
        open={subscriptionOpen} 
        onOpenChange={setSubscriptionOpen} 
      />
    </div>
  );
}
