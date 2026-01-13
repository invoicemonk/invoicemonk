import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "How does Invoicemonk ensure invoice immutability?",
    answer: "Once an invoice is issued, it's cryptographically sealed and timestamped. Any changes require creating a new version, while the original remains permanently preserved. This creates a complete audit trail that meets regulatory requirements.",
  },
  {
    question: "What compliance standards does Invoicemonk support?",
    answer: "Invoicemonk is designed to meet global invoicing compliance requirements including audit trail maintenance, data immutability, and timestamped record-keeping. We support jurisdiction-specific tax schemas and can adapt to local regulatory requirements.",
  },
  {
    question: "Can auditors access my invoice records?",
    answer: "Yes! You can grant read-only auditor access to specific users. Auditors can view invoices, audit trails, and reports without being able to modify any data. Perfect for external accountants, tax authorities, or internal compliance reviews.",
  },
  {
    question: "How are timestamps verified?",
    answer: "Every action in Invoicemonk is logged with a precise server-side timestamp. These timestamps are immutable and can be independently verified, providing a clear chain of evidence for when each invoice was created, viewed, or exported.",
  },
  {
    question: "What happens if I need to correct an invoice?",
    answer: "Issued invoices cannot be edited — this is a core compliance feature. Instead, you can create credit notes, corrections, or new versions. All documents are linked and the full history is preserved for audit purposes.",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use industry-standard encryption for data at rest and in transit. Your invoices are stored redundantly across multiple secure data centers, and access is strictly controlled through role-based permissions.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-20 md:py-32 bg-secondary/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about compliance-first invoicing.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border/50 rounded-xl px-6 card-shadow"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
