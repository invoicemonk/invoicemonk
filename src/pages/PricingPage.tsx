import { Check, ArrowRight, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const APP_URL = "https://app.invoicemonk.com";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for freelancers getting started with professional invoicing.",
    features: [
      "10 invoices per month",
      "Basic invoice templates",
      "Email delivery",
      "Client management (up to 5)",
      "PDF export",
      "Basic support",
    ],
    cta: "Start Free",
    popular: false,
    compliance: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description: "Full compliance baseline with audit trails and immutable records.",
    features: [
      "Unlimited invoices",
      "Premium templates & branding",
      "Full audit trail logging",
      "Immutable invoice records",
      "Timestamped verification",
      "Verification portal access",
      "Unlimited clients",
      "Advanced reporting",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
    compliance: true,
  },
  {
    name: "Business",
    price: "$99",
    period: "/month",
    description: "For teams and businesses requiring advanced collaboration and API access.",
    features: [
      "Everything in Professional",
      "Multi-user accounts (up to 10)",
      "Team roles & permissions",
      "Organization dashboard",
      "API access",
      "Custom integrations",
      "Bulk invoice operations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
    compliance: true,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const PricingPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-32 pb-20">
        <section className="container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-primary/10 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Simple, Transparent Pricing</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
              Choose the plan that fits your{" "}
              <span className="text-gradient">compliance needs</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Start free, upgrade when you need full audit compliance. All plans include our core invoicing features.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {tiers.map((tier) => (
              <motion.div
                key={tier.name}
                variants={item}
                className={`relative rounded-2xl p-8 ${
                  tier.popular
                    ? "bg-foreground text-background border-2 border-foreground shadow-2xl scale-105"
                    : "bg-card border border-border card-shadow"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                {tier.compliance && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 ${
                    tier.popular ? "bg-primary/20 text-primary-foreground" : "bg-accent text-primary"
                  }`}>
                    <Shield className="w-3 h-3" />
                    Full Compliance
                  </div>
                )}

                <h3 className={`text-2xl font-bold mb-2 ${tier.popular ? "" : "text-foreground"}`}>
                  {tier.name}
                </h3>
                <p className={`text-sm mb-6 ${tier.popular ? "text-background/70" : "text-muted-foreground"}`}>
                  {tier.description}
                </p>

                <div className="mb-6">
                  <span className={`text-4xl font-bold ${tier.popular ? "" : "text-foreground"}`}>
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className={tier.popular ? "text-background/70" : "text-muted-foreground"}>
                      {tier.period}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        tier.popular ? "text-primary" : "text-primary"
                      }`} />
                      <span className={`text-sm ${tier.popular ? "text-background/90" : "text-muted-foreground"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    tier.popular
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : ""
                  }`}
                  variant={tier.popular ? "default" : "outline"}
                  size="lg"
                  asChild
                >
                  <a href={`${APP_URL}/signup?plan=${tier.name.toLowerCase()}`}>
                    {tier.cta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </motion.div>
            ))}
          </motion.div>

          {/* Comparison Note */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-accent/50 border border-primary/10">
              <Shield className="w-5 h-5 text-primary" />
              <p className="text-sm text-foreground">
                <strong>Compliance Baseline:</strong> Professional tier and above includes full audit trails, 
                immutable records, and government-friendly verification.
              </p>
            </div>
          </motion.div>

          {/* FAQ CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 text-center"
          >
            <p className="text-muted-foreground mb-4">
              Have questions about which plan is right for you?
            </p>
            <Button variant="ghost" asChild>
              <a href="/#faq">
                View FAQ
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;
