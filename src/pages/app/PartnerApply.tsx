import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useMyPartnerApplication, useSubmitPartnerApplication } from '@/hooks/use-partner-applications';
import { usePartnerRole } from '@/hooks/use-partner-role';
import { toast } from '@/hooks/use-toast';
import { Handshake, CheckCircle, Clock, XCircle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const PartnerApply = () => {
  const { profile } = useAuth();
  const { isPartner } = usePartnerRole();
  const { data: application, isLoading } = useMyPartnerApplication();
  const submitApplication = useSubmitPartnerApplication();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [motivation, setMotivation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    try {
      await submitApplication.mutateAsync({ name: name.trim(), email: email.trim(), motivation: motivation.trim() || undefined });
      toast({ title: 'Application submitted!', description: 'We will review it and get back to you soon.' });
    } catch (err: any) {
      const msg = err.message?.includes('idx_partner_applications_pending_user')
        ? 'You already have a pending application.'
        : err.message;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already a partner
  if (isPartner) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">You're already a partner!</h2>
            <p className="text-muted-foreground">Head to your partner dashboard to manage links, view referrals, and track commissions.</p>
            <Button asChild>
              <Link to="/partner">
                Go to Partner Portal <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Has an existing application
  if (application) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            {application.status === 'pending' && (
              <>
                <Clock className="h-12 w-12 text-amber-500 mx-auto" />
                <h2 className="text-xl font-semibold">Application Under Review</h2>
                <p className="text-muted-foreground">Your partner application is being reviewed. We'll notify you once a decision is made.</p>
                <Badge variant="secondary">Pending</Badge>
              </>
            )}
            {application.status === 'approved' && (
              <>
                <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-xl font-semibold">Application Approved!</h2>
                <p className="text-muted-foreground">Your application has been approved. You can now access the partner portal.</p>
                <Button asChild>
                  <Link to="/partner">
                    Go to Partner Portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
            {application.status === 'rejected' && (
              <>
                <XCircle className="h-12 w-12 text-destructive mx-auto" />
                <h2 className="text-xl font-semibold">Application Not Approved</h2>
                <p className="text-muted-foreground">
                  {application.rejection_reason || 'Unfortunately, your application was not approved at this time.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Application form
  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Handshake className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Become a Partner</CardTitle>
          <CardDescription>
            Earn 20% recurring commissions on every paying customer you refer to Invoicemonk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivation">Why do you want to become a partner? (optional)</Label>
              <Textarea
                id="motivation"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Tell us about your audience, website, or how you plan to promote Invoicemonk..."
                rows={4}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitApplication.isPending}>
              {submitApplication.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Application
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerApply;
