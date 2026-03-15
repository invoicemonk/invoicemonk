import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  MoreHorizontal,
  Mail,
  Shield,
  UserCog,
  Eye,
  AlertCircle,
  Ban,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAdminUsers, useBanUser, useUnbanUser } from '@/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { UserDetailSheet } from '@/components/admin/UserDetailSheet';
import { ChangeRoleDialog } from '@/components/admin/ChangeRoleDialog';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users, isLoading } = useAdminUsers(searchQuery || undefined);
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();

  // Dialog/Sheet state
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const getRoleBadge = (roles: any[]) => {
    if (!roles || roles.length === 0) {
      return <Badge variant="outline">user</Badge>;
    }
    const role = roles[0]?.role || 'user';
    const variant = role === 'platform_admin' ? 'destructive' : 
                    role === 'business_admin' ? 'default' : 'outline';
    return <Badge variant={variant}>{role}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    if (status === 'suspended') {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    if (status === 'closed') {
      return <Badge variant="destructive">Closed</Badge>;
    }
    return null;
  };

  const isSuspended = (user: any) => 
    user.account_status === 'suspended' || user.account_status === 'closed';

  // Handlers
  const handleViewDetails = (user: any) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const handleViewAuditTrail = (user: any) => {
    navigate(`/admin/audit-logs?user_id=${user.id}`);
  };

  const handleChangeRole = (user: any) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleSuspendClick = (user: any) => {
    setSelectedUser(user);
    setBanReason('');
    setBanDialogOpen(true);
  };

  const handleConfirmBan = () => {
    if (!selectedUser) return;
    banUser.mutate(
      { userId: selectedUser.id, reason: banReason },
      { onSuccess: () => setBanDialogOpen(false) }
    );
  };

  const handleReactivate = (user: any) => {
    unbanUser.mutate({ userId: user.id });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">View and manage platform users</p>
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
              User data is read-only. Role changes and suspensions are logged to the audit trail.
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
              placeholder="Search users by name or email..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users
          </CardTitle>
          <CardDescription>
            {users?.length || 0} users found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No users found</p>
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user.id} className={isSuspended(user) ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name || 'Unnamed'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge((user as any).user_roles || [])}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.account_status) || (
                        user.email_verified ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Unverified
                          </Badge>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {user.created_at 
                        ? format(new Date(user.created_at), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewAuditTrail(user)}>
                            <Shield className="mr-2 h-4 w-4" />
                            View Audit Trail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleChangeRole(user)}>
                            <UserCog className="mr-2 h-4 w-4" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isSuspended(user) ? (
                            <DropdownMenuItem onClick={() => handleReactivate(user)}>
                              <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                              <span className="text-green-600">Reactivate User</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSuspendClick(user)}>
                              <Ban className="mr-2 h-4 w-4 text-destructive" />
                              <span className="text-destructive">Suspend User</span>
                            </DropdownMenuItem>
                          )}
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
      <UserDetailSheet 
        user={selectedUser} 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
      />
      <ChangeRoleDialog 
        user={selectedUser} 
        open={roleDialogOpen} 
        onOpenChange={setRoleDialogOpen} 
      />

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend User</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately block <strong>{selectedUser?.email}</strong> from accessing the platform. They will not be able to issue invoices or use any features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="ban-reason">Reason for suspension</Label>
            <Textarea
              id="ban-reason"
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
    </div>
  );
}
