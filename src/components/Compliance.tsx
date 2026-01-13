import { Shield, Clock, FileCheck, Eye } from "lucide-react";
import { motion } from "framer-motion";

const compliancePoints = [
  {
    icon: FileCheck,
    title: "Verifiable Invoices",
    description: "Each invoice has a unique verification ID. Anyone can confirm authenticity through our verification portal.",
  },
  {
    icon: Clock,
    title: "Timestamped Records",
    description: "Every action is logged with precise timestamps. Creation, views, exports — all recorded immutably.",
  },
  {
    icon: Shield,
    title: "Data Integrity",
    description: "Once an invoice is issued, it cannot be modified. Amendments create new versions while preserving history.",
  },
  {
    icon: Eye,
    title: "Audit Access",
    description: "Grant read-only auditor access. Perfect for accountants, regulators, or internal compliance reviews.",
  },
];

const Compliance = () => {
  return (
    <section id="compliance" className="py-20 md:py-32 bg-foreground text-background">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
              Built for audits. Ready for regulators.
            </h2>
            <p className="text-lg text-background/70 mb-8">
              Invoicemonk was designed compliance-first. Every invoice you create is automatically equipped with the verification and audit capabilities that regulators expect.
            </p>
            
            <div className="space-y-6">
              {compliancePoints.map((point, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-background/10 flex items-center justify-center shrink-0">
                    <point.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{point.title}</h3>
                    <p className="text-sm text-background/60">{point.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-background/5 rounded-2xl p-8 border border-background/10">
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-between p-4 bg-background/5 rounded-lg"
                >
                  <span className="text-sm font-medium">Invoice Verification</span>
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Verified</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-between p-4 bg-background/5 rounded-lg"
                >
                  <span className="text-sm font-medium">Audit Trail</span>
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Complete</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-between p-4 bg-background/5 rounded-lg"
                >
                  <span className="text-sm font-medium">Record Integrity</span>
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">Immutable</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center justify-between p-4 bg-background/5 rounded-lg"
                >
                  <span className="text-sm font-medium">Timestamp Verified</span>
                  <span className="text-xs text-background/60">Jan 13, 2026 • 12:45 PM</span>
                </motion.div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Compliance;
