import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Mail, Calendar, Shield, Building2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  account_status: string | null;
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
  if (!user) return null;

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
          <SheetDescription>
            View user profile and account information
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
                <Badge variant={user.account_status === 'closed' ? 'destructive' : 'outline'}>
                  {user.account_status || 'active'}
                </Badge>
              </div>
            </div>
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

          {/* User ID (for admin reference) */}
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
  );
}
