import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, FileCheck } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/50 rounded-full blur-3xl" />
      </div>

      <div className="container">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-primary/10 mb-8">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Compliance-First Invoicing</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            Invoices that are{" "}
            <span className="text-gradient">verifiable, immutable,</span> and audit-ready
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Create professional invoices with built-in audit trails, timestamped logs, and government-friendly compliance. Every record is permanent and verifiable.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="hero" size="xl" asChild>
              <a href="https://app.invoicemonk.com/signup">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <a href="#features">
                See How It Works
              </a>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-8 mt-12 pt-8 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Immutable Records</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-primary" />
              <span>Audit-Ready</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Timestamped Logs</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
