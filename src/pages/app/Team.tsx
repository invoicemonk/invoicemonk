import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Shield, 
  MoreHorizontal,
  Trash2,
  UserCog,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UpgradeRequiredPage } from '@/components/app/UpgradeRequiredPage';

type BusinessRole = 'owner' | 'admin' | 'member' | 'auditor';

const roleDescriptions: Record<BusinessRole, string> = {
  owner: 'Full organization control, cannot be removed',
  admin: 'Can manage team, invoices, and settings',
  member: 'Can create and manage invoices',
  auditor: 'Read-only access for compliance review',
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    case 'auditor':
      return 'outline';
    default:
      return 'outline';
  }
};

export default function Team() {
  const { businessId } = useParams();
  const { user } = useAuth();
  const { currentBusiness, isOwner, isAdmin, checkTierLimit } = useBusiness();
  const queryClient = useQueryClient();
  const canManageTeam = isOwner || isAdmin;

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<BusinessRole>('member');

  // Check team access based on tier
  const { data: teamAccess, isLoading: teamAccessLoading } = useQuery({
    queryKey: ['team-access-check', currentBusiness?.id],
    queryFn: () => checkTierLimit('team_members_limit'),
    enabled: !!currentBusiness?.id,
  });

  // Fetch team members with profile info
  const { data: members, isLoading } = useQuery({
    queryKey: ['business-members', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      // Get business members
      const { data: membersData, error: membersError } = await supabase
        .from('business_members')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      if (!membersData?.length) return [];

      // Get profiles for all members
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine members with their profiles
      return membersData.map(member => ({
        ...member,
        profile: profiles?.find(p => p.id === member.user_id) || null,
      }));
    },
    enabled: !!businessId,
  });

  // Invite member mutation
  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: BusinessRole }) => {
      // First find the user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('No user found with that email address');

      // Check if already a member
      const { data: existing } = await supabase
        .from('business_members')
        .select('id')
        .eq('business_id', businessId!)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) throw new Error('User is already a member of this organization');

      // Add as member
      const { error: insertError } = await supabase
        .from('business_members')
        .insert({
          business_id: businessId!,
          user_id: profile.id,
          role,
          invited_by: user?.id,
          invited_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(), // Auto-accept for now
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Team member added successfully');
      queryClient.invalidateQueries({ queryKey: ['business-members', businessId] });
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: BusinessRole }) => {
      const { error } = await supabase
        .from('business_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['business-members', businessId] });
    },
    onError: () => {
      toast.error('Failed to update role');
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('business_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team member removed');
      queryClient.invalidateQueries({ queryKey: ['business-members', businessId] });
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  // Show loading while checking access
  if (teamAccessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If team_members_limit = 0, show upgrade prompt
  if (teamAccess && teamAccess.limit_value === 0) {
    return (
      <UpgradeRequiredPage
        feature="Team Management"
        description="Team collaboration is available on Professional and Business plans. Upgrade to invite team members, assign roles, and work together."
        upgradeUrl={`/b/${businessId}/billing`}
        requiredTier="Professional"
        benefits={[
          'Invite up to 5 team members (Professional)',
          'Assign roles: Admin, Member, Auditor',
          'Collaborative invoice management',
          'Unlimited team members on Business plan',
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>
        {canManageTeam && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Invite a new member to {currentBusiness?.name}. They must have an existing Invoicemonk account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as BusinessRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="auditor">Auditor</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {roleDescriptions[inviteRole]}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => inviteMember.mutate({ email: inviteEmail, role: inviteRole })} 
                  disabled={!inviteEmail || inviteMember.isPending}
                >
                  {inviteMember.isPending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Role Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(roleDescriptions) as [BusinessRole, string][]).map(([role, desc]) => (
              <div key={role} className="flex items-start gap-2">
                <Badge variant={getRoleBadgeVariant(role)} className="capitalize mt-0.5">
                  {role}
                </Badge>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            {members?.length || 0} member{(members?.length || 0) !== 1 ? 's' : ''} in this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : members?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No team members yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members?.map((member) => {
                const profile = member.profile as { id: string; email: string; full_name: string | null; avatar_url: string | null } | null;
                const isCurrentUser = profile?.id === user?.id;
                const isOwnerMember = member.role === 'owner';
                const canModify = canManageTeam && !isOwnerMember && !isCurrentUser;
                
                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(profile?.full_name || null, profile?.email || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {profile?.full_name || profile?.email}
                        </p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile?.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {member.accepted_at ? (
                        <div className="hidden sm:flex items-center text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-primary" />
                          Joined {format(new Date(member.accepted_at), 'MMM d, yyyy')}
                        </div>
                      ) : member.invited_at ? (
                        <div className="hidden sm:flex items-center text-xs text-warning">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </div>
                      ) : null}
                      
                      <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                        {member.role}
                      </Badge>
                      
                      {canModify && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateRole.mutate({ memberId: member.id, newRole: 'admin' })}>
                              <UserCog className="mr-2 h-4 w-4" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateRole.mutate({ memberId: member.id, newRole: 'member' })}>
                              <Users className="mr-2 h-4 w-4" />
                              Make Member
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateRole.mutate({ memberId: member.id, newRole: 'auditor' })}>
                              <Shield className="mr-2 h-4 w-4" />
                              Make Auditor
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove Member
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {profile?.full_name || profile?.email} from this organization? 
                                    This action will be logged in the audit trail.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeMember.mutate(member.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-muted bg-muted/30 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Audit Trail Active</p>
            <p className="text-sm text-muted-foreground">
              All team changes including role modifications and member removals are permanently recorded 
              in the audit log for compliance purposes.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
