import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Mail, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BusinessData {
  id: string;
  name: string;
}

interface MembersDialogProps {
  business: BusinessData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MembersDialog({ business, open, onOpenChange }: MembersDialogProps) {
  const { data: members, isLoading } = useQuery({
    queryKey: ['admin-business-members', business?.id],
    queryFn: async () => {
      if (!business?.id) return [];

      const { data: memberData, error } = await supabase
        .from('business_members')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!memberData || memberData.length === 0) return [];

      // Fetch profiles for all members
      const userIds = memberData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Merge profiles with member data
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return memberData.map(member => ({
        ...member,
        profile: profilesMap.get(member.user_id) || null,
      }));
    },
    enabled: open && !!business?.id,
  });

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    const variant = role === 'owner' ? 'destructive' : 
                    role === 'admin' ? 'default' : 'outline';
    return <Badge variant={variant} className="capitalize">{role}</Badge>;
  };

  if (!business) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </DialogTitle>
          <DialogDescription>
            Members of {business.name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))
          ) : members?.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No members found</p>
            </div>
          ) : (
            members?.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {getInitials(member.profile?.full_name || null, member.profile?.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {member.profile?.full_name || 'Unnamed'}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{member.profile?.email || 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getRoleBadge(member.role)}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(member.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
