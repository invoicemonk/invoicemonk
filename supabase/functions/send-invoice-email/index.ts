import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Validation utilities (inline to avoid Deno import issues)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUUID(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (!UUID_REGEX.test(value)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

function validateEmail(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value) || value.length > 254) {
    return `${fieldName} must be a valid email address`;
  }
  return null;
}

function validateString(value: unknown, fieldName: string, maxLength = 1000): string | null {
  if (value === null || value === undefined || value === '') {
    return null; // Optional field
  }
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }
  return null;
}

function sanitizeString(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

// Dynamic CORS configuration - allows any Lovable preview domain + production
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com') ||
    origin === 'https://app.invoicemonk.com' ||
    origin === 'https://invoicemonk.com' ||
    origin.startsWith('http://localhost:')
  );
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://app.invoicemonk.com';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

interface SendInvoiceRequest {
  invoice_id: string
  recipient_email: string
  custom_message?: string
  app_url?: string // Optional: client-provided base URL for verification links
}

interface IssuerSnapshot {
  legal_name?: string
  name?: string
  contact_email?: string
  contact_phone?: string
  logo_url?: string
  tax_id?: string
  vat_registration_number?: string
  is_vat_registered?: boolean
  jurisdiction?: string
  address?: {
    line1?: string
    street?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
  }
}

interface RecipientSnapshot {
  name?: string
  email?: string
  phone?: string
  tax_id?: string
  cac_number?: string
  address?: {
    line1?: string
    street?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
  }
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  tax_rate: number
  tax_amount: number
  discount_percent: number
}

interface TemplateSnapshot {
  id?: string
  name?: string
  watermark_required?: boolean
  supports_branding?: boolean
  tier_required?: string
  layout?: {
    header_style?: string
    show_logo?: boolean
    show_terms?: boolean
    show_notes?: boolean
    show_verification_qr?: boolean
    show_bank_details?: boolean
  }
  styles?: {
    primary_color?: string
    font_family?: string
    font_size?: string
  }
}

