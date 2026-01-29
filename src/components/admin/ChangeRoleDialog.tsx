import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Shield } from 'lucide-react';
import { useUpdateUserRole } from '@/hooks/use-admin';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  user_roles?: { role: string }[];
}

interface ChangeRoleDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'user', label: 'User', description: 'Standard user with no special privileges' },
  { value: 'business_admin', label: 'Business Admin', description: 'Can manage their own business' },
  { value: 'team_member', label: 'Team Member', description: 'Member of a business team' },
  { value: 'auditor', label: 'Auditor', description: 'Read-only access to audit trails' },
  { value: 'platform_admin', label: 'Platform Admin', description: 'Full platform administration access' },
];

export function ChangeRoleDialog({ user, open, onOpenChange }: ChangeRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [reason, setReason] = useState('');
  const updateRole = useUpdateUserRole();

  const currentRole = user?.user_roles?.[0]?.role || 'user';

  const handleSubmit = async () => {
    if (!user || !selectedRole || !reason.trim()) return;

    await updateRole.mutateAsync({
      userId: user.id,
      role: selectedRole,
      reason: reason.trim(),
    });

    setSelectedRole('');
    setReason('');
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedRole('');
      setReason('');
    }
    onOpenChange(newOpen);
  };

  if (!user) return null;

  const isValid = selectedRole && selectedRole !== currentRole && reason.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Change User Role
          </DialogTitle>
          <DialogDescription>
            Change the role for {user.full_name || user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Role changes are logged to the audit trail. A detailed reason is required.
              </p>
            </div>
          </div>

          {/* Current Role */}
          <div className="space-y-2">
            <Label>Current Role</Label>
            <div className="p-2 bg-muted rounded-md">
              <span className="font-medium capitalize">{currentRole}</span>
            </div>
          </div>

          {/* New Role */}
          <div className="space-y-2">
            <Label htmlFor="role">New Role</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ROLES.map((role) => (
                  <SelectItem 
                    key={role.value} 
                    value={role.value}
                    disabled={role.value === currentRole}
                  >
                    <div className="flex flex-col">
                      <span>{role.label}</span>
                      <span className="text-xs text-muted-foreground">{role.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this role change is necessary (minimum 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 characters minimum
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || updateRole.isPending}
          >
            {updateRole.isPending ? 'Updating...' : 'Change Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
