import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Globe, Users, Mail, Phone, MapPin, FileText, Calendar, ShieldAlert, User, ShieldCheck, Clock, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { IdentityLevelBadge } from '@/components/app/IdentityLevelBadge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BusinessData {
  id: string;
  name: string;
  legal_name: string | null;
  jurisdiction: string;
  tax_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: any;
  default_currency: string | null;
  invoice_prefix: string | null;
  created_at: string;
  updated_at: string;
  business_identity_level: 'unverified' | 'self_declared' | 'verified' | 'nrs_linked' | 'regulator_linked' | null;
  verification_status?: string | null;
  verification_source?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  is_flagged?: boolean;
  flag_reason?: string | null;
  business_members?: { count: number }[];
  subscriptions?: { tier: string; status: string }[];
  owner?: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
}

interface BusinessDetailSheetProps {
  business: BusinessData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BusinessDetailSheet({ business, open, onOpenChange }: BusinessDetailSheetProps) {
  const [isFlagged, setIsFlagged] = useState(business?.is_flagged || false);
  const [flagReason, setFlagReason] = useState(business?.flag_reason || '');
  const [saving, setSaving] = useState(false);
  const [verificationAction, setVerificationAction] = useState<'verified' | 'rejected' | ''>('');
  const [verificationReason, setVerificationReason] = useState('');
  const [verificationSaving, setVerificationSaving] = useState(false);

  // Sync state when a different business is opened
  useEffect(() => {
    if (business) {
      setIsFlagged(business.is_flagged || false);
      setFlagReason(business.flag_reason || '');
    }
  }, [business?.id]);

  if (!business) return null;

  const memberCount = business.business_members?.[0]?.count || 0;
  const subscription = business.subscriptions?.[0];

  const handleSaveFlag = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ 
          is_flagged: isFlagged, 
          flag_reason: isFlagged ? flagReason || null : null 
        })
        .eq('id', business.id);
      if (error) throw error;
      toast.success(isFlagged ? 'Business flagged as fraudulent' : 'Fraud flag removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update flag');
      setIsFlagged(business.is_flagged || false);
      setFlagReason(business.flag_reason || '');
    } finally {
      setSaving(false);
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return 'Not provided';
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postal_code,
      address.country
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not provided';
  };

  const getSubscriptionBadge = () => {
    if (!subscription) {
      return <Badge variant="outline">No subscription</Badge>;
    }
    const tierVariant = subscription.tier === 'business' ? 'default' : 
                        subscription.tier === 'professional' ? 'secondary' : 'outline';
    return (
      <div className="flex items-center gap-2">
        <Badge variant={tierVariant} className="capitalize">{subscription.tier}</Badge>
        {subscription.status !== 'active' && (
          <Badge variant="destructive" className="text-xs">{subscription.status}</Badge>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Business Details</SheetTitle>
          <SheetDescription>
            View organization profile and configuration
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Business Header */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{business.name}</h3>
              {business.legal_name && business.legal_name !== business.name && (
                <p className="text-sm text-muted-foreground">{business.legal_name}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Owner */}
          {business.owner && (
            <>
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Owner</h4>
                <div className="flex items-center gap-3 bg-muted rounded-md p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={business.owner.avatar_url || undefined} />
                    <AvatarFallback>
                      {business.owner.full_name?.[0]?.toUpperCase() || business.owner.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{business.owner.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{business.owner.email}</p>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Status & Subscription */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Status</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Subscription</p>
                {getSubscriptionBadge()}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Verification</p>
                <IdentityLevelBadge 
                  level={(business.verification_status || business.business_identity_level || 'unverified') as any}
                  source={(business.verification_source) as any}
                  rejectionReason={business.rejection_reason}
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Members</p>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{memberCount}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Jurisdiction</p>
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{business.jurisdiction}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Currency</p>
                <span className="font-medium">{business.default_currency || 'Not set'}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Contact Information</h4>
            
            <div className="space-y-3">
              {business.contact_email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{business.contact_email}</span>
                </div>
              )}
              
              {business.contact_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{business.contact_phone}</span>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{formatAddress(business.address)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tax & Identity */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Identity & Tax</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Entity Type</span>
                <Badge variant="outline" className="capitalize">{(business as any).entity_type || 'business'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Gov ID Type</span>
                <span className="font-mono">{(business as any).government_id_type || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Gov ID Value</span>
                <span className="font-mono">{(business as any).government_id_value || 'Not provided'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tax ID (legacy)</span>
                <span className="font-mono">{business.tax_id || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Doc Verification</span>
                <Badge variant="outline" className="capitalize">{((business as any).document_verification_status || 'not_uploaded').replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invoice Prefix</span>
                <span className="font-mono">{business.invoice_prefix || 'INV'}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Timeline</h4>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {format(new Date(business.created_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Review */}
          <Separator />
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verification Review
            </h4>
             
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{business.verification_status || 'unverified'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">{business.verification_source || 'none'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subscription Tier</span>
                <span className="font-medium capitalize">{subscription?.tier || 'none'}</span>
              </div>
              {subscription && (subscription.tier === 'starter' || subscription.status !== 'active') && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-400">
                  ⚠ This business is on the free plan or has an inactive subscription. Verification approval will be blocked by the database.
                </div>
              )}
              {!subscription && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-400">
                  ⚠ No subscription found. Verification approval will be blocked by the database.
                </div>
              )}
              {business.verified_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Verified at</span>
                  <span className="font-medium">{format(new Date(business.verified_at), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Action</Label>
              <Select value={verificationAction} onValueChange={(v) => setVerificationAction(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">Approve (Verified)</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {verificationAction === 'rejected' && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Rejection reason (required)</Label>
                <Textarea
                  placeholder="Reason for rejecting verification..."
                  value={verificationReason}
                  onChange={(e) => setVerificationReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            {verificationAction && (
              <Button
                size="sm"
                variant={verificationAction === 'rejected' ? 'destructive' : 'default'}
                disabled={verificationSaving || (verificationAction === 'rejected' && !verificationReason.trim())}
                onClick={async () => {
                  setVerificationSaving(true);
                  try {
                    const { error } = await supabase.rpc('admin_set_verification', {
                      _business_id: business.id,
                      _status: verificationAction,
                      _source: verificationAction === 'verified' ? 'manual_review' : null,
                      _reason: verificationAction === 'rejected' ? verificationReason : null,
                    } as any);
                    if (error) throw error;
                    toast.success(verificationAction === 'verified' ? 'Business verified' : 'Business verification rejected');
                    setVerificationAction('');
                    setVerificationReason('');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to update verification');
                  } finally {
                    setVerificationSaving(false);
                  }
                }}
              >
                {verificationSaving ? 'Saving...' : verificationAction === 'verified' ? 'Approve Verification' : 'Reject Verification'}
              </Button>
            )}
          </div>

          {/* Fraud Controls */}
          <Separator />
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Fraud Controls
            </h4>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="fraud-flag" className="text-sm">Flag as Fraudulent</Label>
              <Switch
                id="fraud-flag"
                checked={isFlagged}
                onCheckedChange={setIsFlagged}
              />
            </div>

            {isFlagged && (
              <div className="space-y-2">
                <Label htmlFor="flag-reason" className="text-sm text-muted-foreground">Reason</Label>
                <Textarea
                  id="flag-reason"
                  placeholder="e.g. Suspected fraudulent invoicing activity"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            <Button 
              size="sm" 
              variant={isFlagged ? "destructive" : "outline"}
              onClick={handleSaveFlag}
              disabled={saving}
            >
              {saving ? 'Saving...' : isFlagged ? 'Save Fraud Flag' : 'Save Changes'}
            </Button>

            {business.is_flagged && (
              <p className="text-xs text-destructive">⚠ This business is currently flagged. Public invoices show a fraud warning.</p>
            )}
          </div>

          {/* Business ID */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">System Info</h4>
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs text-muted-foreground">Business ID</p>
              <p className="font-mono text-xs break-all">{business.id}</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
