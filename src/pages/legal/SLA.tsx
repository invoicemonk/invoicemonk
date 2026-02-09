import { Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SLA() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href="https://invoicemonk.com" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Invoicemonk</span>
          </a>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Document
          </Button>
        </div>
      </header>

      {/* Document Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          {/* Document Header */}
          <header className="mb-12 pb-8 border-b border-border">
            <h1 className="text-3xl font-display font-bold text-foreground mb-4 print:text-2xl">
              Service Level Agreement (SLA)
            </h1>
            <p className="text-xl text-muted-foreground mb-6">
              E-Invoicing and Compliance Services
            </p>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Effective Date:</span>{" "}
                January 30, 2026
              </div>
              <div>
                <span className="font-medium text-foreground">Version:</span>{" "}
                1.0
              </div>
              <div>
                <span className="font-medium text-foreground">Document ID:</span>{" "}
                IM-SLA-2026-001
              </div>
            </div>
          </header>

          {/* Section 1: Introduction */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              1. Introduction
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              This Service Level Agreement ("SLA") defines the service commitments, 
              operational standards, and technical guarantees provided by Invoicemonk 
              ("the Platform") for electronic invoicing and compliance record management services.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This document is intended for review by regulatory bodies, auditors, 
              and customers requiring documented service commitments for compliance purposes.
            </p>
          </section>

          {/* Section 2: Service Scope */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              2. Service Scope
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              2.1 Services Covered
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following services are covered under this SLA:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Invoice creation, issuance, and lifecycle management</li>
              <li>Public invoice verification portal</li>
              <li>Audit logging and event tracking</li>
              <li>Data retention and compliance record management</li>
              <li>Secure data exports (subject to service tier)</li>
              <li>Credit note generation for voided invoices</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              2.2 Services Not Covered
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following services are explicitly outside the scope of this SLA:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>
                <strong>Payment Processing:</strong> Invoicemonk records payment events but 
                does not process, hold, or transfer funds. All payment processing must be 
                conducted through external payment providers.
              </li>
              <li>
                <strong>Tax Calculation:</strong> Tax rate determination and calculation 
                are the responsibility of the customer. The Platform provides fields for 
                tax recording but does not perform automated tax computation.
              </li>
              <li>
                <strong>Government e-Invoice Submission:</strong> Direct submission to 
                government e-invoicing systems (such as IRN, NRS, or similar frameworks) 
                is not currently provided. The Platform is designed to support future 
                integration with such systems.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              2.3 Platform Classification
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Invoicemonk operates as financial records infrastructure, providing 
              audit-ready invoice management and compliance record-keeping capabilities. 
              The Platform is not a payment processor, tax authority, or government-accredited 
              e-invoicing solution.
            </p>
          </section>

          {/* Section 3: Service Availability */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              3. Service Availability
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              3.1 Availability Target
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Platform targets a monthly availability of <strong>99.5%</strong> for 
              core invoice operations, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Invoice creation and issuance</li>
              <li>Invoice verification via the public portal</li>
              <li>Audit log access and retrieval</li>
              <li>Data export functionality</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              3.2 Measurement Methodology
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Availability is calculated as the percentage of time core services are 
              operational during a calendar month, excluding scheduled maintenance windows.
            </p>

            <h3 className="text-lg font-medium text-foreground mb-3">
              3.3 Scheduled Maintenance
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Scheduled maintenance is excluded from availability calculations and will be 
              conducted during the following windows where possible:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Preferred window: Weekdays, 00:00 - 06:00 UTC</li>
              <li>Notice period: Minimum 48 hours advance notification</li>
              <li>Emergency maintenance: Conducted as required with best-effort notification</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              3.4 Service Credits
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              This SLA does not include financial service credits for availability breaches. 
              Customers requiring contractual service credits should contact the Platform 
              for enterprise service agreements.
            </p>
          </section>

          {/* Section 4: Data Integrity Guarantees */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              4. Data Integrity Guarantees
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              4.1 Invoice Immutability
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Once an invoice is issued, the following controls are enforced:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>
                <strong>Modification Prevention:</strong> Database triggers prevent 
                modification of issued invoices at the database level.
              </li>
              <li>
                <strong>Deletion Prevention:</strong> Issued invoices cannot be deleted. 
                Voiding an invoice generates a credit note while preserving the original record.
              </li>
              <li>
                <strong>Point-in-Time Snapshots:</strong> Issuer and recipient data are 
                captured at the time of issuance and stored immutably.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              4.2 Cryptographic Integrity
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following cryptographic controls are applied to issued invoices:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>
                <strong>SHA-256 Hash:</strong> A cryptographic hash is generated at issuance 
                and stored with the invoice record for integrity verification.
              </li>
              <li>
                <strong>Verification ID:</strong> A unique verification identifier (UUID) is 
                assigned to each issued invoice, enabling third-party verification.
              </li>
              <li>
                <strong>Timestamp:</strong> Issuance time is recorded in UTC with timezone 
                information preserved.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              4.3 Audit Trail
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              An append-only audit log records all material actions, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Invoice lifecycle events (creation, issuance, viewing, voiding)</li>
              <li>Payment recording events</li>
              <li>Client and business record modifications</li>
              <li>User authentication events</li>
              <li>Data export operations</li>
              <li>Team membership and role changes</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Each audit event includes actor identification, timestamp, entity reference, 
              and relevant state data. Audit logs cannot be modified or deleted.
            </p>
          </section>

          {/* Section 5: Data Retention */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              5. Data Retention
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              5.1 Retention Periods
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Data retention periods are enforced based on the business jurisdiction:
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full border border-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Jurisdiction</th>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Entity Types</th>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="border border-border px-4 py-2">Nigeria (NG)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">6 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">United States (US)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">7 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">United Kingdom (GB)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">6 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Germany (DE)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">10 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">France (FR)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">10 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Australia (AU)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">7 years</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Canada (CA)</td>
                    <td className="border border-border px-4 py-2">Invoices, Credit Notes, Payments</td>
                    <td className="border border-border px-4 py-2">7 years</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-foreground mb-3">
              5.2 Retention Enforcement
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Lock Date:</strong> Each record includes a retention lock date, 
                before which the record cannot be deleted.
              </li>
              <li>
                <strong>Automated Cleanup:</strong> Expired records are processed by scheduled 
                cleanup jobs only after the retention period has elapsed.
              </li>
              <li>
                <strong>Premature Deletion Prevention:</strong> Database constraints prevent 
                deletion of records before their retention period expires.
              </li>
            </ul>
          </section>

          {/* Section 6: Security Controls */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              6. Security Controls
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              6.1 Access Controls
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>
                <strong>Row-Level Security (RLS):</strong> All data tables enforce row-level 
                security policies, ensuring users can only access data they are authorized to view.
              </li>
              <li>
                <strong>Authentication:</strong> All operations require authenticated sessions.
              </li>
              <li>
                <strong>Role-Based Access:</strong> Users are assigned roles (owner, admin, member, auditor) 
                with corresponding permission levels.
              </li>
              <li>
                <strong>Service Tier Enforcement:</strong> Feature access is controlled at the database 
                level based on subscription tier.
              </li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              6.2 Data Protection
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Encryption in Transit:</strong> All data transmission uses HTTPS/TLS encryption.
              </li>
              <li>
                <strong>Encryption at Rest:</strong> Data is encrypted at rest using infrastructure-level 
                encryption provided by the hosting platform.
              </li>
              <li>
                <strong>Credential Security:</strong> No credentials are stored in unencrypted form. 
                API keys and secrets are managed through secure environment configuration.
              </li>
            </ul>
          </section>

          {/* Section 7: Compliance and Regulatory Alignment */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              7. Compliance and Regulatory Alignment
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              7.1 Design Principles
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Platform has been designed with the following compliance objectives:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Support audit-ready financial recordkeeping</li>
              <li>Align with common tax record retention requirements</li>
              <li>Provide technical infrastructure compatible with future e-invoicing framework integration</li>
              <li>Enable third-party verification of invoice authenticity</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              7.2 Disclaimers
            </h3>
            <div className="bg-muted border border-border rounded-lg p-4 text-muted-foreground">
              <p className="mb-3">
                <strong className="text-foreground">Important:</strong> The following disclaimers apply:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Invoicemonk is not certified or accredited by any government agency, 
                  tax authority, or regulatory body.
                </li>
                <li>
                  Use of the Platform does not constitute compliance with any specific 
                  tax law, e-invoicing mandate, or regulatory requirement.
                </li>
                <li>
                  The Platform is not a substitute for professional tax, legal, or 
                  accounting advice.
                </li>
                <li>
                  Customers are solely responsible for ensuring their use of the Platform 
                  complies with applicable laws and regulations.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 8: Customer Responsibilities */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              8. Customer Responsibilities
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Customers using the Platform agree to the following responsibilities:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                <strong>Data Accuracy:</strong> Customers are responsible for the accuracy 
                of all invoice data submitted to the Platform.
              </li>
              <li>
                <strong>Lawful Use:</strong> The Platform must be used only for lawful 
                business purposes in accordance with applicable laws.
              </li>
              <li>
                <strong>Tax Compliance:</strong> Customers are responsible for compliance 
                with all applicable tax laws, including correct tax rate application.
              </li>
              <li>
                <strong>Account Security:</strong> Customers must maintain the security of 
                their account credentials and promptly report any unauthorized access.
              </li>
              <li>
                <strong>Data Export:</strong> Customers should export their records before 
                account termination if data preservation is required.
              </li>
            </ul>
          </section>

          {/* Section 9: Support and Communication */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              9. Support and Communication
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              9.1 Support Channels
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>In-app messaging</li>
              <li>Email support</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              9.2 Support Tiers
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>
                <strong>Professional and Business tiers:</strong> Priority support handling
              </li>
              <li>
                <strong>Business tier:</strong> Dedicated account manager
              </li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              9.3 Incident Communication
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Service incidents will be communicated via registered email</li>
              <li>Scheduled maintenance will be announced in advance</li>
              <li>Post-incident reports will be provided for significant outages</li>
            </ul>
          </section>

          {/* Section 10: Limitation of Liability */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              10. Limitation of Liability
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To the maximum extent permitted by applicable law:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                The Platform is provided "as-is" for compliance support purposes.
              </li>
              <li>
                No guarantee is made regarding acceptance by any specific regulatory body 
                or government agency.
              </li>
              <li>
                The Platform operator shall not be liable for any indirect, incidental, 
                special, or consequential damages arising from use of the Platform.
              </li>
              <li>
                Liability for direct damages shall not exceed the fees paid by the customer 
                in the twelve (12) months preceding the claim.
              </li>
            </ul>
          </section>

          {/* Section 11: SLA Updates and Governance */}
          <section className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              11. SLA Updates and Governance
            </h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>
                This SLA is subject to revision as regulations, technology, and service 
                capabilities evolve.
              </li>
              <li>
                Updates will be published at this URL with version number and effective date.
              </li>
              <li>
                Material changes will be communicated with a minimum of thirty (30) days notice.
              </li>
              <li>
                Continued use of the Platform following an SLA update constitutes acceptance 
                of the revised terms.
              </li>
            </ul>
          </section>

          {/* Document Footer */}
          <footer className="mt-12 pt-8 border-t border-border">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">Document Control</strong>
              </p>
              <p>Published: January 30, 2026</p>
              <p>Version: 1.0</p>
              <p>Document ID: IM-SLA-2026-001</p>
              <p className="mt-4">
                For questions regarding this SLA, contact: support@invoicemonk.com
              </p>
            </div>
          </footer>
        </article>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            font-size: 11pt;
            line-height: 1.4;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          article {
            max-width: 100%;
          }
          
          h1 {
            font-size: 18pt !important;
          }
          
          h2 {
            font-size: 14pt !important;
            page-break-after: avoid;
          }
          
          h3 {
            font-size: 12pt !important;
            page-break-after: avoid;
          }
          
          section {
            page-break-inside: avoid;
          }
          
          table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
