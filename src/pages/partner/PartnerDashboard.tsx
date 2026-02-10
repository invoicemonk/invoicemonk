import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MousePointerClick, Users, UserCheck, Coins } from 'lucide-react';
import { usePartnerStats } from '@/hooks/use-partner';
import { useEarningsByCurrency } from '@/hooks/use-commissions';
import { usePartnerContext } from '@/contexts/PartnerContext';
import { Skeleton } from '@/components/ui/skeleton';

const PartnerDashboard = () => {
  const { partner } = usePartnerContext();
  const { data: stats, isLoading: statsLoading } = usePartnerStats();
  const { data: earnings, isLoading: earningsLoading } = useEarningsByCurrency();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Partner Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {partner?.name || 'Partner'}. Here's your referral overview.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{stats?.clicks?.toLocaleString() || 0}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Signups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{stats?.signups?.toLocaleString() || 0}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Customers</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{stats?.activeCustomers?.toLocaleString() || 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Earnings by Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Earnings by Currency
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earningsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : !earnings || earnings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No earnings yet. Start referring customers to earn commissions!</p>
          ) : (
            <div className="space-y-4">
              {earnings.map((e) => (
                <div key={e.currency} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="font-semibold text-foreground min-w-[50px]">{e.currency}</span>
                  <Badge variant="outline" className="text-xs">
                    Pending: {e.pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Locked: {e.locked.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Badge>
                  <Badge className="text-xs bg-success text-success-foreground">
                    Paid: {e.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Badge>
                  <span className="ml-auto font-bold text-foreground">
                    Total: {e.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Rate */}
      {partner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Commission Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{(partner.commission_rate * 100).toFixed(0)}%</p>
            <p className="text-sm text-muted-foreground mt-1">Recurring on all subscription revenue from your referrals</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartnerDashboard;
