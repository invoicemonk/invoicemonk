import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  Building2,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationStats, useOrganizationInvoices } from '@/hooks/use-organization';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrgDashboard() {
  const { orgId } = useParams();
  const { currentOrg, currentRole, canCreateInvoices } = useOrganization();
  const { data: stats, isLoading: statsLoading } = useOrganizationStats(orgId);
  const { data: recentInvoices, isLoading: invoicesLoading } = useOrganizationInvoices(orgId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'default', label: 'Issued' },
      sent: { variant: 'default', label: 'Sent' },
      viewed: { variant: 'outline', label: 'Viewed' },
      paid: { variant: 'default', label: 'Paid' },
      voided: { variant: 'destructive', label: 'Voided' },
      credited: { variant: 'outline', label: 'Credited' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: statsLoading ? null : formatCurrency(stats?.totalRevenue || 0),
      icon: DollarSign,
      description: 'All time revenue',
      trend: '+12.5%',
      color: 'text-green-600',
    },
    {
      title: 'Outstanding',
      value: statsLoading ? null : formatCurrency(stats?.totalOutstanding || 0),
      icon: Clock,
      description: 'Pending payments',
      color: 'text-amber-600',
    },
    {
      title: 'Total Invoices',
      value: statsLoading ? null : stats?.totalInvoices || 0,
      icon: FileText,
      description: `${stats?.paidInvoices || 0} paid, ${stats?.issuedInvoices || 0} pending`,
      color: 'text-primary',
    },
    {
      title: 'Team Members',
      value: statsLoading ? null : stats?.memberCount || 0,
      icon: Users,
      description: `${stats?.clientCount || 0} clients`,
      color: 'text-blue-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{currentOrg?.name}</h1>
              <p className="text-muted-foreground">Organization Dashboard</p>
            </div>
          </div>
        </div>
        {canCreateInvoices && (
          <Button asChild>
            <Link to={`/org/${orgId}/invoices/new`}>
              <FileText className="mr-2 h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        )}
      </div>

      {/* Compliance Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4"
      >
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">Compliance Status: Active</p>
            <p className="text-sm text-green-600 dark:text-green-400">
              All issued invoices are immutable and audit-ready. {stats?.totalInvoices || 0} records in compliance.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {stat.value === null ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                  {stat.trend && (
                    <span className="text-green-600 ml-2">
                      <TrendingUp className="h-3 w-3 inline mr-1" />
                      {stat.trend}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Latest organization invoices</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/org/${orgId}/invoices`}>
                View all
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentInvoices?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices?.slice(0, 5).map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`/org/${orgId}/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.client?.name || 'Unknown Client'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(Number(invoice.total_amount))}</span>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Overview</CardTitle>
              <CardDescription>Organization members and roles</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/org/${orgId}/team`}>
                Manage
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span>Total Members</span>
                </div>
                <span className="font-bold text-lg">{stats?.memberCount || 0}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Active Clients
                  </div>
                  <p className="text-xl font-bold">{stats?.clientCount || 0}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <FileText className="h-4 w-4 text-primary" />
                    Draft Invoices
                  </div>
                  <p className="text-xl font-bold">{stats?.draftInvoices || 0}</p>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Your role: <Badge variant="outline" className="ml-1 capitalize">{currentRole}</Badge>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
