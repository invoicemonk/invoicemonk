import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  User,
  Lock,
  Bell,
  Monitor,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { AccountClosureSection } from '@/components/settings/AccountClosureSection';
import { useUserPreferences, useUpdatePreferences } from '@/hooks/use-user-preferences';

export default function Settings() {
  const { profile, updatePassword } = useAuth();
  const { data: preferences, isLoading: preferencesLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  
  // Local state for notifications - synced with database
  const [notifications, setNotifications] = useState({
    emailInvoice: true,
    emailPayment: true,
    emailReminders: false,
    emailOverdue: true,
    browserNotifications: false,
    reminderDaysBefore: 3,
  });

  // Sync local state with database preferences
  useEffect(() => {
    if (preferences) {
      setNotifications({
        emailInvoice: preferences.email_invoice_issued,
        emailPayment: preferences.email_payment_received,
        emailReminders: preferences.email_payment_reminders,
        emailOverdue: preferences.email_overdue_alerts,
        browserNotifications: preferences.browser_notifications,
        reminderDaysBefore: preferences.reminder_days_before,
      });
    }
  }, [preferences]);

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure your new passwords match.',
        variant: 'destructive',
      });
      return;
    }

    if (passwords.new.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(passwords.new);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Error updating password',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Password updated',
        description: 'Your password has been successfully changed.',
      });
      setPasswords({ current: '', new: '', confirm: '' });
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean | number) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveNotifications = () => {
    updatePreferences.mutate({
      email_invoice_issued: notifications.emailInvoice,
      email_payment_received: notifications.emailPayment,
      email_payment_reminders: notifications.emailReminders,
      email_overdue_alerts: notifications.emailOverdue,
      browser_notifications: notifications.browserNotifications,
      reminder_days_before: notifications.reminderDaysBefore,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Monitor className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2 text-destructive data-[state=active]:text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  defaultValue={profile?.full_name || ''}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={profile?.email || ''}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                />
              </div>
              <Button onClick={handlePasswordChange} disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">Active now</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Current
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose what emails you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preferencesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Invoice Issued</p>
                      <p className="text-sm text-muted-foreground">
                        Receive confirmation when invoices are issued
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailInvoice}
                      onCheckedChange={(checked) => handleNotificationChange('emailInvoice', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Payment Received</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when payments are recorded
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailPayment}
                      onCheckedChange={(checked) => handleNotificationChange('emailPayment', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Payment Reminders</p>
                      <p className="text-sm text-muted-foreground">
                        Send reminder emails to clients before due dates
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailReminders}
                      onCheckedChange={(checked) => handleNotificationChange('emailReminders', checked)}
                    />
                  </div>
                  {notifications.emailReminders && (
                    <div className="ml-4 p-4 rounded-lg bg-muted/50 space-y-2">
                      <Label htmlFor="reminderDays">Days before due date</Label>
                      <Input
                        id="reminderDays"
                        type="number"
                        min={1}
                        max={14}
                        value={notifications.reminderDaysBefore}
                        onChange={(e) => handleNotificationChange('reminderDaysBefore', parseInt(e.target.value) || 3)}
                        className="w-24"
                      />
                      <p className="text-xs text-muted-foreground">
                        Clients will receive a reminder this many days before the invoice is due
                      </p>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Overdue Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when invoices become overdue
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailOverdue}
                      onCheckedChange={(checked) => handleNotificationChange('emailOverdue', checked)}
                    />
                  </div>
                  <Separator />
                  <Button 
                    onClick={handleSaveNotifications} 
                    disabled={updatePreferences.isPending}
                    className="mt-4"
                  >
                    {updatePreferences.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Notification Settings
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>
                Customize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Browser Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={notifications.browserNotifications}
                  onCheckedChange={(checked) => handleNotificationChange('browserNotifications', checked)}
                />
              </div>
              <Separator />
              <Button 
                onClick={handleSaveNotifications} 
                disabled={updatePreferences.isPending}
              >
                {updatePreferences.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab (Danger Zone) */}
        <TabsContent value="account">
          <AccountClosureSection userJurisdiction="NG" />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}