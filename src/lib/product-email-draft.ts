// Display-only mirror of the product tip email draft in
// supabase/functions/process-lifecycle-campaigns/index.ts
// (PRODUCT_COPY, productNudgeSubject, productNudgeTemplate, emailWrapper).
// Keep in sync when the processor's copy changes. No sending logic here.

export interface ProductEmailCopy {
  name: string;
  next: string;
  path: string;
}

export const PRODUCT_EMAIL_COPY: Record<string, ProductEmailCopy> = {
  invoicing: { name: 'invoicing', next: 'issue and send your first invoice', path: '/invoices/new' },
  payments: { name: 'payment tracking', next: 'record a payment against an invoice', path: '/receivables' },
  receipts: { name: 'receipts', next: 'send a receipt to your client', path: '/receipts' },
  expenses: { name: 'expense tracking', next: 'add a receipt to an expense', path: '/expenses' },
  receipt_capture: { name: 'receipt scanning', next: 'approve a scanned receipt into an expense', path: '/expenses/inbox' },
  accounting: { name: 'your accounting overview', next: 'check your profit result', path: '/accounting/result' },
  tax_reports: { name: 'tax reports', next: 'export your tax report', path: '/accounting/tax-reports' },
  reports: { name: 'reports', next: 'download or email a report', path: '/reports' },
  data_import: { name: 'importing your data', next: 'finish your import', path: '/import' },
  e_invoicing: { name: 'e-invoicing', next: 'complete a regulator submission', path: '/invoices' },
};

export function productEmailSubject(area: string): string {
  return `Pick up where you left off with ${PRODUCT_EMAIL_COPY[area]?.name ?? area.replace(/_/g, ' ')}`;
}

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
}

function emailWrapper(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: #ffffff; padding: 20px 30px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 1px solid #e5e7eb;">
    <span style="display:inline-block;font-size:20px;font-weight:700;color:#1d6b5a;">Invoicemonk</span>
  </div>
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 24px 30px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">${title}</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Sent by Invoicemonk · <a href="https://invoicemonk.com" style="color: #999;">invoicemonk.com</a>
    </p>
  </div>
</body>
</html>`;
}

export function productEmailHtml(area: string, opts: { name?: string; statedIntent?: string | null } = {}): string {
  const c = PRODUCT_EMAIL_COPY[area] ?? { name: area.replace(/_/g, ' '), next: 'finish what you started', path: '/dashboard' };
  const why = opts.statedIntent
    ? `<p>You told us you wanted to ${esc(opts.statedIntent.replace(/_/g, ' '))}.</p>`
    : '';
  const body = `<p>Hi ${esc(opts.name || 'there')},</p><p>You started using ${esc(c.name)} but didn't get to the finish line.</p>${why}<p>The next step is to <strong>${esc(c.next)}</strong>. It only takes a minute.</p><p><a href="https://app.invoicemonk.com${c.path}" style="background:#1d6b5a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Continue</a></p><p style="color:#999;font-size:12px;">Don't want these tips? Turn off "Product tips" in Settings → Notifications.</p>`;
  return emailWrapper('Still with you', body);
}

export function productEmailBodyText(area: string, opts: { name?: string; statedIntent?: string | null } = {}): string {
  const c = PRODUCT_EMAIL_COPY[area] ?? { name: area.replace(/_/g, ' '), next: 'finish what you started', path: '/dashboard' };
  const why = opts.statedIntent ? ` You told us you wanted to ${opts.statedIntent.replace(/_/g, ' ')}.` : '';
  return `Hi ${opts.name || 'there'},\n\nYou started using ${c.name} but didn't get to the finish line.${why}\nThe next step is to ${c.next}. It only takes a minute.\n\n[Continue]\n\nDon't want these tips? Turn off "Product tips" in Settings → Notifications.`;
}
