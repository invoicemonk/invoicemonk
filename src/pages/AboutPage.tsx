import { Shield, Target, Users, Heart, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const APP_URL = "https://app.invoicemonk.com";

const values = [
  {
    icon: Shield,
    title: "Compliance First",
    description: "Every feature we build starts with the question: 'Does this help our users stay compliant?' If it doesn't, we rethink it.",
  },
  {
    icon: Target,
    title: "Simplicity",
    description: "Complex compliance made simple. We believe powerful tools don't have to be complicated to use.",
  },
  {
    icon: Users,
    title: "Trust",
    description: "Your financial data is sacred. We build with security, privacy, and transparency at our core.",
  },
  {
    icon: Heart,
    title: "User-Centric",
    description: "We listen to our users obsessively. Every improvement comes from real feedback and real needs.",
  },
];

const AboutPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
              Making invoicing{" "}
              <span className="text-gradient">audit-ready</span> for everyone
            </h1>
            <p className="text-lg text-muted-foreground">
              We started Invoicemonk because we believed every business—regardless of size—deserves 
              access to professional, compliant invoicing tools.
            </p>
          </motion.div>
        </section>

        {/* Mission Section */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-card rounded-2xl border border-border p-8 md:p-12 card-shadow">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <span className="text-sm font-medium text-primary uppercase tracking-wider">Our Mission</span>
                  <h2 className="font-display text-3xl font-bold text-foreground mt-2 mb-4">
                    Democratizing compliance
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    For too long, proper audit trails and compliance features have been locked behind 
                    expensive enterprise software. We're changing that.
                  </p>
                  <p className="text-muted-foreground">
                    Invoicemonk gives freelancers, small businesses, and growing companies the same 
                    compliance tools that Fortune 500 companies use—without the Fortune 500 price tag.
                  </p>
                </div>
                <div className="bg-accent/50 rounded-xl p-8 border border-primary/10">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-primary mb-2">100%</div>
                    <p className="text-foreground font-medium">Audit-Ready Invoices</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Every invoice created on Invoicemonk is automatically compliant and verifiable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Values Section */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-muted-foreground">
              The principles that guide everything we build.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-card rounded-xl border border-border p-6 text-center card-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Compliance Matters */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-foreground text-background rounded-2xl p-8 md:p-12">
              <div className="max-w-2xl">
                <h2 className="font-display text-3xl font-bold mb-6">
                  Why we focus on compliance
                </h2>
                <div className="space-y-4 text-background/80">
                  <p>
                    In an increasingly regulated world, proper documentation isn't optional—it's essential. 
                    Tax authorities are getting smarter, audits are becoming more thorough, and the cost of 
                    non-compliance keeps rising.
                  </p>
                  <p>
                    We've seen too many businesses struggle during audits because their invoicing records 
                    were incomplete, inconsistent, or impossible to verify. That's a problem we can solve.
                  </p>
                  <p>
                    With Invoicemonk, every invoice you send is automatically timestamped, logged, and 
                    verifiable. When the auditor comes knocking, you're ready.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join the growing community of businesses that trust Invoicemonk for compliant, professional invoicing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="xl" asChild>
                <a href={`${APP_URL}/signup`}>
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
              <Button variant="heroOutline" size="xl" asChild>
                <a href="/compliance">Learn About Compliance</a>
              </Button>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
