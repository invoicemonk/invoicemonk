import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Check,
  Zap,
  Building2,
  Shield,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    description: 'For individuals getting started',
    features: [
      '5 invoices per month',
      'Basic compliance features',
      'Email support',
      'Single user',
    ],
    current: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 4999,
    description: 'For growing businesses',
    features: [
      'Unlimited invoices',
      'Full compliance suite',
      'Priority support',
      'Up to 5 team members',
      'Custom branding',
      'Audit exports',
    ],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 14999,
    description: 'For enterprises with advanced needs',
    features: [
      'Everything in Professional',
      'Unlimited team members',
      'API access',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
];

export default function Billing() {
  const currentPlan = plans.find(p => p.current);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{currentPlan?.name}</h3>
                <Badge>Current</Badge>
              </div>
              <p className="text-muted-foreground">{currentPlan?.description}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {formatCurrency(currentPlan?.price || 0)}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.recommended ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Recommended
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {plan.id === 'starter' && <Zap className="h-5 w-5" />}
                  {plan.id === 'professional' && <Shield className="h-5 w-5" />}
                  {plan.id === 'business' && <Building2 className="h-5 w-5" />}
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">{formatCurrency(plan.price)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                
                <Separator />
                
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full" 
                  variant={plan.current ? 'secondary' : plan.recommended ? 'default' : 'outline'}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : 'Upgrade'}
                  {!plan.current && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your recent billing transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No payment history</h3>
            <p className="text-sm text-muted-foreground">
              You're currently on the free plan. Upgrade to see billing history.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
