import { Shield, FileText, Clock, Lock, BarChart3, Users } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Compliance Built-In",
    description: "Every invoice meets regulatory standards with automatic compliance checks and government-friendly formatting.",
  },
  {
    icon: Lock,
    title: "Immutable Records",
    description: "Once issued, invoices cannot be modified. Every version is preserved with cryptographic verification.",
  },
  {
    icon: Clock,
    title: "Complete Audit Trail",
    description: "Timestamped logs for every action. Know exactly who did what and when — exportable for any audit.",
  },
  {
    icon: FileText,
    title: "Professional Invoices",
    description: "Beautiful, customizable invoice templates that reflect your brand while maintaining compliance standards.",
  },
  {
    icon: BarChart3,
    title: "Insightful Reports",
    description: "Revenue summaries, tax reports, and compliance status dashboards at your fingertips.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Role-based access for your team. Admins, members, and auditors with appropriate permissions.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-20 md:py-32 bg-secondary/30">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need for compliant invoicing
          </h2>
          <p className="text-lg text-muted-foreground">
            Built from the ground up with audit-readiness and regulatory compliance in mind.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl bg-card border border-border/50 card-shadow hover:card-shadow-hover transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
