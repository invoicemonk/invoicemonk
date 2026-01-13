import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    description: "For individuals getting started",
    features: [
      "Up to 10 invoices/month",
      "Basic invoice templates",
      "Client management",
      "Email support",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description: "Full compliance features for growing businesses",
    features: [
      "Unlimited invoices",
      "Complete audit trails",
      "Immutable records",
      "Tax summaries & reports",
      "Custom branding",
      "Priority support",
    ],
    cta: "Start Trial",
    popular: true,
  },
  {
    name: "Business",
    price: "$99",
    period: "/month",
    description: "For teams and organizations",
    features: [
      "Everything in Professional",
      "Multi-user access",
      "Role-based permissions",
      "Organization dashboard",
      "API access",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-20 md:py-32">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free, upgrade when you need full compliance features.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                tier.popular
                  ? "bg-card border-primary/30 card-shadow-hover scale-105"
                  : "bg-card border-border/50 card-shadow hover:card-shadow-hover"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  {tier.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {tier.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-muted-foreground">{tier.period}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.popular ? "hero" : "outline"}
                size="lg"
                className="w-full"
                asChild
              >
                <a href="https://app.invoicemonk.com/signup">{tier.cta}</a>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
