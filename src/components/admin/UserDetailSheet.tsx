import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Calendar, Shield, CheckCircle, XCircle, Ban, UserCheck, ShieldAlert, Globe, Monitor } from 'lucide-react';
import { format } from 'date-fns';
import { useBanUser, useUnbanUser } from '@/hooks/use-admin';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  account_status: string | null;
  closure_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_roles?: { role: string }[];
}

interface UserDetailSheetProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDetailSheet({ user, open, onOpenChange }: UserDetailSheetProps) {
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');

  if (!user) return null;

  const isSuspended = user.account_status === 'suspended' || user.account_status === 'closed';

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const getRoleBadge = (roles: { role: string }[] | undefined) => {
    if (!roles || roles.length === 0) {
      return <Badge variant="outline">user</Badge>;
    }
    const role = roles[0]?.role || 'user';
    const variant = role === 'platform_admin' ? 'destructive' : 
                    role === 'business_admin' ? 'default' : 'outline';
    return <Badge variant={variant}>{role}</Badge>;
  };

  const handleConfirmBan = () => {
    banUser.mutate(
      { userId: user.id, reason: banReason },
      { onSuccess: () => { setBanDialogOpen(false); setBanReason(''); } }
    );
  };

  const handleReactivate = () => {
    unbanUser.mutate({ userId: user.id });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>User Details</SheetTitle>
            <SheetDescription>
              View user profile and account information
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Suspended Banner */}
            {isSuspended && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Account Suspended</p>
                    {user.closure_reason && (
                      <p className="text-sm text-destructive/80 mt-1">{user.closure_reason}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.full_name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{user.full_name || 'Unnamed User'}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </div>
              </div>
            </div>

            <Separator />

            {/* Status & Role */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Account Status</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Role</p>
                  {getRoleBadge(user.user_roles)}
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email Verified</p>
                  {user.email_verified ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-600">
                      <XCircle className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Account Status</p>
                  <Badge variant={isSuspended ? 'destructive' : 'outline'}>
                    {user.account_status || 'active'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Ban/Unban Action */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Actions</h4>
              {isSuspended ? (
                <Button
                  variant="outline"
                  className="w-full text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                  onClick={handleReactivate}
                  disabled={unbanUser.isPending}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  {unbanUser.isPending ? 'Reactivating...' : 'Reactivate User'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive hover:bg-destructive/10"
                  onClick={() => { setBanReason(''); setBanDialogOpen(true); }}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend User
                </Button>
              )}
            </div>

            <Separator />

            {/* Dates */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Timeline</h4>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-medium">
                      {user.created_at 
                        ? format(new Date(user.created_at), 'MMMM d, yyyy')
                        : 'Unknown'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">
                      {user.updated_at 
                        ? format(new Date(user.updated_at), 'MMMM d, yyyy')
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* IP History */}
            <IPHistorySection userId={user.id} />

            <Separator />

            {/* User ID */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">System Info</h4>
              <div className="bg-muted rounded-md p-3">
                <p className="text-xs text-muted-foreground">User ID</p>
                <p className="font-mono text-xs break-all">{user.id}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Ban Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend User</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately block <strong>{user.email}</strong> from accessing the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="detail-ban-reason">Reason for suspension</Label>
            <Textarea
              id="detail-ban-reason"
              placeholder="Explain why this user is being suspended (min 10 characters)..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBan}
              disabled={banReason.trim().length < 10 || banUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {banUser.isPending ? 'Suspending...' : 'Suspend User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function IPHistorySection({ userId }: { userId: string }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['user-login-events', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_login_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">IP History</h4>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !events?.length ? (
        <p className="text-sm text-muted-foreground">No login events recorded yet.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {events.map((evt) => (
            <div key={evt.id} className="bg-muted rounded-md p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{String(evt.ip_address || 'Unknown')}</span>
                </div>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {evt.event_type === 'sign_up' ? 'Sign Up' : 'Sign In'}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Monitor className="h-3 w-3" />
                <span className="truncate max-w-[250px]">{evt.user_agent || 'Unknown'}</span>
              </div>
              <p className="text-muted-foreground">
                {format(new Date(evt.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
