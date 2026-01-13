import { Shield, FileCheck, Clock, Eye, Lock, CheckCircle, ArrowRight, Database } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const APP_URL = "https://app.invoicemonk.com";

const complianceFeatures = [
  {
    icon: FileCheck,
    title: "Verifiable Invoices",
    description: "Every invoice generated through Invoicemonk receives a unique verification ID. Recipients and auditors can verify authenticity through our public verification portal.",
    details: [
      "Unique cryptographic verification IDs",
      "Public verification portal access",
      "QR code for instant verification",
      "Tamper-evident document signatures",
    ],
  },
  {
    icon: Clock,
    title: "Timestamped Records",
    description: "All invoice activities are logged with precise timestamps. From creation to every view, download, and modification—everything is recorded permanently.",
    details: [
      "Creation timestamp with timezone",
      "View and access logging",
      "Download and export tracking",
      "Modification history with diffs",
    ],
  },
  {
    icon: Database,
    title: "Immutable Audit Trail",
    description: "Once created, invoice records cannot be altered or deleted. Our immutable logging system ensures complete data integrity for regulatory compliance.",
    details: [
      "Append-only audit logs",
      "No retroactive modifications",
      "Complete action history",
      "User attribution for all actions",
    ],
  },
  {
    icon: Eye,
    title: "Audit Access",
    description: "Grant auditors read-only access to your invoice records and audit trails. Perfect for tax audits, regulatory reviews, and financial due diligence.",
    details: [
      "Dedicated auditor role",
      "Read-only access controls",
      "Filtered view by date range",
      "Export-ready audit reports",
    ],
  },
];

const regulatoryPoints = [
  {
    title: "Tax Authority Compliance",
    description: "Our records meet the documentation requirements for tax authorities worldwide. Immutable timestamps and verification IDs satisfy audit trail requirements.",
  },
  {
    title: "Financial Reporting",
    description: "Generate audit-ready reports with complete transaction histories. Perfect for year-end reporting, due diligence, and investor relations.",
  },
  {
    title: "Legal Evidence",
    description: "Invoicemonk records can serve as legal evidence. Our timestamped, immutable logs provide irrefutable proof of invoice creation and delivery.",
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

const CompliancePage = () => {
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
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-primary/10 mb-6">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Compliance-First Design</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
              Built for{" "}
              <span className="text-gradient">audits, regulations,</span> and peace of mind
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Every feature in Invoicemonk is designed with compliance in mind. From immutable records to 
              government-friendly audit trails, we make regulatory compliance effortless.
            </p>
            <Button variant="hero" size="xl" asChild>
              <a href={`${APP_URL}/signup`}>
                Start Compliant Invoicing
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </motion.div>
        </section>

        {/* Verification Demo */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            <div className="bg-card rounded-2xl border border-border p-8 md:p-12 card-shadow">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                    How Verification Works
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Every invoice includes a verification ID that anyone can use to confirm authenticity. 
                    No account required—just visit our verification portal.
                  </p>
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                        1
                      </span>
                      <span className="text-foreground">Locate the verification ID on any Invoicemonk invoice</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                        2
                      </span>
                      <span className="text-foreground">Visit verify.invoicemonk.com or scan the QR code</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                        3
                      </span>
                      <span className="text-foreground">View the full audit trail and confirm authenticity</span>
                    </li>
                  </ol>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-48 h-48 bg-accent/50 rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center">
                    <div className="text-center">
                      <CheckCircle className="w-12 h-12 text-primary mx-auto mb-2" />
                      <span className="text-sm font-medium text-primary">Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Core Compliance Features */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Core Compliance Features
            </h2>
            <p className="text-muted-foreground">
              Every tool and feature designed to keep you audit-ready at all times.
            </p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto"
          >
            {complianceFeatures.map((feature) => (
              <motion.div
                key={feature.title}
                variants={item}
                className="bg-card rounded-2xl border border-border p-8 card-shadow hover:card-shadow-hover transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Regulatory Compliance */}
        <section className="container mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Government-Friendly Compliance
              </h2>
              <p className="text-muted-foreground">
                Documentation that satisfies regulatory requirements worldwide.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {regulatoryPoints.map((point, index) => (
                <motion.div
                  key={point.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-accent/30 rounded-xl p-6 border border-primary/10"
                >
                  <Lock className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">
                    {point.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {point.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center bg-foreground text-background rounded-2xl p-12"
          >
            <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to be audit-ready?
            </h2>
            <p className="text-background/70 mb-8 max-w-xl mx-auto">
              Join thousands of businesses that trust Invoicemonk for their compliance-first invoicing needs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="xl" asChild>
                <a href={`${APP_URL}/signup`}>
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
              <Button 
                variant="outline" 
                size="xl" 
                className="border-background/30 text-background hover:bg-background/10"
                asChild
              >
                <a href="/pricing">View Pricing</a>
              </Button>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CompliancePage;
