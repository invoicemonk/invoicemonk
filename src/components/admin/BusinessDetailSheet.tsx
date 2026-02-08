import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Globe, Users, Mail, Phone, MapPin, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { IdentityLevelBadge } from '@/components/app/IdentityLevelBadge';

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
  business_members?: { count: number }[];
  subscriptions?: { tier: string; status: string }[];
}

interface BusinessDetailSheetProps {
  business: BusinessData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BusinessDetailSheet({ business, open, onOpenChange }: BusinessDetailSheetProps) {
  if (!business) return null;

  const memberCount = business.business_members?.[0]?.count || 0;
  const subscription = business.subscriptions?.[0];

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

          {/* Status & Subscription */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Status</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Subscription</p>
                {getSubscriptionBadge()}
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Identity Level</p>
                <IdentityLevelBadge level={business.business_identity_level} />
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
                <span className="font-medium">{business.default_currency || 'NGN'}</span>
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

          {/* Tax & Invoicing */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Tax & Invoicing</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tax ID</span>
                <span className="font-mono">{business.tax_id || 'Not provided'}</span>
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
