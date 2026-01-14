import { motion } from 'framer-motion';
import { 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganizations } from '@/hooks/use-organization';

const statsCards = [
  {
    title: 'Total Revenue',
    value: '₦0.00',
    change: '+0%',
    changeType: 'neutral' as const,
    icon: DollarSign,
    description: 'All time revenue',
  },
  {
    title: 'Outstanding',
    value: '₦0.00',
    change: '0 invoices',
    changeType: 'neutral' as const,
    icon: Clock,
    description: 'Pending payments',
  },
  {
    title: 'Paid This Month',
    value: '₦0.00',
    change: '0 invoices',
    changeType: 'neutral' as const,
    icon: CheckCircle2,
    description: 'January 2026',
  },
  {
    title: 'Draft Invoices',
    value: '0',
    change: 'Ready to issue',
    changeType: 'neutral' as const,
    icon: FileText,
    description: 'Awaiting completion',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { data: organizations } = useUserOrganizations();
  const currentBusiness = organizations?.[0]?.business;
  const isEmailVerified = user?.email_confirmed_at;
  
  // Server-derived compliance status
  const businessComplianceStatus = currentBusiness?.compliance_status || 'incomplete';

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome Section */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your invoices today.
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Link>
        </Button>
      </motion.div>

      {/* Email Verification Warning */}
      {!isEmailVerified && (
        <motion.div variants={item}>
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Email verification required
                </p>
                <p className="text-sm text-muted-foreground">
                  Please verify your email to issue invoices. Check your inbox for the verification link.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/verify-email">Verify Now</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks to get you started</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Link 
                to="/invoices/new"
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Create New Invoice</p>
                    <p className="text-sm text-muted-foreground">Draft a compliance-ready invoice</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
              
              <Link 
                to="/clients"
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Add a Client</p>
                    <p className="text-sm text-muted-foreground">Set up client billing details</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
              
              <Link 
                to="/business-profile"
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Complete Business Profile</p>
                    <p className="text-sm text-muted-foreground">Add your legal business details</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Compliance Status */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Compliance Status
              </CardTitle>
              <CardDescription>Your audit-readiness overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email Verified</span>
                  <Badge variant={isEmailVerified ? "default" : "secondary"}>
                    {isEmailVerified ? 'Complete' : 'Pending'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Business Profile</span>
                  <Badge variant={businessComplianceStatus === 'complete' ? 'default' : 'secondary'}>
                    {businessComplianceStatus === 'complete' ? 'Complete' : 'Incomplete'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Immutable Records</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Audit Trail</span>
                  <Badge variant="default">Enabled</Badge>
                </div>
              </div>
              
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  All invoice actions are permanently recorded in an immutable audit log for regulatory compliance.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Invoices (Empty State) */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Your latest invoice activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No invoices yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Create your first compliance-ready invoice to get started. All invoices are immutable once issued.
              </p>
              <Button asChild>
                <Link to="/invoices/new">Create Your First Invoice</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
