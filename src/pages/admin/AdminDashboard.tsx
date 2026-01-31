import { motion } from 'framer-motion';
import { 
  Users, 
  Building2, 
  FileText, 
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminStats } from '@/hooks/use-admin';
import { useRealtimeAdminStats } from '@/hooks/use-realtime-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  
  // Enable realtime updates for subscription changes
  useRealtimeAdminStats();

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.userCount || 0,
      icon: Users,
      description: 'Registered accounts',
      href: '/admin/users',
      color: 'text-blue-600',
    },
    {
      title: 'Businesses',
      value: stats?.businessCount || 0,
      icon: Building2,
      description: 'Active organizations',
      href: '/admin/businesses',
      color: 'text-green-600',
    },
    {
      title: 'Total Invoices',
      value: stats?.invoiceCount || 0,
      icon: FileText,
      description: 'All invoices',
      href: '/admin/invoices',
      color: 'text-primary',
    },
    {
      title: 'Active Subscriptions',
      value: stats?.subscriptionStats?.active || 0,
      icon: TrendingUp,
      description: 'Paid accounts',
      href: '/admin/billing',
      color: 'text-amber-600',
    },
  ];

  // Convert event counts to chart data
  const eventChartData = stats?.recentEventCounts 
    ? Object.entries(stats.recentEventCounts)
        .map(([event, count]) => ({
          event: event.replace(/_/g, ' ').toLowerCase(),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          Platform Admin Dashboard
        </h1>
        <p className="text-muted-foreground">System overview and health metrics</p>
      </div>

      {/* Admin Warning Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Elevated Access Mode</p>
            <p className="text-sm text-muted-foreground">
              You have platform admin privileges. All actions are logged and audited. 
              Invoice data is read-only and cannot be modified.
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
            <Link to={stat.href}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tiers</CardTitle>
            <CardDescription>Distribution of subscription plans</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Starter</Badge>
                  </div>
                  <span className="font-bold">{stats?.subscriptionStats?.starter || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Professional</Badge>
                  </div>
                  <span className="font-bold">{stats?.subscriptionStats?.professional || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Business</Badge>
                  </div>
                  <span className="font-bold">{stats?.subscriptionStats?.business || 0}</span>
                </div>
                <div className="pt-3 border-t flex justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Active: {stats?.subscriptionStats?.active || 0}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Cancelled: {stats?.subscriptionStats?.cancelled || 0}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Event Types</CardTitle>
            <CardDescription>Last 100 audit log events</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {isLoading || eventChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="event" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Platform status - Real-time monitoring via Supabase Dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              For real-time system health monitoring, please use the Supabase Dashboard.
            </p>
            <p className="text-xs text-muted-foreground">
              Database, Auth, Edge Functions, and Storage health are monitored directly through Supabase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