// Helper: Format currency with proper locale (for HTML emails - supports all Unicode)
const formatCurrency = (amount: number, currency: string): string => {
  const localeMap: Record<string, string> = {
    'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
    'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
    'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
  }
  const locale = localeMap[currency] || 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

// Helper: Format currency for PDF (WinAnsi-safe - no special currency symbols)
const formatCurrencyPdf = (amount: number, currency: string): string => {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${currency} ${formatted}`
}

// Helper: Format date
const formatDate = (date: string | null): string => {
  if (!date) return 'Not specified'
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  })
}

// Helper: Format address compactly
const formatAddressCompact = (address: IssuerSnapshot['address'] | RecipientSnapshot['address']): string => {
  if (!address) return ''
  const parts = [
    address.line1 || address.street,
    address.city,
    address.state,
    address.country
  ].filter(Boolean)
  return parts.join(', ')
}

// Professional HTML template matching generate-pdf output
const generateProfessionalHtml = (
  invoice: Record<string, unknown>,
  items: InvoiceItem[],
  issuerSnapshot: IssuerSnapshot | null,
  recipientSnapshot: RecipientSnapshot | null,
  verificationUrl: string | null,
  showWatermark: boolean,
  canUseBranding: boolean,
  issuerLogoUrlParam: string | null = null,
  paymentMethodSnapshot: Record<string, unknown> | null = null,
  templateSnapshot: TemplateSnapshot | null = null
): string => {
  const currency = invoice.currency as string
  const balanceDue = (invoice.total_amount as number) - ((invoice.amount_paid as number) || 0)
  
  // Issuer info
  const issuerName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk User'
  const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
  const issuerEmail = issuerSnapshot?.contact_email || ''
  const issuerPhone = issuerSnapshot?.contact_phone || ''
  const issuerTaxId = issuerSnapshot?.tax_id || ''
  const issuerVatRegNumber = issuerSnapshot?.vat_registration_number || ''
  const issuerIsVatRegistered = issuerSnapshot?.is_vat_registered || false
  const issuerJurisdiction = issuerSnapshot?.jurisdiction || ''
  // Use the passed logo URL (which may be from snapshot or fallback from business table)
  const issuerLogoUrl = issuerLogoUrlParam || issuerSnapshot?.logo_url || null
  
  // Recipient info
  const recipientName = recipientSnapshot?.name || 'Client'
  const recipientEmail = recipientSnapshot?.email || ''
  const recipientAddress = formatAddressCompact(recipientSnapshot?.address)
  const recipientTaxId = recipientSnapshot?.tax_id || ''
  const recipientCacNumber = recipientSnapshot?.cac_number || ''
  
  // Status colors
  const statusColors: Record<string, { bg: string; color: string }> = {
    'issued': { bg: '#dbeafe', color: '#1d4ed8' },
    'sent': { bg: '#e0e7ff', color: '#4338ca' },
    'viewed': { bg: '#fef3c7', color: '#d97706' },
    'paid': { bg: '#d1fae5', color: '#059669' },
    'voided': { bg: '#fee2e2', color: '#dc2626' },
    'credited': { bg: '#fce7f3', color: '#db2777' }
  }
  const statusStyle = statusColors[invoice.status as string] || statusColors['issued']
  
  // Generate items HTML
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${formatCurrency(item.unit_price, currency)}</td>
      <td class="right">${formatCurrency(item.amount, currency)}</td>
    </tr>
  `).join('')
  
  // QR code
  const qrCodeHtml = verificationUrl 
    ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${encodeURIComponent(verificationUrl)}&format=svg" alt="QR Code" style="width: 50px; height: 50px;" />`
    : ''
  
  // Verification info
  const verificationLine = invoice.verification_id 
    ? `Verification: ${(invoice.verification_id as string).substring(0, 8)}...` 
    : ''
  const hashLine = invoice.invoice_hash 
    ? `Hash: ${(invoice.invoice_hash as string).substring(0, 12)}...` 
    : ''
  
  // Watermark
  const watermarkHtml = showWatermark ? `<div class="watermark">INVOICEMONK</div>` : ''

  // Template layout and styles
  const tplLayout = templateSnapshot?.layout || {}
  const tplStyles = templateSnapshot?.styles || {}
  const tplPrimaryColor = tplStyles.primary_color || '#1a1a1a'
  const tplHeaderStyle = tplLayout.header_style || 'standard'
  const showLogo = tplLayout.show_logo !== false
  const showTerms = tplLayout.show_terms !== false
  const showNotes = tplLayout.show_notes !== false
  const showQr = tplLayout.show_verification_qr !== false

  // Shared CSS
  const sharedCss = `
    @page { size: A4; margin: 12mm 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-break { page-break-inside: avoid; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      color: #1a1a1a; 
      font-size: 11px; 
      line-height: 1.35; 
    }
    .container { max-width: 100%; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
    th { background: #f8f9fa; padding: 6px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; color: #666; border-bottom: 1px solid #d1d5db; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    th.right, td.right { text-align: right; }
    tr:last-child td { border-bottom: 1px solid #d1d5db; }
    .footer-branding { text-align: center; font-size: 8px; color: #aaa; padding: 10px 0 0; margin-top: 16px; border-top: 1px solid #eee; }
    .footer-branding a { color: #888; text-decoration: none; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(0,0,0,0.04); font-weight: 700; z-index: -1; white-space: nowrap; pointer-events: none; }
  `

  // Items table
  const itemsTableHtml = `
    <table class="no-break">
      <thead><tr>
        <th style="width: 55%;">Description</th>
        <th class="right" style="width: 10%;">Qty</th>
        <th class="right" style="width: 17%;">Rate</th>
        <th class="right" style="width: 18%;">Amount</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  `

  // Totals
  const totalsHtml = `
    <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;" class="no-break">
      <div style="width: 240px;">
        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;"><span>Subtotal</span><span>${formatCurrency(invoice.subtotal as number, currency)}</span></div>
        ${(invoice.tax_amount as number) > 0 ? `<div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;"><span>Tax</span><span>${formatCurrency(invoice.tax_amount as number, currency)}</span></div>` : ''}
        ${(invoice.discount_amount as number) > 0 ? `<div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #444;"><span>Discount</span><span>-${formatCurrency(invoice.discount_amount as number, currency)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #1a1a1a; border-top: 2px solid #1a1a1a; padding-top: 6px; margin-top: 4px;"><span>Total</span><span>${formatCurrency(invoice.total_amount as number, currency)}</span></div>
        ${(invoice.amount_paid as number) > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 3px 0; font-size: 10px; color: #059669;"><span>Paid</span><span>-${formatCurrency(invoice.amount_paid as number, currency)}</span></div>
        <div style="display: flex; justify-content: space-between; font-weight: 600; background: #fef3c7; padding: 4px 6px; margin: 4px -6px 0; border-radius: 3px;"><span>Balance Due</span><span>${formatCurrency(balanceDue, currency)}</span></div>` : ''}
      </div>
    </div>
  `

  // Notes/Terms
  const notesTermsHtml = ((showNotes && invoice.notes) || (showTerms && invoice.terms)) ? `
    <div style="margin-bottom: 12px; padding: 8px 10px; background: #fafafa; border-radius: 4px;" class="no-break">
      ${showNotes && invoice.notes ? `<div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 3px;">Notes</div><div style="font-size: 10px; color: #444;">${invoice.notes}</div>` : ''}
      ${(showNotes && invoice.notes) && (showTerms && invoice.terms) ? '<div style="height: 8px;"></div>' : ''}
      ${showTerms && invoice.terms ? `<div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 3px;">Terms</div><div style="font-size: 10px; color: #444;">${invoice.terms}</div>` : ''}
    </div>
  ` : ''

  // Payment method
  const paymentMethodHtml = (() => {
    if (!paymentMethodSnapshot) return ''
    const displayName = (paymentMethodSnapshot.display_name as string) || 'Payment Method'
    const instructions = paymentMethodSnapshot.instructions as Record<string, string> | null
    const instructionRows = instructions
      ? Object.entries(instructions).map(([key, value]) =>
          `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #333; padding: 2px 0;"><span style="color: #666;">${key}</span><span style="font-weight: 500;">${value}</span></div>`
        ).join('')
      : ''
    return `
    <div class="no-break" style="margin-bottom: 12px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px;">
      <div style="font-size: 9px; font-weight: 600; color: #166534; text-transform: uppercase; margin-bottom: 6px;">Payment Instructions</div>
      <div style="font-size: 10px; color: #333; margin-bottom: 4px;"><strong>${displayName}</strong></div>
      ${instructionRows}
      <div style="margin-top: 6px; font-size: 9px; color: #666; border-top: 1px solid #dcfce7; padding-top: 4px;">Reference: <strong>${invoice.invoice_number}</strong></div>
    </div>`
  })()

  // Footer
  const footerHtml = `
    <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #888; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        ${showQr && verificationUrl && qrCodeHtml ? `<div style="display: flex; align-items: center; gap: 6px;">${qrCodeHtml}<span style="font-size: 7px; max-width: 80px;">Scan to verify invoice authenticity</span></div>` : ''}
      </div>
      <div style="text-align: right;">
        ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}<br>
        ${verificationLine}${verificationLine && hashLine ? ' • ' : ''}${hashLine}
      </div>
    </div>
    ${showWatermark ? `<div class="footer-branding">Generated with <a href="https://invoicemonk.com">Invoicemonk</a> – Smart invoicing for modern businesses</div>` : ''}
  `

  // Generate template-specific body HTML
  let bodyHtml = ''

  if (tplHeaderStyle === 'minimal') {
    bodyHtml = `
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 16px;">
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #4b5563;">INVOICE</div>
            <div style="font-size: 11px; color: #9ca3af;">${invoice.invoice_number}</div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #6b7280;">
            <div>Issued: ${formatDate(invoice.issue_date as string)}</div>
            ${invoice.due_date ? `<div>Due: ${formatDate(invoice.due_date as string)}</div>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 24px; margin-bottom: 16px;">
          <div style="flex: 1;">
            <div style="font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px;">From</div>
            <div style="font-size: 12px; font-weight: 600;">${issuerName}</div>
            ${issuerEmail ? `<div style="font-size: 10px; color: #666;">${issuerEmail}</div>` : ''}
          </div>
          <div style="flex: 1;">
            <div style="font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 4px;">To</div>
            <div style="font-size: 12px; font-weight: 600;">${recipientName}</div>
            ${recipientEmail ? `<div style="font-size: 10px; color: #666;">${recipientEmail}</div>` : ''}
          </div>
        </div>
        ${itemsTableHtml}
        ${totalsHtml}
        ${paymentMethodHtml}
        <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #aaa; text-align: right;">
          ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}
        </div>
        ${showWatermark ? `<div class="footer-branding">Generated with <a href="https://invoicemonk.com">Invoicemonk</a></div>` : ''}
      </div>
    `
  } else if (tplHeaderStyle === 'modern') {
    bodyHtml = `
      <div class="container">
        <div style="background: ${tplPrimaryColor}; color: white; padding: 20px 24px; margin: -12mm -15mm 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${showLogo && issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 40px; max-width: 80px; object-fit: contain; background: rgba(255,255,255,0.9); border-radius: 4px; padding: 4px;" />` : ''}
              <div>
                <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">INVOICE</div>
                <div style="font-size: 11px; opacity: 0.8;">${invoice.invoice_number}</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 10px; opacity: 0.9;">
              <div>Issue: ${formatDate(invoice.issue_date as string)}</div>
              ${invoice.due_date ? `<div>Due: ${formatDate(invoice.due_date as string)}</div>` : ''}
              <div style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; margin-top: 4px; background: rgba(255,255,255,0.2);">${(invoice.status as string).toUpperCase()}</div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;">
            <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; margin-bottom: 4px;">From</div>
            <div style="font-size: 12px; font-weight: 600;">${issuerName}</div>
            ${issuerAddress ? `<div style="font-size: 10px; color: #666;">${issuerAddress}</div>` : ''}
            ${issuerTaxId ? `<div style="font-size: 10px; color: #444; font-weight: 500;">TIN: ${issuerTaxId}</div>` : ''}
            ${issuerEmail ? `<div style="font-size: 10px; color: #666;">${issuerEmail}</div>` : ''}
          </div>
          <div style="flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;">
            <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; margin-bottom: 4px;">Bill To</div>
            <div style="font-size: 12px; font-weight: 600;">${recipientName}</div>
            ${recipientAddress ? `<div style="font-size: 10px; color: #666;">${recipientAddress}</div>` : ''}
            ${recipientTaxId ? `<div style="font-size: 10px; color: #444; font-weight: 500;">TIN: ${recipientTaxId}</div>` : ''}
            ${recipientEmail ? `<div style="font-size: 10px; color: #666;">${recipientEmail}</div>` : ''}
          </div>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
          ${itemsTableHtml}
        </div>
        <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
          <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;">
            ${totalsHtml}
          </div>
        </div>
        ${paymentMethodHtml}
        ${notesTermsHtml}
        ${footerHtml}
      </div>
    `
  } else if (tplHeaderStyle === 'enterprise') {
    bodyHtml = `
      <div class="container">
        <div style="text-align: center; padding: 16px 0; border-top: 2px solid ${tplPrimaryColor}; border-bottom: 2px solid ${tplPrimaryColor}; margin-bottom: 16px;">
          ${showLogo && issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 45px; max-width: 120px; object-fit: contain; margin: 0 auto 8px;" />` : ''}
          <div style="font-size: 16px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">${issuerName}</div>
          ${issuerTaxId ? `<div style="font-size: 9px; color: #666;">TIN: ${issuerTaxId}</div>` : ''}
          ${issuerVatRegNumber ? `<div style="font-size: 9px; color: #666;">VAT Reg: ${issuerVatRegNumber}</div>` : ''}
          ${issuerAddress ? `<div style="font-size: 9px; color: #666;">${issuerAddress}</div>` : ''}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid ${tplPrimaryColor}30;">
          <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Invoice No</div><div style="font-weight: 600; font-family: monospace;">${invoice.invoice_number}</div></div>
          <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Date</div><div style="font-weight: 500;">${formatDate(invoice.issue_date as string)}</div></div>
          <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Due Date</div><div style="font-weight: 500;">${formatDate(invoice.due_date as string)}</div></div>
          <div><div style="font-size: 9px; font-weight: 600; color: #666; text-transform: uppercase;">Status</div><div style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; background: ${statusStyle.bg}; color: ${statusStyle.color};">${(invoice.status as string).toUpperCase()}</div></div>
        </div>
        <div style="display: flex; gap: 24px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${tplPrimaryColor}30;">
          <div style="flex: 1;">
            <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Issuer</div>
            <div style="font-size: 12px; font-weight: 600;">${issuerName}</div>
            ${issuerAddress ? `<div style="font-size: 10px; color: #444;">${issuerAddress}</div>` : ''}
            ${issuerEmail ? `<div style="font-size: 10px; color: #444;">${issuerEmail}</div>` : ''}
            ${issuerPhone ? `<div style="font-size: 10px; color: #444;">${issuerPhone}</div>` : ''}
          </div>
          <div style="flex: 1;">
            <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Recipient</div>
            <div style="font-size: 12px; font-weight: 600;">${recipientName}</div>
            ${recipientAddress ? `<div style="font-size: 10px; color: #444;">${recipientAddress}</div>` : ''}
            ${recipientEmail ? `<div style="font-size: 10px; color: #444;">${recipientEmail}</div>` : ''}
            ${recipientTaxId ? `<div style="font-size: 10px; color: #333; font-weight: 500;">TIN: ${recipientTaxId}</div>` : ''}
          </div>
        </div>
        <div style="border: 1px solid ${tplPrimaryColor}30; border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
          ${itemsTableHtml}
        </div>
        ${totalsHtml}
        ${paymentMethodHtml}
        ${notesTermsHtml}
        <div style="border-top: 2px solid ${tplPrimaryColor}; border-bottom: 2px solid ${tplPrimaryColor}; padding: 8px 0; margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #888;">
            <div>
              ${showQr && verificationUrl && qrCodeHtml ? `<div style="display: flex; align-items: center; gap: 6px;">${qrCodeHtml}<span style="font-size: 7px; max-width: 80px;">Scan to verify</span></div>` : ''}
            </div>
            <div style="text-align: right;">
              ${verificationLine}${verificationLine && hashLine ? ' • ' : ''}${hashLine}<br>
              ${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}
            </div>
          </div>
        </div>
        ${showWatermark ? `<div class="footer-branding">Generated with <a href="https://invoicemonk.com">Invoicemonk</a> – Smart invoicing for modern businesses</div>` : ''}
      </div>
    `
  } else {
    // STANDARD (Professional) — default
    bodyHtml = `
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid ${tplPrimaryColor}; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${showLogo && issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="Logo" style="height: 40px; max-width: 100px; object-fit: contain;" />` : ''}
            <div>
              <div style="font-size: 18px; font-weight: 700; color: ${tplPrimaryColor};">${issuerName}</div>
              ${!canUseBranding ? '<div style="font-size: 9px; color: #666; margin-top: 2px;">Powered by Invoicemonk</div>' : ''}
              ${issuerAddress ? `<div style="font-size: 9px; color: #666; margin-top: 2px;">${issuerAddress}</div>` : ''}
              ${issuerTaxId ? `<div style="font-size: 9px; color: #444; margin-top: 2px; font-weight: 500;">TIN: ${issuerTaxId}</div>` : ''}
              ${issuerVatRegNumber ? `<div style="font-size: 9px; color: #444; font-weight: 500;">VAT Reg: ${issuerVatRegNumber}</div>` : ''}
              ${issuerIsVatRegistered ? `<div style="margin-top: 4px;"><span style="background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: 600;">VAT INVOICE</span></div>` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #1a1a1a;">INVOICE</div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">${invoice.invoice_number}</div>
            <div style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; margin-top: 4px; background: ${statusStyle.bg}; color: ${statusStyle.color};">${(invoice.status as string).toUpperCase()}</div>
          </div>
        </div>
        <div style="display: flex; gap: 24px; margin-bottom: 16px;">
          <div style="flex: 1;">
            <div style="font-size: 9px; font-weight: 600; color: ${tplPrimaryColor === '#1a1a1a' ? '#666' : tplPrimaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bill To</div>
            <div style="font-size: 13px; font-weight: 600; color: #1a1a1a;">${recipientName}</div>
            <div style="font-size: 10px; color: #444; line-height: 1.4;">
              ${recipientAddress ? `${recipientAddress}<br>` : ''}
              ${recipientEmail ? `${recipientEmail}` : ''}
            </div>
            ${recipientTaxId ? `<div style="font-size: 10px; color: #333; font-weight: 500; margin-top: 4px;">TIN: ${recipientTaxId}</div>` : ''}
            ${recipientCacNumber ? `<div style="font-size: 10px; color: #333; font-weight: 500;">CAC: ${recipientCacNumber}</div>` : ''}
          </div>
          <div style="flex: 1;">
            <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Invoice Date</span><span>${formatDate(invoice.issue_date as string)}</span></div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Due Date</span><span>${formatDate(invoice.due_date as string)}</span></div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #444; padding: 2px 0;"><span>Currency</span><span>${currency}</span></div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #1a1a1a; padding-top: 6px; margin-top: 4px; border-top: 1px solid #e5e7eb;"><span>Amount Due</span><span>${formatCurrency(balanceDue, currency)}</span></div>
            </div>
          </div>
        </div>
        ${itemsTableHtml}
        ${totalsHtml}
        ${notesTermsHtml}
        ${paymentMethodHtml}
        ${footerHtml}
      </div>
    `
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>${sharedCss}</style>
</head>
<body>
  ${watermarkHtml}
  ${bodyHtml}
</body>
</html>`
}

// Helper: fetch an image URL and return a base64 data URI, or null on failure
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = new Uint8Array(await resp.arrayBuffer())
    const contentType = resp.headers.get('content-type') || 'image/png'
    let binary = ''
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
    return `data:${contentType};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

// Generate PDF using pdfmake (structured document definitions, works in Deno)
async function generateInvoicePdfBase64(
  invoice: Record<string, unknown>,
  items: InvoiceItem[],
  issuerSnapshot: IssuerSnapshot | null,
  recipientSnapshot: RecipientSnapshot | null,
  verificationUrl: string | null,
  showWatermark: boolean,
  paymentMethodSnapshot: Record<string, unknown> | null,
  templateSnapshot: TemplateSnapshot | null = null
): Promise<string> {
  // Dynamic imports for pdfmake using esm.sh with ?bundle=false to avoid bundle timeout
  // deno-lint-ignore no-explicit-any
  const pdfMakeModule: any = await import('https://esm.sh/pdfmake@0.2.13/build/pdfmake.js?bundle=false')
  // deno-lint-ignore no-explicit-any
  const pdfFontsModule: any = await import('https://esm.sh/pdfmake@0.2.13/build/vfs_fonts.js?bundle=false')
  const pdfMake = pdfMakeModule.default || pdfMakeModule
  const vfsData = pdfFontsModule?.pdfMake?.vfs || pdfFontsModule?.default?.pdfMake?.vfs
  if (vfsData) pdfMake.vfs = vfsData

  const currency = invoice.currency as string
  const balanceDue = (invoice.total_amount as number) - ((invoice.amount_paid as number) || 0)
  const issuerName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Business'
  const recipientName = recipientSnapshot?.name || 'Client'
  const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
  const issuerEmail = issuerSnapshot?.contact_email || ''
  const issuerTaxId = issuerSnapshot?.tax_id || ''
  const issuerVatReg = issuerSnapshot?.vat_registration_number || ''
  const recipientEmail = recipientSnapshot?.email || ''
  const recipientAddress = formatAddressCompact(recipientSnapshot?.address)
  const recipientTaxId = recipientSnapshot?.tax_id || ''

  const statusColors: Record<string, string> = {
    'issued': '#1d4ed8', 'sent': '#4338ca', 'viewed': '#d97706',
    'paid': '#059669', 'voided': '#dc2626', 'credited': '#db2777'
  }
  const statusBgColors: Record<string, string> = {
    'issued': '#dbeafe', 'sent': '#e0e7ff', 'viewed': '#fef3c7',
    'paid': '#d1fae5', 'voided': '#fee2e2', 'credited': '#fce7f3'
  }
  const status = invoice.status as string

  // --- Fetch logo as base64 ---
  let logoDataUri: string | null = null
  const logoUrl = issuerSnapshot?.logo_url || null
  if (logoUrl) {
    logoDataUri = await fetchImageAsBase64(logoUrl)
  }

  // --- Fetch QR code as base64 ---
  let qrDataUri: string | null = null
  if (verificationUrl) {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verificationUrl)}&format=png`
    qrDataUri = await fetchImageAsBase64(qrApiUrl)
  }

  // Template layout and styles
  const tplLayout = templateSnapshot?.layout || {}
  const tplStyles = templateSnapshot?.styles || {}
  const tplPrimaryColor = tplStyles.primary_color || '#1a1a1a'
  const tplHeaderStyle = tplLayout.header_style || 'standard'
  const showLogo = tplLayout.show_logo !== false
  const showTerms = tplLayout.show_terms !== false
  const showNotes = tplLayout.show_notes !== false
  const showQr = tplLayout.show_verification_qr !== false

  // === BUILD CONTENT ARRAY ===
  const content: unknown[] = []

  // --- 1. HEADER ---
  if (tplHeaderStyle === 'minimal') {
    // MINIMAL: Simple header, no logo
    content.push({
      columns: [
        { stack: [
          { text: 'INVOICE', fontSize: 16, bold: true, color: '#4b5563' },
          { text: invoice.invoice_number as string, fontSize: 10, color: '#9ca3af', margin: [0, 1, 0, 0] }
        ], width: '*' },
        { stack: [
          { text: `Issued: ${formatDate(invoice.issue_date as string)}`, fontSize: 9, color: '#6b7280', alignment: 'right' },
          { text: `Due: ${formatDate(invoice.due_date as string)}`, fontSize: 9, color: '#6b7280', alignment: 'right' }
        ], width: 'auto' }
      ],
      margin: [0, 0, 0, 8]
    })
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 0, 0, 10] })
  } else if (tplHeaderStyle === 'modern') {
    // MODERN: Brand-colored header bar
    content.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              columns: [
                { stack: [
                  ...(showLogo && logoDataUri ? [{ image: logoDataUri, width: 80, fit: [80, 35], margin: [0, 0, 8, 0] }] : []),
                  { text: 'INVOICE', fontSize: 20, bold: true, color: '#ffffff' },
                  { text: invoice.invoice_number as string, fontSize: 10, color: '#ffffffcc', margin: [0, 1, 0, 0] }
                ], width: '*' },
                { stack: [
                  { text: `Issue: ${formatDate(invoice.issue_date as string)}`, fontSize: 9, color: '#ffffffdd', alignment: 'right' },
                  { text: `Due: ${formatDate(invoice.due_date as string)}`, fontSize: 9, color: '#ffffffdd', alignment: 'right' },
                  { text: status.toUpperCase(), fontSize: 7, bold: true, color: '#ffffff', alignment: 'right', margin: [0, 3, 0, 0] }
                ], width: 'auto' }
              ]
            }
          ],
          fillColor: tplPrimaryColor,
          margin: [12, 10, 12, 10]
        }]]
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
      margin: [0, 0, 0, 12]
    })
  } else if (tplHeaderStyle === 'enterprise') {
    // ENTERPRISE: Centered letterhead with double-border
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: tplPrimaryColor }], margin: [0, 0, 0, 8] })
    const letterheadStack: unknown[] = []
    if (showLogo && logoDataUri) {
      letterheadStack.push({ image: logoDataUri, width: 100, fit: [100, 40], alignment: 'center', margin: [0, 0, 0, 4] })
    }
    letterheadStack.push({ text: issuerName, fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 2] })
    if (issuerTaxId) letterheadStack.push({ text: `TIN: ${issuerTaxId}`, fontSize: 8, color: '#666666', alignment: 'center' })
    if (issuerVatReg) letterheadStack.push({ text: `VAT: ${issuerVatReg}`, fontSize: 8, color: '#666666', alignment: 'center' })
    if (issuerAddress) letterheadStack.push({ text: issuerAddress, fontSize: 8, color: '#666666', alignment: 'center' })
    content.push({ stack: letterheadStack, margin: [0, 0, 0, 8] })
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: tplPrimaryColor }], margin: [0, 0, 0, 10] })

    // Metadata grid
    content.push({
      columns: [
        { stack: [{ text: 'INVOICE NO', fontSize: 7, bold: true, color: '#999999' }, { text: invoice.invoice_number as string, fontSize: 9, bold: true }], width: '*' },
        { stack: [{ text: 'DATE', fontSize: 7, bold: true, color: '#999999' }, { text: formatDate(invoice.issue_date as string), fontSize: 9 }], width: '*' },
        { stack: [{ text: 'DUE DATE', fontSize: 7, bold: true, color: '#999999' }, { text: formatDate(invoice.due_date as string), fontSize: 9 }], width: '*' },
        {
          stack: [
            { text: 'STATUS', fontSize: 7, bold: true, color: '#999999' },
            {
              table: { widths: ['auto'], body: [[{ text: status.toUpperCase(), fontSize: 7, bold: true, color: statusColors[status] || '#1d4ed8', fillColor: statusBgColors[status] || '#dbeafe', margin: [4, 1, 4, 1] }]] },
              layout: 'noBorders'
            }
          ], width: '*'
        }
      ],
      margin: [0, 0, 0, 10]
    })
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 0, 0, 10] })
  } else {
    // STANDARD: Default professional layout
    const leftHeaderStack: unknown[] = []
    if (showLogo && logoDataUri) {
      leftHeaderStack.push({ image: logoDataUri, width: 120, fit: [120, 45], margin: [0, 0, 0, 4] })
    } else {
      leftHeaderStack.push({ text: issuerName, style: 'businessName', margin: [0, 0, 0, 2] })
    }

  const metaLine = `${formatDate(invoice.issue_date as string)}  •  Due: ${formatDate(invoice.due_date as string)}  •  ${currency}`
  const rightHeaderStack: unknown[] = [
    { text: 'INVOICE', style: 'headerTitle', alignment: 'right' },
    { text: invoice.invoice_number as string, fontSize: 10, color: '#666666', alignment: 'right', margin: [0, 1, 0, 3] },
    {
      table: {
        widths: ['auto'],
        body: [[{ text: status.toUpperCase(), fontSize: 7, bold: true, color: statusColors[status] || '#1d4ed8', fillColor: statusBgColors[status] || '#dbeafe', margin: [5, 1, 5, 1] }]]
      },
      layout: 'noBorders',
      alignment: 'right',
      margin: [0, 0, 0, 3]
    },
    { text: metaLine, fontSize: 8, color: '#666666', alignment: 'right' },
  ]

  content.push({
    columns: [
      { stack: leftHeaderStack, width: '*' },
      { stack: rightHeaderStack, width: 'auto' }
    ],
    margin: [0, 0, 0, 8]
  })

  // Separator line (1px)
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1, lineColor: '#d1d5db' }], margin: [0, 0, 0, 10] })

  // --- 2. BILLING SECTION (two-column: FROM + BILL TO) ---
  const fromStack: unknown[] = [
    { text: 'FROM', fontSize: 8, bold: true, color: '#999999', margin: [0, 0, 0, 3] },
    { text: issuerName, fontSize: 9, bold: true, margin: [0, 0, 0, 1] },
  ]
  if (issuerAddress) fromStack.push({ text: issuerAddress, fontSize: 9, color: '#444444', margin: [0, 0, 0, 1] })
  if (issuerTaxId) fromStack.push({ text: `TIN: ${issuerTaxId}`, fontSize: 9, color: '#444444', margin: [0, 0, 0, 1] })
  if (issuerVatReg) fromStack.push({ text: `VAT: ${issuerVatReg}`, fontSize: 9, color: '#444444', margin: [0, 0, 0, 1] })
  if (issuerSnapshot?.is_vat_registered) {
    fromStack.push({ text: 'VAT INVOICE', fontSize: 7, bold: true, color: '#1d4ed8', margin: [0, 2, 0, 0] })
  }

  const toStack: unknown[] = [
    { text: 'BILL TO', fontSize: 8, bold: true, color: '#999999', margin: [0, 0, 0, 3] },
    { text: recipientName, fontSize: 9, bold: true, margin: [0, 0, 0, 1] },
  ]
  if (recipientEmail) toStack.push({ text: recipientEmail, fontSize: 9, color: '#444444', margin: [0, 0, 0, 1] })
  if (recipientAddress) toStack.push({ text: recipientAddress, fontSize: 9, color: '#444444', margin: [0, 0, 0, 1] })
  if (recipientTaxId) toStack.push({ text: `TIN: ${recipientTaxId}`, fontSize: 9, color: '#444444', margin: [0, 0, 0, 1] })

  content.push({
    columns: [
      { stack: fromStack, width: '50%' },
      { stack: toStack, width: '50%' }
    ],
    margin: [0, 0, 0, 10]
  })

  // --- 3. LINE ITEMS TABLE (compact padding) ---
  const hasVat = issuerSnapshot?.is_vat_registered || false
  const tableHeaders = hasVat
    ? ['Description', 'Qty', 'Rate', 'VAT', 'Amount']
    : ['Description', 'Qty', 'Rate', 'Amount']
  const tableWidths = hasVat
    ? ['*', 35, 65, 55, 70]
    : ['*', 45, 75, 75]

  const headerRow = tableHeaders.map((h, i) => ({
    text: h,
    style: 'tableHeader',
    alignment: i > 0 ? 'right' as const : 'left' as const,
    margin: [3, 4, 3, 4]
  }))

  const itemRows = items.map(item => {
    const base = [
      { text: item.description || '', fontSize: 9, margin: [3, 3, 3, 3] },
      { text: String(item.quantity), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] },
      { text: formatCurrencyPdf(item.unit_price, currency), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] },
    ]
    if (hasVat) {
      base.push({ text: formatCurrencyPdf(item.tax_amount, currency), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] })
    }
    base.push({ text: formatCurrencyPdf(item.amount, currency), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] })
    return base
  })

  content.push({
    table: {
      headerRows: 1,
      widths: tableWidths,
      body: [headerRow, ...itemRows]
    },
    layout: {
      hLineWidth: (i: number, _node: unknown) => i === 0 || i === 1 ? 1 : 0.5,
      vLineWidth: () => 0,
      hLineColor: (i: number, _node: unknown) => i <= 1 ? '#d1d5db' : '#f0f0f0',
      fillColor: (rowIndex: number) => rowIndex === 0 ? '#f5f5f5' : null,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 10]
  })

  // --- 4. TOTALS SECTION (single block, right-aligned) ---
  const totalsBody: unknown[][] = [
    [{ text: 'Subtotal', fontSize: 9, color: '#666666', margin: [3, 2, 3, 2] }, { text: formatCurrencyPdf(invoice.subtotal as number, currency), fontSize: 9, alignment: 'right', margin: [3, 2, 3, 2] }],
  ]
  if ((invoice.tax_amount as number) > 0) {
    totalsBody.push([
      { text: 'Tax', fontSize: 9, color: '#666666', margin: [3, 2, 3, 2] },
      { text: formatCurrencyPdf(invoice.tax_amount as number, currency), fontSize: 9, alignment: 'right', margin: [3, 2, 3, 2] }
    ])
  }
  if ((invoice.discount_amount as number) > 0) {
    totalsBody.push([
      { text: 'Discount', fontSize: 9, color: '#666666', margin: [3, 2, 3, 2] },
      { text: `-${formatCurrencyPdf(invoice.discount_amount as number, currency)}`, fontSize: 9, alignment: 'right', margin: [3, 2, 3, 2] }
    ])
  }
  // Grand Total row
  totalsBody.push([
    { text: 'Grand Total', fontSize: 11, bold: true, margin: [3, 3, 3, 3] },
    { text: formatCurrencyPdf(invoice.total_amount as number, currency), fontSize: 11, bold: true, alignment: 'right', margin: [3, 3, 3, 3] }
  ])
  // Amount Paid (if > 0)
  if ((invoice.amount_paid as number) > 0) {
    totalsBody.push([
      { text: 'Paid', fontSize: 9, color: '#059669', margin: [3, 2, 3, 2] },
      { text: `-${formatCurrencyPdf(invoice.amount_paid as number, currency)}`, fontSize: 9, color: '#059669', alignment: 'right', margin: [3, 2, 3, 2] }
    ])
  }
  // Total Due (only if balance > 0)
  if (balanceDue > 0) {
    totalsBody.push([
      { text: 'Total Due', fontSize: 11, bold: true, fillColor: '#fef3c7', margin: [3, 3, 3, 3] },
      { text: formatCurrencyPdf(balanceDue, currency), fontSize: 11, bold: true, alignment: 'right', fillColor: '#fef3c7', margin: [3, 3, 3, 3] }
    ])
  }

  // Determine where to draw the heavy separator (before Grand Total)
  const grandTotalIndex = totalsBody.length - (balanceDue > 0 ? ((invoice.amount_paid as number) > 0 ? 3 : 2) : 1)

  content.push({
    columns: [
      { text: '', width: '*' },
      {
        table: {
          widths: [90, 90],
          body: totalsBody
        },
        layout: {
          hLineWidth: (i: number) => i === grandTotalIndex ? 2 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#1a1a1a',
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        width: 'auto'
      }
    ],
    margin: [0, 0, 0, 10]
  })

  // --- 5. PAYMENT INSTRUCTIONS (compact inline) ---
  if (paymentMethodSnapshot) {
    const displayName = (paymentMethodSnapshot.display_name as string) || 'Payment Method'
    const instructions = paymentMethodSnapshot.instructions as Record<string, string> | null

    const pmLines: unknown[] = [
      { text: 'PAYMENT INSTRUCTIONS', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] },
      { text: displayName, fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
    ]

    if (instructions) {
      const parts = Object.entries(instructions).map(([_k, v]) => String(v))
      if (parts.length > 0) {
        pmLines.push({ text: parts.join('  |  '), fontSize: 9, color: '#444444', margin: [0, 0, 0, 2] })
      }
    }
    pmLines.push({ text: `Reference: ${invoice.invoice_number}`, fontSize: 8, color: '#666666', margin: [0, 0, 0, 8] })

    content.push({ stack: pmLines })
  }

  // --- 6. NOTES & TERMS (minimal spacing) ---
  if (invoice.notes) {
    content.push({ text: 'NOTES', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] })
    content.push({ text: invoice.notes as string, fontSize: 9, color: '#444444', margin: [0, 0, 0, 6] })
  }
  if (invoice.terms) {
    content.push({ text: 'TERMS', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] })
    content.push({ text: invoice.terms as string, fontSize: 9, color: '#444444', margin: [0, 0, 0, 6] })
  }

  // --- 7. QR CODE + FOOTER (combined row) ---
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 8, 0, 6] })

  const vLine = invoice.verification_id ? `Verification: ${(invoice.verification_id as string).substring(0, 8)}...` : ''
  const hLine = invoice.invoice_hash ? `Hash: ${(invoice.invoice_hash as string).substring(0, 12)}...` : ''
  const footerLines = [`${issuerName}${issuerEmail ? ` • ${issuerEmail}` : ''}`]
  const verifyLine = [vLine, hLine].filter(Boolean).join(' • ')
  if (verifyLine) footerLines.push(verifyLine)

  const footerLeft: unknown[] = footerLines.map(l => ({ text: l, fontSize: 8, color: '#888888' }))

  if (qrDataUri) {
    content.push({
      columns: [
        { stack: footerLeft, width: '*' },
        {
          stack: [
            { image: qrDataUri, width: 60, alignment: 'right' },
            { text: 'Scan to verify', fontSize: 7, color: '#999999', alignment: 'right', margin: [0, 1, 0, 0] }
          ],
          width: 'auto'
        }
      ]
    })
  } else {
    footerLeft.forEach(l => content.push(l))
  }

  // === DOCUMENT DEFINITION ===
  const docDefinition = {
    pageSize: 'A4' as const,
    pageMargins: [36, 40, 36, 40] as [number, number, number, number],
    content,
    styles: {
      headerTitle: { fontSize: 18, bold: true },
      businessName: { fontSize: 14, bold: true },
      sectionTitle: { fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] },
      tableHeader: { fontSize: 9, bold: true, fillColor: '#f5f5f5' },
      smallText: { fontSize: 8, color: '#666666' },
    },
    defaultStyle: {
      fontSize: 9,
    },
    watermark: showWatermark ? { text: 'INVOICEMONK', opacity: 0.04, angle: -45, fontSize: 60 } : undefined,
  }

  // Generate PDF and return base64
  return new Promise<string>((resolve, reject) => {
    try {
      // deno-lint-ignore no-explicit-any
      const pdfDocGenerator = pdfMake.createPdf(docDefinition as any)
      pdfDocGenerator.getBase64((base64: string) => {
        resolve(base64)
      })
    } catch (err) {
      reject(err)
    }
  })
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Parse request body
    const body: SendInvoiceRequest = await req.json()
    
    // Validate inputs
    const invoiceIdError = validateUUID(body.invoice_id, 'invoice_id');
    if (invoiceIdError) {
      return new Response(
        JSON.stringify({ success: false, error: invoiceIdError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailError = validateEmail(body.recipient_email, 'recipient_email');
    if (emailError) {
      return new Response(
        JSON.stringify({ success: false, error: emailError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and sanitize custom_message if provided
    const customMessageError = validateString(body.custom_message, 'custom_message', 2000);
    if (customMessageError) {
      return new Response(
        JSON.stringify({ success: false, error: customMessageError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const sanitizedCustomMessage = body.custom_message ? sanitizeString(body.custom_message) : null;

    // Get Brevo API key
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email sending is not configured. Please configure BREVO_API_KEY.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoice with items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`*, clients (*), invoice_items (*)`)
      .eq('id', body.invoice_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invoice not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only issued invoices can be sent
    if (invoice.status === 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot send draft invoices. Please issue the invoice first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse snapshots
    const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null
    const templateSnapshot = invoice.template_snapshot as TemplateSnapshot | null
    const items = (invoice.invoice_items || []) as InvoiceItem[]
    
    const businessName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk'
    const clientName = recipientSnapshot?.name || invoice.clients?.name || 'Valued Customer'
    const invoiceSummary = invoice.summary as string | null

    // Format issuer address for email
    const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    // ALWAYS show logo if available (regardless of branding tier)
    let issuerLogoUrl = issuerSnapshot?.logo_url || null

    // Defensive fallback: If no logo in snapshot, try to fetch from business table
    if (!issuerLogoUrl && invoice.business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('logo_url')
        .eq('id', invoice.business_id)
        .single()
      issuerLogoUrl = business?.logo_url || null
      if (issuerLogoUrl) {
        console.log('Logo fetched from business table as fallback')
      }
    }

    // Get user's subscription tier for watermark/branding logic
    const { data: tierResult, error: tierError } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'remove_watermark'
    })

    if (tierError) {
      console.error('Tier check error:', tierError)
    }

    const tierData = typeof tierResult === 'object' && tierResult !== null ? tierResult : { allowed: false, tier: 'starter' }
    const canRemoveWatermark = tierData.allowed === true

    // Check branding permission
    const { data: brandingResult } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'custom_branding'
    })
    const brandingData = typeof brandingResult === 'object' && brandingResult !== null ? brandingResult : { allowed: false }
    const canUseBranding = brandingData.allowed === true && templateSnapshot?.supports_branding !== false

    // Determine watermark
    const templateRequiresWatermark = templateSnapshot?.watermark_required !== false
    const showWatermark = templateRequiresWatermark && !canRemoveWatermark

    // URLs - prefer client-provided app_url, then env, then fallback
    // Prevent Lovable preview URLs from being used in emails
    let appUrl = body.app_url || Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    if (appUrl.includes('lovableproject.com') || appUrl.includes('lovable.app')) {
      console.warn('Lovable preview URL detected in app_url, using production fallback')
      appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    }
    
    // Separate URLs for viewing invoice vs verifying authenticity
    const viewInvoiceUrl = invoice.verification_id 
      ? `${appUrl}/invoice/view/${invoice.verification_id}`
      : null
    const verificationUrl = invoice.verification_id 
      ? `${appUrl}/verify/invoice/${invoice.verification_id}`
      : null
    
    // QR code for email body
    const qrCodeUrl = verificationUrl 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=png`
      : null

    // Generate professional HTML (matching generate-pdf output)
    console.log('Generating professional HTML invoice attachment...')
    const paymentMethodSnapshot = invoice.payment_method_snapshot
      ? (typeof invoice.payment_method_snapshot === 'string'
          ? JSON.parse(invoice.payment_method_snapshot)
          : invoice.payment_method_snapshot) as Record<string, unknown>
      : null;

    const professionalHtml = generateProfessionalHtml(
      invoice,
      items,
      issuerSnapshot,
      recipientSnapshot,
      verificationUrl,
      showWatermark,
      canUseBranding,
      issuerLogoUrl,
      paymentMethodSnapshot,
      templateSnapshot
    )
    
    // Generate PDF using pdf-lib (pure JS, free, no external API)
    console.log('Generating PDF attachment using pdfmake...')
    const attachmentContent = await generateInvoicePdfBase64(
      invoice,
      items,
      issuerSnapshot,
      recipientSnapshot,
      verificationUrl,
      showWatermark,
      paymentMethodSnapshot,
      templateSnapshot
    )
    const attachmentName = `Invoice-${invoice.invoice_number}.pdf`
    console.log(`PDF attachment generated: ${attachmentName}`)

    // Build enhanced email HTML with branded header and clean footer
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Branded Header - Logo + Business Name Only -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); padding: 24px 32px;">
          <tr>
            <td style="text-align: center;">
              ${issuerLogoUrl ? `
              <img src="${issuerLogoUrl}" alt="${businessName}" style="height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 12px;" />
              <br>
              ` : ''}
              <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${businessName}</span>
            </td>
          </tr>
        </table>

        <!-- Main Content -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">Dear ${clientName},</p>
              
              ${body.custom_message ? `<p style="margin: 0 0 16px; color: #374151; font-size: 16px;">${body.custom_message}</p>` : ''}
              
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                Please find below the details for invoice <strong>${invoice.invoice_number}</strong>.
              </p>

              ${invoiceSummary ? `<p style="margin: 0 0 24px; color: #6b7280; font-style: italic; font-size: 15px; padding-left: 16px; border-left: 3px solid #e5e7eb;">${invoiceSummary}</p>` : ''}

              <!-- Invoice Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Invoice Number:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <strong style="color: #1f2937; font-size: 14px;">${invoice.invoice_number}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Issue Date:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.issue_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Due Date:</span>
                        </td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.due_date)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0; border-top: 1px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 16px;">Total Amount:</strong>
                        </td>
                        <td style="text-align: right; padding: 12px 0 0; border-top: 1px solid #e5e7eb;">
                          <strong style="color: #1f2937; font-size: 18px;">${formatCurrency(invoice.total_amount, invoice.currency)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${viewInvoiceUrl ? `
              <!-- Primary CTA: View Invoice Online -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="text-align: center; padding: 8px 0;">
                    <a href="${viewInvoiceUrl}"
                       style="display: inline-block; 
                              background-color: #1a1a1a; 
                              color: #ffffff; 
                              padding: 16px 32px; 
                              border-radius: 8px; 
                              text-decoration: none; 
                              font-weight: 600; 
                              font-size: 16px;
                              box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      View Invoice Online →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 8px;">
                    <span style="color: #6b7280; font-size: 12px;">
                      View full invoice details, line items, and download options
                    </span>
                  </td>
                </tr>
              </table>

              ` : ''}

              ${verificationUrl ? `
              <!-- Verification Section with QR Code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">
                            🔒 Verify Invoice Authenticity
                          </p>
                          <p style="margin: 0 0 12px; color: #374151; font-size: 14px;">
                            Scan the QR code or click the button to verify this invoice is genuine.
                          </p>
                          <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                            Verify Invoice
                          </a>
                          <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">
                            Verification ID: ${invoice.verification_id}
                          </p>
                        </td>
                        ${qrCodeUrl ? `
                        <td style="width: 120px; text-align: right; vertical-align: top;">
                          <img src="${qrCodeUrl}" alt="QR Code" style="width: 100px; height: 100px; border-radius: 4px;" />
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 10px; text-align: center;">Scan to verify</p>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Invoice Attachment Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #166534; font-size: 14px;">
                      📎 <strong>Invoice Attached:</strong> Please find your professional invoice PDF attached to this email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #374151; font-size: 16px;">
                If you have any questions, please don't hesitate to contact us.
              </p>
              
              <p style="margin: 16px 0 0; color: #374151; font-size: 16px;">
                Best regards,<br>
                <strong>${businessName}</strong>
              </p>
            </td>
          </tr>
        </table>

        <!-- Business Contact Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">${businessName}</p>
              ${issuerPhone ? `<p style="margin: 8px 0 0; font-size: 14px; color: #374151;">📞 ${issuerPhone}</p>` : ''}
              ${issuerEmail ? `<p style="margin: 4px 0 0; font-size: 14px; color: #374151;">✉️ ${issuerEmail}</p>` : ''}
              ${issuerAddress ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">📍 ${issuerAddress}</p>` : ''}
            </td>
          </tr>
        </table>

        <!-- Platform Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 16px 32px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.7);">
                Powered by Invoicemonk • © ${new Date().getFullYear()} Invoicemonk LTD
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`

    // Send email via Brevo API with HTML attachment
    console.log('Sending email via Brevo API to:', body.recipient_email)

    try {
      const brevoPayload: Record<string, unknown> = {
        sender: {
          name: businessName,
          email: smtpFrom,
        },
        to: [
          {
            email: body.recipient_email,
            name: clientName,
          },
        ],
        subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
        htmlContent: emailHtml,
        attachment: [
          {
            content: attachmentContent,
            name: attachmentName,
          },
        ],
      }

      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(brevoPayload),
      })

      if (!brevoResponse.ok) {
        const errorData = await brevoResponse.json()
        console.error('Brevo API error:', errorData)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to send email: ${errorData.message || 'Brevo API error'}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const brevoResult = await brevoResponse.json()
      console.log('Email sent successfully via Brevo:', brevoResult)
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice status to 'sent' if currently 'issued'
    if (invoice.status === 'issued') {
      await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', body.invoice_id)
    }

    // Log audit event and create notification using service role
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      
      // Log audit event
      await adminClient.rpc('log_audit_event', {
        _event_type: 'INVOICE_SENT',
        _entity_type: 'invoice',
        _entity_id: body.invoice_id,
        _user_id: userId,
        _business_id: invoice.business_id,
        _metadata: {
          recipient_email: body.recipient_email,
          sent_at: new Date().toISOString(),
          verification_url: verificationUrl,
          attachment_type: 'pdf',
          watermark_shown: showWatermark,
          branding_used: canUseBranding
        }
      })

      // Create INVOICE_SENT notification
      await adminClient.from('notifications').insert({
        user_id: userId,
        business_id: invoice.business_id,
        type: 'INVOICE_SENT',
        title: 'Invoice Sent',
        message: `Invoice ${invoice.invoice_number} was sent to ${body.recipient_email}`,
        entity_type: 'invoice',
        entity_id: invoice.id,
        is_read: false,
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice sent successfully with PDF attachment',
        recipient: body.recipient_email,
        attachment_type: 'pdf'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send invoice error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
