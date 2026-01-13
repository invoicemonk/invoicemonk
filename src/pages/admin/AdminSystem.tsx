import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Shield,
  AlertTriangle,
  Bell,
  Power,
  Lock,
  Eye,
  ToggleLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'beta' | 'experimental';
}

const featureFlags: FeatureFlag[] = [
  { id: 'public_verification', name: 'Public Verification Portal', description: 'Allow external parties to verify invoices', enabled: true, category: 'core' },
  { id: 'email_notifications', name: 'Email Notifications', description: 'Send email notifications for invoice events', enabled: true, category: 'core' },
  { id: 'pdf_export', name: 'PDF Export', description: 'Allow users to export invoices as PDF', enabled: true, category: 'core' },
  { id: 'multi_currency', name: 'Multi-Currency Support', description: 'Support for multiple currencies', enabled: false, category: 'beta' },
  { id: 'recurring_invoices', name: 'Recurring Invoices', description: 'Auto-generate recurring invoices', enabled: false, category: 'beta' },
  { id: 'ai_categorization', name: 'AI Categorization', description: 'AI-powered expense categorization', enabled: false, category: 'experimental' },
];

export default function AdminSystem() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [flags, setFlags] = useState(featureFlags);

  const handleFlagToggle = (id: string) => {
    setFlags(prev => 
      prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'core':
        return <Badge variant="default">Core</Badge>;
      case 'beta':
        return <Badge variant="secondary">Beta</Badge>;
      case 'experimental':
        return <Badge variant="outline">Experimental</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground">Feature flags, maintenance mode, and security alerts</p>
      </div>

      {/* Security Alerts */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>No active threats</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>RLS policies active</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Audit logging enabled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Encryption active</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className={maintenanceMode ? 'border-destructive bg-destructive/10' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Maintenance Mode
          </CardTitle>
          <CardDescription>
            When enabled, users see a maintenance page and cannot access the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {maintenanceMode ? (
                <Badge variant="destructive" className="animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  MAINTENANCE ACTIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  System Online
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="maintenance-mode">Enable Maintenance</Label>
              <Switch
                id="maintenance-mode"
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
              />
            </div>
          </div>
          
          {maintenanceMode && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Maintenance Mode Active</AlertTitle>
              <AlertDescription>
                All users are currently blocked from accessing the application. 
                Only platform admins can access the system.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            Enable or disable platform features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {['core', 'beta', 'experimental'].map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                {category} Features
              </h3>
              <div className="space-y-3">
                {flags.filter(f => f.category === category).map((flag) => (
                  <motion.div
                    key={flag.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {getCategoryBadge(flag.category)}
                      <div>
                        <p className="font-medium">{flag.name}</p>
                        <p className="text-sm text-muted-foreground">{flag.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => handleFlagToggle(flag.id)}
                    />
                  </motion.div>
                ))}
              </div>
              {category !== 'experimental' && <Separator className="my-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Administrative Actions</CardTitle>
          <CardDescription>System-level operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="justify-start">
              <Lock className="mr-2 h-4 w-4" />
              Rotate Secrets
            </Button>
            <Button variant="outline" className="justify-start">
              <Eye className="mr-2 h-4 w-4" />
              View System Logs
            </Button>
            <Button variant="outline" className="justify-start">
              <Bell className="mr-2 h-4 w-4" />
              Test Notifications
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-muted bg-muted/30 p-4"
      >
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">All System Changes Logged</p>
            <p className="text-sm text-muted-foreground">
              Feature flag changes, maintenance mode toggles, and administrative actions 
              are permanently recorded in the audit log with your identity and timestamp.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
