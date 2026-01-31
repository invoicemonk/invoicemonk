import { motion } from 'framer-motion';
import { 
  CreditCard, 
  AlertCircle,
  TrendingUp,
  Users,
  DollarSign,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminStats } from '@/hooks/use-admin';
import { useRealtimeAdminStats } from '@/hooks/use-realtime-admin';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminBilling() {
  const { data: stats, isLoading } = useAdminStats();
  
  // Enable realtime updates for subscription changes
  useRealtimeAdminStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing Management</h1>
        <p className="text-muted-foreground">Subscription oversight and overrides</p>
      </div>

      {/* Mandatory Logging Notice */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Mandatory Reason Logging</p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              All subscription overrides require a written reason that is permanently logged 
              to the audit trail for compliance and accountability.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Subscription Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.subscriptionStats?.active || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Currently paying</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.subscriptionStats?.cancelled || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Churned accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Starter Tier</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.subscriptionStats?.starter || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Free tier users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Tier</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.subscriptionStats?.business || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Enterprise accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Tier Distribution
          </CardTitle>
          <CardDescription>Overview of subscription plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Badge variant="outline">Starter</Badge>
                <span className="text-muted-foreground">Free tier with basic features</span>
              </div>
              <span className="text-2xl font-bold">{stats?.subscriptionStats?.starter || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">Professional</Badge>
                <span className="text-muted-foreground">Individual professionals</span>
              </div>
              <span className="text-2xl font-bold">{stats?.subscriptionStats?.professional || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Badge variant="default">Business</Badge>
                <span className="text-muted-foreground">Organizations with teams</span>
              </div>
              <span className="text-2xl font-bold">{stats?.subscriptionStats?.business || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Override Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Administrative Actions</CardTitle>
          <CardDescription>
            Actions requiring mandatory reason logging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground p-6 text-center border-2 border-dashed rounded-lg">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>Subscription overrides are available from the Businesses management page.</p>
            <p className="mt-1">Each action requires a mandatory reason that is permanently logged.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
