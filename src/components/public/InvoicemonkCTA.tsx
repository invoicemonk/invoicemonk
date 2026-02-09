import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InvoicemonkCTAProps {
  variant?: "default" | "compact";
}

const InvoicemonkCTA = ({ variant = "default" }: InvoicemonkCTAProps) => {
  const features = [
    "Compliance-ready invoices",
    "Instant verification",
    "Professional templates",
    "Payment tracking",
  ];

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/20 border-primary/20">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Ready to streamline your invoicing?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Join thousands of businesses using Invoicemonk
                  </p>
                </div>
              </div>
              <Button asChild className="shrink-0">
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/20 border-primary/20">
        <CardContent className="py-8 px-6 md:px-8">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            {/* Icon and Title */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex rounded-full bg-primary/10 p-3 mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-foreground">
                Ready to streamline your invoicing?
              </h3>
              <p className="text-muted-foreground mb-4">
                Join thousands of businesses using Invoicemonk for professional,
                compliance-ready invoicing.
              </p>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/signup">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="https://invoicemonk.com">Learn More</a>
                </Button>
              </div>
            </div>

            {/* Stats/Social Proof */}
            <div className="hidden lg:flex flex-col gap-4 p-6 bg-card rounded-xl border border-border/50 min-w-[200px]">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">10,000+</p>
                <p className="text-sm text-muted-foreground">
                  Invoices processed
                </p>
              </div>
              <div className="border-t border-border pt-4 text-center">
                <p className="text-3xl font-bold text-primary">500+</p>
                <p className="text-sm text-muted-foreground">
                  Businesses trust us
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default InvoicemonkCTA;
