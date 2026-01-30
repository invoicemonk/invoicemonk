import { Link } from "react-router-dom";
import { ArrowLeft, Printer, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function CodeBlock({ children, language = "json" }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted border border-border rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-foreground">{children}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function APIDocumentation() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Invoicemonk</span>
          </Link>
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
              API Documentation
            </h1>
            <p className="text-xl text-muted-foreground mb-6">
              Programmatic Access to Invoicemonk Compliance Infrastructure
            </p>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Version:</span> v1
              </div>
              <div>
                <span className="font-medium text-foreground">Last Updated:</span> January 30, 2026
              </div>
              <div>
                <span className="font-medium text-foreground">Access:</span> Business Tier Required
              </div>
            </div>
          </header>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 bg-muted/50 rounded-lg border border-border print:hidden">
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">Contents</h2>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
              <li><a href="#overview" className="hover:text-foreground transition-colors">Overview</a></li>
              <li><a href="#authentication" className="hover:text-foreground transition-colors">Authentication</a></li>
              <li><a href="#endpoints" className="hover:text-foreground transition-colors">Core Endpoints</a></li>
              <li><a href="#audit" className="hover:text-foreground transition-colors">Audit and Compliance</a></li>
              <li><a href="#rate-limits" className="hover:text-foreground transition-colors">Rate Limiting</a></li>
              <li><a href="#errors" className="hover:text-foreground transition-colors">Error Handling</a></li>
              <li><a href="#versioning" className="hover:text-foreground transition-colors">Versioning</a></li>
              <li><a href="#security" className="hover:text-foreground transition-colors">Security</a></li>
              <li><a href="#support" className="hover:text-foreground transition-colors">Access and Support</a></li>
            </ol>
          </nav>

          {/* Section 1: Overview */}
          <section id="overview" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              1. Overview
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Invoicemonk API provides programmatic access to our compliance infrastructure,
              enabling ERP integrators, accounting software vendors, and enterprise IT teams to
              build integrations with audit-ready, immutable records management.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Access Requirement:</strong> API access is available
              exclusively to Business tier subscribers.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Base URL:</strong>{" "}
              <code className="bg-muted px-2 py-1 rounded text-sm">https://your-project.supabase.co/functions/v1</code>
            </p>
          </section>

          {/* Section 2: Authentication */}
          <section id="authentication" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              2. Authentication
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              2.1 Bearer Token Authentication
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              All API requests must include a valid bearer token in the Authorization header:
            </p>
            <CodeBlock>{`Authorization: Bearer <access_token>`}</CodeBlock>

            <h3 className="text-lg font-medium text-foreground mb-3 mt-6">
              2.2 Token Acquisition
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Access tokens are obtained through Supabase Auth using JWT-based authentication.
              Tokens can be acquired via:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Email/password authentication</li>
              <li>OAuth providers (if configured)</li>
              <li>Refresh token flow for session renewal</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              2.3 Security Requirements
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>HTTPS required for all API requests</li>
              <li>Tokens should never be logged or transmitted insecurely</li>
              <li>Token rotation recommended every 90 days for service accounts</li>
              <li>Store tokens securely (never in source code)</li>
            </ul>
          </section>

          {/* Section 3: Core Endpoints */}
          <section id="endpoints" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              3. Core Endpoints
            </h2>

            {/* 3.1 Invoice Issuance */}
            <div className="mb-8 p-6 border border-border rounded-lg">
              <h3 className="text-lg font-medium text-foreground mb-2">
                3.1 Invoice Issuance
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <code className="bg-primary/10 text-primary px-2 py-1 rounded">POST</code>{" "}
                <code className="bg-muted px-2 py-1 rounded">/functions/v1/issue-invoice</code>
              </p>
              
              <p className="text-muted-foreground leading-relaxed mb-4">
                Issues a draft invoice, making it immutable and assigning a verification ID.
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock>{`{
  "invoice_id": "uuid"
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Preconditions</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm mb-4">
                <li>Invoice must be in <code>draft</code> status</li>
                <li>Business profile must be complete</li>
                <li>User email must be verified</li>
                <li>Monthly invoice limit not exceeded</li>
              </ul>

              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock>{`{
  "success": true,
  "invoice": {
    "id": "uuid",
    "invoice_number": "INV-001",
    "verification_id": "uuid",
    "issued_at": "2026-01-30T12:00:00Z",
    "invoice_hash": "sha256-hex-string"
  }
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Compliance Behavior</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                <li>SHA-256 hash generated and stored</li>
                <li>Point-in-time snapshots captured (issuer, recipient, tax schema)</li>
                <li>Audit event logged: <code>INVOICE_ISSUED</code></li>
                <li>Invoice becomes immutable</li>
              </ul>
            </div>

            {/* 3.2 Invoice Verification */}
            <div className="mb-8 p-6 border border-border rounded-lg">
              <h3 className="text-lg font-medium text-foreground mb-2">
                3.2 Invoice Verification
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <code className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded">GET</code>{" "}
                <code className="bg-muted px-2 py-1 rounded">/functions/v1/verify-invoice?verification_id=&#123;uuid&#125;</code>
              </p>
              
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong className="text-foreground">Public Access:</strong> This endpoint does not require authentication.
                <br />
                <strong className="text-foreground">Tier Restriction:</strong> Verification only succeeds if the invoice issuer has Professional or Business tier.
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock>{`{
  "verified": true,
  "invoice": {
    "invoice_number": "INV-001",
    "issue_date": "2026-01-30",
    "issued_at": "2026-01-30T12:00:00Z",
    "issuer_name": "Business Name",
    "payment_status": "Issued - Awaiting Payment",
    "total_amount": 50000.00,
    "currency": "NGN",
    "integrity_valid": true
  }
}`}</CodeBlock>

              <p className="text-sm text-muted-foreground mt-4">
                <strong>Integrity Check:</strong> <code>integrity_valid</code> confirms the invoice hash exists
                and has not been tampered with.
              </p>
            </div>

            {/* 3.3 Payment Recording */}
            <div className="mb-8 p-6 border border-border rounded-lg">
              <h3 className="text-lg font-medium text-foreground mb-2">
                3.3 Payment Recording
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <code className="bg-primary/10 text-primary px-2 py-1 rounded">POST</code>{" "}
                <code className="bg-muted px-2 py-1 rounded">/functions/v1/record-payment</code>
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock>{`{
  "invoice_id": "uuid",
  "amount": 25000.00,
  "payment_method": "bank_transfer",
  "payment_reference": "TRF-123456",
  "payment_date": "2026-01-30",
  "notes": "First installment"
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Validation</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm mb-4">
                <li>Invoice must be in <code>issued</code>, <code>sent</code>, or <code>viewed</code> status</li>
                <li>Amount must be positive</li>
                <li>Payment recorded with <code>retention_locked_until</code> based on jurisdiction</li>
              </ul>

              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock>{`{
  "success": true,
  "payment": {
    "id": "uuid",
    "invoice_id": "uuid",
    "amount": 25000.00,
    "payment_date": "2026-01-30"
  },
  "invoice_status": "issued"
}`}</CodeBlock>

              <p className="text-sm text-muted-foreground mt-4">
                <strong>Auto-Status Update:</strong> If total payments equal invoice amount, status changes to <code>paid</code>.
              </p>
            </div>

            {/* 3.4 Invoice Voiding */}
            <div className="mb-8 p-6 border border-border rounded-lg">
              <h3 className="text-lg font-medium text-foreground mb-2">
                3.4 Invoice Voiding
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <code className="bg-primary/10 text-primary px-2 py-1 rounded">POST</code>{" "}
                <code className="bg-muted px-2 py-1 rounded">/functions/v1/void-invoice</code>
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock>{`{
  "invoice_id": "uuid",
  "reason": "Customer requested cancellation due to order error"
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Validation</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm mb-4">
                <li>Reason must be at least 10 characters (audit requirement)</li>
                <li>Invoice must be in <code>issued</code>, <code>sent</code>, or <code>viewed</code> status</li>
                <li>Cannot void already paid, voided, or credited invoices</li>
              </ul>

              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock>{`{
  "success": true,
  "credit_note": {
    "id": "uuid",
    "credit_note_number": "CN-INV-001",
    "amount": 50000.00,
    "reason": "Customer requested cancellation",
    "issued_at": "2026-01-30T12:00:00Z"
  }
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Compliance Behavior</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                <li>Original invoice is NOT deleted (immutable)</li>
                <li>Credit note created with SHA-256 hash</li>
                <li>Invoice status changed to <code>voided</code></li>
                <li>Audit event logged: <code>INVOICE_VOIDED</code></li>
              </ul>
            </div>

            {/* 3.5 PDF Generation */}
            <div className="mb-8 p-6 border border-border rounded-lg">
              <h3 className="text-lg font-medium text-foreground mb-2">
                3.5 PDF Generation
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <code className="bg-primary/10 text-primary px-2 py-1 rounded">POST</code>{" "}
                <code className="bg-muted px-2 py-1 rounded">/functions/v1/generate-pdf</code>
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock>{`{
  "invoice_id": "uuid"
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Tier Behavior</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm mb-4">
                <li><strong>Starter:</strong> Watermark applied</li>
                <li><strong>Professional/Business:</strong> Clean PDF with optional branding</li>
              </ul>

              <p className="text-sm text-muted-foreground">
                <strong>Response:</strong> Base64-encoded PDF or binary stream
              </p>
            </div>

            {/* 3.6 Data Export */}
            <div className="mb-8 p-6 border border-border rounded-lg">
              <h3 className="text-lg font-medium text-foreground mb-2">
                3.6 Data Export
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <code className="bg-primary/10 text-primary px-2 py-1 rounded">POST</code>{" "}
                <code className="bg-muted px-2 py-1 rounded">/functions/v1/export-records</code>
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Access:</strong> Professional and Business tiers only
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Request Body</h4>
              <CodeBlock>{`{
  "export_type": "invoices",
  "business_id": "uuid",
  "date_from": "2026-01-01",
  "date_to": "2026-01-31",
  "format": "csv"
}`}</CodeBlock>

              <p className="text-sm text-muted-foreground my-4">
                <strong>Export Types:</strong> <code>invoices</code>, <code>audit_logs</code>, <code>payments</code>, <code>clients</code>
              </p>

              <h4 className="text-sm font-medium text-foreground mb-2">Response</h4>
              <CodeBlock>{`{
  "success": true,
  "export_id": "uuid",
  "manifest_id": "uuid",
  "data": "csv-content-string",
  "filename": "invoices_export_2026-01-30.csv",
  "record_count": 45,
  "generated_at": "2026-01-30T12:00:00Z",
  "integrity_hash": "sha256-of-export-content"
}`}</CodeBlock>

              <h4 className="text-sm font-medium text-foreground mb-2 mt-4">Chain of Custody</h4>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                <li>Export manifest created with actor, timestamp, scope</li>
                <li>Integrity hash generated for export content</li>
                <li>Audit event logged: <code>DATA_EXPORTED</code></li>
              </ul>
            </div>
          </section>

          {/* Section 4: Audit and Compliance */}
          <section id="audit" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              4. Audit and Compliance Behavior
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              4.1 Automatically Logged Events
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following event types are automatically recorded in the audit log:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Authentication</h4>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                  <li><code>USER_LOGIN</code></li>
                  <li><code>USER_LOGOUT</code></li>
                  <li><code>USER_SIGNUP</code></li>
                  <li><code>EMAIL_VERIFIED</code></li>
                  <li><code>PASSWORD_RESET</code></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Invoice Lifecycle</h4>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                  <li><code>INVOICE_CREATED</code></li>
                  <li><code>INVOICE_UPDATED</code></li>
                  <li><code>INVOICE_ISSUED</code></li>
                  <li><code>INVOICE_SENT</code></li>
                  <li><code>INVOICE_VIEWED</code></li>
                  <li><code>INVOICE_VOIDED</code></li>
                  <li><code>INVOICE_CREDITED</code></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Financial</h4>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                  <li><code>PAYMENT_RECORDED</code></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Access Control</h4>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1 text-sm">
                  <li><code>TEAM_MEMBER_ADDED</code></li>
                  <li><code>TEAM_MEMBER_REMOVED</code></li>
                  <li><code>ROLE_CHANGED</code></li>
                  <li><code>DATA_EXPORTED</code></li>
                </ul>
              </div>
            </div>

            <h3 className="text-lg font-medium text-foreground mb-3">
              4.2 Audit Log Structure
            </h3>
            <CodeBlock>{`{
  "event_type": "INVOICE_ISSUED",
  "entity_type": "invoice",
  "entity_id": "uuid",
  "actor_id": "uuid",
  "actor_role": "owner",
  "timestamp_utc": "2026-01-30T12:00:00Z",
  "previous_state": { ... },
  "new_state": { ... },
  "metadata": { ... },
  "event_hash": "sha256-of-event"
}`}</CodeBlock>

            <h3 className="text-lg font-medium text-foreground mb-3 mt-6">
              4.3 Retention Policies
            </h3>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full border border-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Jurisdiction</th>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr><td className="border border-border px-4 py-2">Nigeria (NG)</td><td className="border border-border px-4 py-2">6 years</td></tr>
                  <tr><td className="border border-border px-4 py-2">United States (US)</td><td className="border border-border px-4 py-2">7 years</td></tr>
                  <tr><td className="border border-border px-4 py-2">United Kingdom (GB)</td><td className="border border-border px-4 py-2">6 years</td></tr>
                  <tr><td className="border border-border px-4 py-2">Germany (DE)</td><td className="border border-border px-4 py-2">10 years</td></tr>
                  <tr><td className="border border-border px-4 py-2">France (FR)</td><td className="border border-border px-4 py-2">10 years</td></tr>
                  <tr><td className="border border-border px-4 py-2">Australia (AU)</td><td className="border border-border px-4 py-2">7 years</td></tr>
                  <tr><td className="border border-border px-4 py-2">Canada (CA)</td><td className="border border-border px-4 py-2">7 years</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5: Rate Limiting */}
          <section id="rate-limits" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              5. Rate Limiting and Usage Controls
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              5.1 Default Limits
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>100 requests per minute per user</li>
              <li>1,000 requests per hour per user</li>
              <li>Bulk export operations limited to 10,000 records per request</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              5.2 Tier-Based Scaling
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li><strong>Business tier:</strong> Higher rate limits available upon request</li>
              <li><strong>Enterprise agreements:</strong> Custom rate limits negotiated separately</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              5.3 Abuse Prevention
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Repeated authentication failures may trigger temporary lockout</li>
              <li>Excessive failed requests logged for security review</li>
            </ul>
          </section>

          {/* Section 6: Error Handling */}
          <section id="errors" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              6. Error Handling
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              6.1 Standard Error Response
            </h3>
            <CodeBlock>{`{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}`}</CodeBlock>

            <h3 className="text-lg font-medium text-foreground mb-3 mt-6">
              6.2 HTTP Status Codes
            </h3>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full border border-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Code</th>
                    <th className="border border-border px-4 py-2 text-left font-medium text-foreground">Meaning</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr><td className="border border-border px-4 py-2">200</td><td className="border border-border px-4 py-2">Success</td></tr>
                  <tr><td className="border border-border px-4 py-2">400</td><td className="border border-border px-4 py-2">Bad Request - Invalid input</td></tr>
                  <tr><td className="border border-border px-4 py-2">401</td><td className="border border-border px-4 py-2">Unauthorized - Missing or invalid token</td></tr>
                  <tr><td className="border border-border px-4 py-2">403</td><td className="border border-border px-4 py-2">Forbidden - Tier restriction or permission denied</td></tr>
                  <tr><td className="border border-border px-4 py-2">404</td><td className="border border-border px-4 py-2">Not Found - Resource does not exist</td></tr>
                  <tr><td className="border border-border px-4 py-2">429</td><td className="border border-border px-4 py-2">Too Many Requests - Rate limit exceeded</td></tr>
                  <tr><td className="border border-border px-4 py-2">500</td><td className="border border-border px-4 py-2">Server Error - Unexpected failure</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium text-foreground mb-3">
              6.3 Compliance-Safe Errors
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Error messages do not expose internal system details</li>
              <li>Validation errors provide guidance without revealing data structure</li>
            </ul>
          </section>

          {/* Section 7: Versioning */}
          <section id="versioning" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              7. Versioning and Change Management
            </h2>
            
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Current Version:</strong> v1
              <br />
              <strong className="text-foreground">Format:</strong> <code>/functions/v1/endpoint-name</code>
            </p>

            <h3 className="text-lg font-medium text-foreground mb-3">
              7.1 Backward Compatibility
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Breaking changes will be introduced in new versions only</li>
              <li>Deprecated versions will be supported for minimum 12 months</li>
              <li>Deprecation notices published 6 months in advance</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              7.2 Change Notification
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>API changes documented in release notes</li>
              <li>Enterprise customers notified via registered email</li>
              <li>Status page updated for any breaking changes</li>
            </ul>
          </section>

          {/* Section 8: Security */}
          <section id="security" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              8. Security Considerations
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              8.1 Encryption
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>All API traffic encrypted via HTTPS/TLS 1.2+</li>
              <li>Data encrypted at rest using infrastructure-level encryption</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              8.2 Access Logging
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>All API requests logged with timestamp, user, and action</li>
              <li>Logs retained per jurisdiction retention policy</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              8.3 IP Restrictions
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>IP whitelisting available for Enterprise tier</li>
              <li>Contact support to configure IP restrictions</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              8.4 Key Management
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>API tokens should be stored securely (never in source code)</li>
              <li>Service accounts recommended for production integrations</li>
              <li>Token rotation every 90 days recommended</li>
            </ul>
          </section>

          {/* Section 9: Access and Support */}
          <section id="support" className="mb-10">
            <h2 className="text-xl font-display font-semibold text-foreground mb-4">
              9. Access and Support
            </h2>
            
            <h3 className="text-lg font-medium text-foreground mb-3">
              9.1 Requesting API Access
            </h3>
            <ol className="list-decimal pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Upgrade to Business tier</li>
              <li>Complete business profile with legal name and tax ID</li>
              <li>Verify email address</li>
              <li>Contact support for API key provisioning (if separate from auth tokens)</li>
            </ol>

            <h3 className="text-lg font-medium text-foreground mb-3">
              9.2 Review Process
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li>Business verification may be required for high-volume access</li>
              <li>Enterprise customers receive dedicated onboarding</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              9.3 Support Channels
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
              <li><strong>Standard:</strong> In-app messaging, email support</li>
              <li><strong>Business tier:</strong> Priority email support</li>
              <li><strong>Enterprise:</strong> Dedicated account manager, SLA-backed response times</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-3">
              9.4 Escalation
            </h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Critical issues</strong> (data integrity, security): Immediate escalation</li>
              <li><strong>Integration support:</strong> Responded within 2 business days</li>
            </ul>
          </section>

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>
              For additional information, see our{" "}
              <Link to="/legal/sla" className="text-primary hover:underline">
                Service Level Agreement
              </Link>
            </p>
            <p className="mt-2">
              Document ID: IM-API-2026-001 | Version 1.0
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
