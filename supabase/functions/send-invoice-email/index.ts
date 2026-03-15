import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateUUIDStr as validateUUID, validateEmailStr as validateEmail, validateStringStr as validateString, sanitizeString, getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'

interface SendInvoiceRequest {
  invoice_id: string
  recipient_email: string
  custom_message?: string
  app_url?: string
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

// Helper: Format currency with proper locale (for HTML emails)
const formatCurrency = (amount: number, currency: string): string => {
  const localeMap: Record<string, string> = {
    'NGN': 'en-NG', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB',
    'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'ZAR': 'en-ZA',
    'KES': 'en-KE', 'GHS': 'en-GH', 'EGP': 'en-EG', 'AED': 'ar-AE'
  }
  const locale = localeMap[currency] || 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

// Helper: Format currency for PDF (WinAnsi-safe, uses symbols)
const currencySymbols: Record<string, string> = { NGN: '\u20A6', USD: '$', EUR: '\u20AC', GBP: '\u00A3', KES: 'KSh', GHS: 'GH\u20B5', ZAR: 'R', CAD: 'CA$', AUD: 'A$', INR: '\u20B9', JPY: '\u00A5', CNY: '\u00A5' }
const formatCurrencyPdf = (amount: number, currency: string): string => {
  const symbol = currencySymbols[currency] || currency + ' '
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${symbol}${formatted}`
}

const formatDate = (date: string | null): string => {
  if (!date) return 'Not specified'
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatAddressCompact = (address: IssuerSnapshot['address'] | RecipientSnapshot['address']): string => {
  if (!address) return ''
  const parts = [address.line1 || address.street, address.city, address.state, address.country].filter(Boolean)
  return parts.join(', ')
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

// ============================================================
// PDF GENERATION — Template-specific builders using pdfmake
// ============================================================

interface PdfBuildContext {
  invoice: Record<string, unknown>
  items: InvoiceItem[]
  issuerSnapshot: IssuerSnapshot | null
  recipientSnapshot: RecipientSnapshot | null
  verificationUrl: string | null
  showWatermark: boolean
  paymentMethodSnapshot: Record<string, unknown> | null
  templateSnapshot: TemplateSnapshot | null
  // Derived
  currency: string
  balanceDue: number
  issuerName: string
  issuerAddress: string
  issuerEmail: string
  issuerTaxId: string
  issuerVatReg: string
  recipientName: string
  recipientEmail: string
  recipientAddress: string
  recipientTaxId: string
  status: string
  hasVat: boolean
  logoDataUri: string | null
  qrDataUri: string | null
  tplPrimaryColor: string
  showLogo: boolean
  showTerms: boolean
  showNotes: boolean
  showQr: boolean
}

const statusColors: Record<string, string> = {
  'issued': '#1d4ed8', 'sent': '#4338ca', 'viewed': '#d97706',
  'paid': '#059669', 'voided': '#dc2626', 'credited': '#db2777'
}
const statusBgColors: Record<string, string> = {
  'issued': '#dbeafe', 'sent': '#e0e7ff', 'viewed': '#fef3c7',
  'paid': '#d1fae5', 'voided': '#fee2e2', 'credited': '#fce7f3'
}

// Shared: build items table rows
function buildItemRows(ctx: PdfBuildContext) {
  const tableHeaders = ctx.hasVat
    ? ['Description', 'Qty', 'Rate', 'VAT', 'Amount']
    : ['Description', 'Qty', 'Rate', 'Amount']
  const tableWidths = ctx.hasVat
    ? ['*', 35, 65, 55, 70]
    : ['*', 45, 75, 75]

  const headerRow = tableHeaders.map((h, i) => ({
    text: h, fontSize: 9, bold: true, fillColor: '#f5f5f5',
    alignment: i > 0 ? 'right' as const : 'left' as const,
    margin: [3, 4, 3, 4]
  }))

  const itemRows = ctx.items.map(item => {
    const base = [
      { text: item.description || '', fontSize: 9, margin: [3, 3, 3, 3] },
      { text: String(item.quantity), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] },
      { text: formatCurrencyPdf(item.unit_price, ctx.currency), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] },
    ]
    if (ctx.hasVat) {
      base.push({ text: formatCurrencyPdf(item.tax_amount, ctx.currency), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] })
    }
    base.push({ text: formatCurrencyPdf(item.amount, ctx.currency), fontSize: 9, alignment: 'right' as const, margin: [3, 3, 3, 3] })
    return base
  })

  return { headerRow, itemRows, tableWidths }
}

// Shared: build totals rows
function buildTotalsBody(ctx: PdfBuildContext) {
  const totalsBody: unknown[][] = [
    [{ text: 'Subtotal', fontSize: 9, color: '#666666', margin: [3, 2, 3, 2] }, { text: formatCurrencyPdf(ctx.invoice.subtotal as number, ctx.currency), fontSize: 9, alignment: 'right', margin: [3, 2, 3, 2] }],
  ]
  if ((ctx.invoice.tax_amount as number) > 0) {
    totalsBody.push([
      { text: 'Tax', fontSize: 9, color: '#666666', margin: [3, 2, 3, 2] },
      { text: formatCurrencyPdf(ctx.invoice.tax_amount as number, ctx.currency), fontSize: 9, alignment: 'right', margin: [3, 2, 3, 2] }
    ])
  }
  if ((ctx.invoice.discount_amount as number) > 0) {
    totalsBody.push([
      { text: 'Discount', fontSize: 9, color: '#666666', margin: [3, 2, 3, 2] },
      { text: `-${formatCurrencyPdf(ctx.invoice.discount_amount as number, ctx.currency)}`, fontSize: 9, alignment: 'right', margin: [3, 2, 3, 2] }
    ])
  }
  totalsBody.push([
    { text: 'Grand Total', fontSize: 11, bold: true, margin: [3, 3, 3, 3] },
    { text: formatCurrencyPdf(ctx.invoice.total_amount as number, ctx.currency), fontSize: 11, bold: true, alignment: 'right', margin: [3, 3, 3, 3] }
  ])
  if ((ctx.invoice.amount_paid as number) > 0) {
    totalsBody.push([
      { text: 'Paid', fontSize: 9, color: '#059669', margin: [3, 2, 3, 2] },
      { text: `-${formatCurrencyPdf(ctx.invoice.amount_paid as number, ctx.currency)}`, fontSize: 9, color: '#059669', alignment: 'right', margin: [3, 2, 3, 2] }
    ])
  }
  if (ctx.balanceDue > 0) {
    totalsBody.push([
      { text: 'Total Due', fontSize: 11, bold: true, fillColor: '#fef3c7', margin: [3, 3, 3, 3] },
      { text: formatCurrencyPdf(ctx.balanceDue, ctx.currency), fontSize: 11, bold: true, alignment: 'right', fillColor: '#fef3c7', margin: [3, 3, 3, 3] }
    ])
  }
  const grandTotalIndex = totalsBody.length - (ctx.balanceDue > 0 ? ((ctx.invoice.amount_paid as number) > 0 ? 3 : 2) : 1)
  return { totalsBody, grandTotalIndex }
}

// Shared: payment instructions content
function buildPaymentContent(ctx: PdfBuildContext): unknown[] {
  if (!ctx.paymentMethodSnapshot) return []
  const displayName = (ctx.paymentMethodSnapshot.display_name as string) || 'Payment Method'
  const instructions = ctx.paymentMethodSnapshot.instructions as Record<string, string> | null
  return [{ text: displayName, fontSize: 9, bold: true, margin: [0, 0, 0, 2] },
    ...(instructions ? Object.entries(instructions).map(([k, v]) => ({
      columns: [
        { text: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), fontSize: 8, color: '#666666', width: 100 },
        { text: String(v), fontSize: 9, bold: true, width: '*' }
      ], margin: [0, 1, 0, 1]
    })) : []),
    { text: `Reference: ${ctx.invoice.invoice_number}`, fontSize: 8, color: '#666666', margin: [0, 3, 0, 0] }
  ]
}

// Shared: QR + footer row
function buildFooterContent(ctx: PdfBuildContext): unknown[] {
  const content: unknown[] = []
  const vLine = ctx.invoice.verification_id ? `Verification: ${(ctx.invoice.verification_id as string).substring(0, 8)}...` : ''
  const hLine = ctx.invoice.invoice_hash ? `Hash: ${(ctx.invoice.invoice_hash as string).substring(0, 12)}...` : ''
  const footerLines = [`${ctx.issuerName}${ctx.issuerEmail ? ` - ${ctx.issuerEmail}` : ''}`]
  const verifyLine = [vLine, hLine].filter(Boolean).join(' | ')
  if (verifyLine) footerLines.push(verifyLine)

  const footerLeft: unknown[] = footerLines.map(l => ({ text: l, fontSize: 8, color: '#888888' }))

  if (ctx.showQr && ctx.qrDataUri) {
    content.push({
      columns: [
        { stack: footerLeft, width: '*' },
        {
          stack: [
            { image: ctx.qrDataUri, width: 60, alignment: 'right' },
            { text: 'Scan to verify', fontSize: 7, color: '#999999', alignment: 'right', margin: [0, 1, 0, 0] }
          ],
          width: 'auto'
        }
      ]
    })
  } else {
    footerLeft.forEach(l => content.push(l))
  }
  return content
}

// Shared: notes/terms content
function buildNotesTerms(ctx: PdfBuildContext): unknown[] {
  const content: unknown[] = []
  if (ctx.showNotes && ctx.invoice.notes) {
    content.push({ text: 'NOTES', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] })
    content.push({ text: ctx.invoice.notes as string, fontSize: 9, color: '#444444', margin: [0, 0, 0, 6] })
  }
  if (ctx.showTerms && ctx.invoice.terms) {
    content.push({ text: 'TERMS', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] })
    content.push({ text: ctx.invoice.terms as string, fontSize: 9, color: '#444444', margin: [0, 0, 0, 6] })
  }
  return content
}

// =================== MINIMAL (Basic) ===================
function buildMinimalPdf(ctx: PdfBuildContext): unknown[] {
  const content: unknown[] = []

  // Header: simple left title, right dates
  content.push({
    columns: [
      { stack: [
        { text: 'INVOICE', fontSize: 16, bold: true, color: '#4b5563' },
        { text: ctx.invoice.invoice_number as string, fontSize: 10, color: '#9ca3af', margin: [0, 1, 0, 0] }
      ], width: '*' },
      { stack: [
        { text: `Issued: ${formatDate(ctx.invoice.issue_date as string)}`, fontSize: 9, color: '#6b7280', alignment: 'right' },
        { text: `Due: ${formatDate(ctx.invoice.due_date as string)}`, fontSize: 9, color: '#6b7280', alignment: 'right' }
      ], width: 'auto' }
    ],
    margin: [0, 0, 0, 8]
  })
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 0, 0, 12] })

  // Plain FROM / TO
  content.push({
    columns: [
      { stack: [
        { text: 'From', fontSize: 9, bold: true, color: '#9ca3af', margin: [0, 0, 0, 3] },
        { text: ctx.issuerName, fontSize: 11, bold: true },
        ...(ctx.issuerEmail ? [{ text: ctx.issuerEmail, fontSize: 9, color: '#666666' }] : []),
        ...(ctx.issuerAddress ? [{ text: ctx.issuerAddress, fontSize: 9, color: '#666666' }] : []),
      ], width: '50%' },
      { stack: [
        { text: 'To', fontSize: 9, bold: true, color: '#9ca3af', margin: [0, 0, 0, 3] },
        { text: ctx.recipientName, fontSize: 11, bold: true },
        ...(ctx.recipientEmail ? [{ text: ctx.recipientEmail, fontSize: 9, color: '#666666' }] : []),
        ...(ctx.recipientAddress ? [{ text: ctx.recipientAddress, fontSize: 9, color: '#666666' }] : []),
      ], width: '50%' }
    ],
    margin: [0, 0, 0, 14]
  })

  // Items table - clean, no border wrapping
  const { headerRow, itemRows, tableWidths } = buildItemRows(ctx)
  content.push({
    table: { headerRows: 1, widths: tableWidths, body: [headerRow, ...itemRows] },
    layout: {
      hLineWidth: (i: number) => i <= 1 ? 1 : 0.5,
      vLineWidth: () => 0,
      hLineColor: (i: number) => i <= 1 ? '#d1d5db' : '#f0f0f0',
      fillColor: (r: number) => r === 0 ? '#f5f5f5' : null,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 10]
  })

  // Totals - simple subtotal + total only
  const { totalsBody, grandTotalIndex } = buildTotalsBody(ctx)
  content.push({
    columns: [{ text: '', width: '*' }, {
      table: { widths: [90, 90], body: totalsBody },
      layout: {
        hLineWidth: (i: number) => i === grandTotalIndex ? 2 : 0,
        vLineWidth: () => 0, hLineColor: () => '#1a1a1a',
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      width: 'auto'
    }],
    margin: [0, 0, 0, 10]
  })

  // Payment instructions - plain
  if (ctx.paymentMethodSnapshot) {
    content.push({ text: 'PAYMENT INSTRUCTIONS', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] })
    content.push(...buildPaymentContent(ctx))
  }

  // Minimal footer
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 12, 0, 6] })
  content.push({ text: `${ctx.issuerName}${ctx.issuerEmail ? ` - ${ctx.issuerEmail}` : ''}`, fontSize: 8, color: '#aaaaaa', alignment: 'right' })

  return content
}

// =================== STANDARD (Professional) ===================
function buildStandardPdf(ctx: PdfBuildContext): unknown[] {
  const content: unknown[] = []

  // Header: logo/business name left, INVOICE + number + status right
  const leftHeaderStack: unknown[] = []
  if (ctx.showLogo && ctx.logoDataUri) {
    leftHeaderStack.push({ image: ctx.logoDataUri, width: 120, fit: [120, 45], margin: [0, 0, 0, 4] })
  } else {
    leftHeaderStack.push({ text: ctx.issuerName, fontSize: 14, bold: true, margin: [0, 0, 0, 2] })
  }
  if (ctx.issuerAddress) leftHeaderStack.push({ text: ctx.issuerAddress, fontSize: 9, color: '#666666' })
  if (ctx.issuerTaxId) leftHeaderStack.push({ text: `TIN: ${ctx.issuerTaxId}`, fontSize: 9, color: '#444444', bold: true })
  if (ctx.issuerVatReg) leftHeaderStack.push({ text: `VAT: ${ctx.issuerVatReg}`, fontSize: 9, color: '#444444' })
  if (ctx.issuerSnapshot?.is_vat_registered) {
    leftHeaderStack.push({
      table: { widths: ['auto'], body: [[{ text: 'VAT INVOICE', fontSize: 7, bold: true, color: '#1d4ed8', fillColor: '#dbeafe', margin: [4, 1, 4, 1] }]] },
      layout: 'noBorders', margin: [0, 3, 0, 0]
    })
  }

  const metaLine = `${formatDate(ctx.invoice.issue_date as string)}  |  Due: ${formatDate(ctx.invoice.due_date as string)}  |  ${ctx.currency}`
  content.push({
    columns: [
      { stack: leftHeaderStack, width: '*' },
      { stack: [
        { text: 'INVOICE', fontSize: 18, bold: true, alignment: 'right' },
        { text: ctx.invoice.invoice_number as string, fontSize: 10, color: '#666666', alignment: 'right', margin: [0, 1, 0, 3] },
        {
          table: { widths: ['auto'], body: [[{ text: ctx.status.toUpperCase(), fontSize: 7, bold: true, color: statusColors[ctx.status] || '#1d4ed8', fillColor: statusBgColors[ctx.status] || '#dbeafe', margin: [5, 1, 5, 1] }]] },
          layout: 'noBorders', alignment: 'right', margin: [0, 0, 0, 3]
        },
        { text: metaLine, fontSize: 8, color: '#666666', alignment: 'right' },
      ], width: 'auto' }
    ],
    margin: [0, 0, 0, 8]
  })
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 1, lineColor: '#d1d5db' }], margin: [0, 0, 0, 10] })

  // Billing: Bill To left + Amount Due box right
  const billToStack: unknown[] = [
    { text: 'BILL TO', fontSize: 8, bold: true, color: '#999999', margin: [0, 0, 0, 3] },
    { text: ctx.recipientName, fontSize: 11, bold: true, margin: [0, 0, 0, 1] },
  ]
  if (ctx.recipientAddress) billToStack.push({ text: ctx.recipientAddress, fontSize: 9, color: '#444444' })
  if (ctx.recipientEmail) billToStack.push({ text: ctx.recipientEmail, fontSize: 9, color: '#444444' })
  if (ctx.recipientTaxId) billToStack.push({ text: `TIN: ${ctx.recipientTaxId}`, fontSize: 9, color: '#444444', bold: true })

  // Amount Due highlight box
  const amountDueBox = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { columns: [{ text: 'Invoice Date', fontSize: 9, color: '#666666', width: '*' }, { text: formatDate(ctx.invoice.issue_date as string), fontSize: 9, alignment: 'right', width: 'auto' }], margin: [0, 0, 0, 2] },
          { columns: [{ text: 'Due Date', fontSize: 9, color: '#666666', width: '*' }, { text: formatDate(ctx.invoice.due_date as string), fontSize: 9, alignment: 'right', width: 'auto' }], margin: [0, 0, 0, 2] },
          { columns: [{ text: 'Currency', fontSize: 9, color: '#666666', width: '*' }, { text: ctx.currency, fontSize: 9, alignment: 'right', width: 'auto' }], margin: [0, 0, 0, 4] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 0, 0, 4] },
          { columns: [{ text: 'Amount Due', fontSize: 12, bold: true, width: '*' }, { text: formatCurrencyPdf(ctx.balanceDue, ctx.currency), fontSize: 12, bold: true, alignment: 'right', width: 'auto' }] },
        ],
        fillColor: '#f8f9fa',
        margin: [8, 6, 8, 6]
      }]]
    },
    layout: {
      hLineWidth: () => 1, vLineWidth: () => 1,
      hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb',
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    }
  }

  content.push({
    columns: [
      { stack: billToStack, width: '50%' },
      { ...amountDueBox, width: '50%' }
    ],
    margin: [0, 0, 0, 14]
  })

  // Items table
  const { headerRow, itemRows, tableWidths } = buildItemRows(ctx)
  content.push({
    table: { headerRows: 1, widths: tableWidths, body: [headerRow, ...itemRows] },
    layout: {
      hLineWidth: (i: number) => i <= 1 ? 1 : 0.5,
      vLineWidth: () => 0,
      hLineColor: (i: number) => i <= 1 ? '#d1d5db' : '#f0f0f0',
      fillColor: (r: number) => r === 0 ? '#f5f5f5' : null,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 6]
  })

  // Invoice Summary box
  const summaryItems = [
    ['Total Items', String(ctx.items.length)],
    ['Subtotal', formatCurrencyPdf(ctx.invoice.subtotal as number, ctx.currency)],
  ]
  if ((ctx.invoice.tax_amount as number) > 0) summaryItems.push(['Tax', formatCurrencyPdf(ctx.invoice.tax_amount as number, ctx.currency)])
  if ((ctx.invoice.discount_amount as number) > 0) summaryItems.push(['Discount', `-${formatCurrencyPdf(ctx.invoice.discount_amount as number, ctx.currency)}`])
  summaryItems.push(['Grand Total', formatCurrencyPdf(ctx.invoice.total_amount as number, ctx.currency)])
  if ((ctx.invoice.amount_paid as number) > 0) summaryItems.push(['Paid', `-${formatCurrencyPdf(ctx.invoice.amount_paid as number, ctx.currency)}`])
  if (ctx.balanceDue > 0) summaryItems.push(['Amount Due', formatCurrencyPdf(ctx.balanceDue, ctx.currency)])

  const summaryBody = summaryItems.map(([label, val], idx) => {
    const isLast = idx === summaryItems.length - 1
    return [
      { text: label, fontSize: isLast ? 10 : 9, bold: isLast, color: isLast ? '#1a1a1a' : '#666666', margin: [6, 3, 6, 3] },
      { text: val, fontSize: isLast ? 10 : 9, bold: isLast, alignment: 'right', margin: [6, 3, 6, 3] }
    ]
  })

  content.push({
    columns: [{ text: '', width: '*' }, {
      table: {
        widths: [100, 100],
        body: [
          [{ text: 'Invoice Summary', fontSize: 9, bold: true, colSpan: 2, fillColor: '#f5f5f5', margin: [6, 4, 6, 4] }, {}],
          ...summaryBody
        ]
      },
      layout: {
        hLineWidth: (i: number) => i <= 1 ? 1 : 0.5,
        vLineWidth: (i: number) => (i === 0 || i === 2) ? 1 : 0,
        hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb',
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      width: 'auto'
    }],
    margin: [0, 0, 0, 10]
  })

  // Notes/Terms
  content.push(...buildNotesTerms(ctx))

  // Payment instructions
  if (ctx.paymentMethodSnapshot) {
    content.push({ text: 'PAYMENT INSTRUCTIONS', fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] })
    content.push(...buildPaymentContent(ctx))
  }

  // Footer
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 8, 0, 6] })
  content.push(...buildFooterContent(ctx))

  return content
}

// =================== MODERN ===================
function buildModernPdf(ctx: PdfBuildContext): unknown[] {
  const content: unknown[] = []
  const brandColor = ctx.tplPrimaryColor

  // Full-width colored header bar
  content.push({
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          {
            columns: [
              ...(ctx.showLogo && ctx.logoDataUri ? [{ image: ctx.logoDataUri, width: 50, fit: [50, 35], margin: [0, 0, 10, 0] }] : []),
              { stack: [
                { text: 'INVOICE', fontSize: 20, bold: true, color: '#ffffff' },
                { text: ctx.invoice.invoice_number as string, fontSize: 10, color: '#ffffff', margin: [0, 1, 0, 0] }
              ], width: '*' },
              { stack: [
                { text: `Issue: ${formatDate(ctx.invoice.issue_date as string)}`, fontSize: 9, color: '#ffffff', alignment: 'right' },
                { text: `Due: ${formatDate(ctx.invoice.due_date as string)}`, fontSize: 9, color: '#ffffff', alignment: 'right' },
                {
                  table: { widths: ['auto'], body: [[{ text: ctx.status.toUpperCase(), fontSize: 7, bold: true, color: brandColor, margin: [6, 2, 6, 2] }]] },
                  layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0, fillColor: () => '#ffffff' },
                  alignment: 'right', margin: [0, 4, 0, 0]
                }
              ], width: 'auto' }
            ]
          }
        ],
        fillColor: brandColor,
        margin: [14, 12, 14, 12]
      }]]
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    margin: [0, 0, 0, 14]
  })

  // FROM and TO in bordered card-style boxes
  const fromCard = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'FROM', fontSize: 8, bold: true, color: brandColor, margin: [0, 0, 0, 3] },
          { text: ctx.issuerName, fontSize: 11, bold: true, margin: [0, 0, 0, 1] },
          ...(ctx.issuerAddress ? [{ text: ctx.issuerAddress, fontSize: 9, color: '#666666' }] : []),
          ...(ctx.issuerTaxId ? [{ text: `TIN: ${ctx.issuerTaxId}`, fontSize: 9, color: '#444444', bold: true }] : []),
          ...(ctx.issuerEmail ? [{ text: ctx.issuerEmail, fontSize: 9, color: '#666666' }] : []),
        ],
        fillColor: '#fafafa',
        margin: [8, 6, 8, 6]
      }]]
    },
    layout: {
      hLineWidth: () => 1, vLineWidth: () => 1,
      hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb',
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    }
  }
  const toCard = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'BILL TO', fontSize: 8, bold: true, color: brandColor, margin: [0, 0, 0, 3] },
          { text: ctx.recipientName, fontSize: 11, bold: true, margin: [0, 0, 0, 1] },
          ...(ctx.recipientAddress ? [{ text: ctx.recipientAddress, fontSize: 9, color: '#666666' }] : []),
          ...(ctx.recipientTaxId ? [{ text: `TIN: ${ctx.recipientTaxId}`, fontSize: 9, color: '#444444', bold: true }] : []),
          ...(ctx.recipientEmail ? [{ text: ctx.recipientEmail, fontSize: 9, color: '#666666' }] : []),
        ],
        fillColor: '#fafafa',
        margin: [8, 6, 8, 6]
      }]]
    },
    layout: {
      hLineWidth: () => 1, vLineWidth: () => 1,
      hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb',
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    }
  }

  content.push({
    columns: [
      { ...fromCard, width: '48%' },
      { text: '', width: '4%' },
      { ...toCard, width: '48%' }
    ],
    margin: [0, 0, 0, 14]
  })

  // Items table in bordered container
  const { headerRow, itemRows, tableWidths } = buildItemRows(ctx)
  content.push({
    table: {
      widths: ['*'],
      body: [[{
        table: { headerRows: 1, widths: tableWidths, body: [headerRow, ...itemRows] },
        layout: {
          hLineWidth: (i: number) => i <= 1 ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: (i: number) => i <= 1 ? '#d1d5db' : '#f0f0f0',
          fillColor: (r: number) => r === 0 ? '#f5f5f5' : null,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
        margin: [4, 4, 4, 4]
      }]]
    },
    layout: {
      hLineWidth: () => 1, vLineWidth: () => 1,
      hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb',
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 10]
  })

  // Totals in bordered card
  const { totalsBody, grandTotalIndex } = buildTotalsBody(ctx)
  content.push({
    columns: [{ text: '', width: '*' }, {
      table: {
        widths: ['*'],
        body: [[{
          table: { widths: [90, 90], body: totalsBody },
          layout: {
            hLineWidth: (i: number) => i === grandTotalIndex ? 2 : 0,
            vLineWidth: () => 0, hLineColor: () => '#1a1a1a',
            paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
          },
          margin: [6, 4, 6, 4]
        }]]
      },
      layout: {
        hLineWidth: () => 1, vLineWidth: () => 1,
        hLineColor: () => '#e5e7eb', vLineColor: () => '#e5e7eb',
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      width: 'auto'
    }],
    margin: [0, 0, 0, 10]
  })

  // Payment instructions in green-tinted box
  if (ctx.paymentMethodSnapshot) {
    content.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'PAYMENT INSTRUCTIONS', fontSize: 8, bold: true, color: '#166534', margin: [0, 0, 0, 4] },
            ...buildPaymentContent(ctx)
          ],
          fillColor: '#f0fdf4',
          margin: [8, 6, 8, 6]
        }]]
      },
      layout: {
        hLineWidth: () => 1, vLineWidth: () => 1,
        hLineColor: () => '#bbf7d0', vLineColor: () => '#bbf7d0',
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 10]
    })
  }

  // Notes/Terms
  content.push(...buildNotesTerms(ctx))

  // Footer
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }], margin: [0, 8, 0, 6] })
  content.push(...buildFooterContent(ctx))

  return content
}

// =================== ENTERPRISE ===================
function buildEnterprisePdf(ctx: PdfBuildContext): unknown[] {
  const content: unknown[] = []
  const brandColor = ctx.tplPrimaryColor

  // Top border
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: brandColor }], margin: [0, 0, 0, 8] })

  // Centered letterhead
  const letterheadStack: unknown[] = []
  if (ctx.showLogo && ctx.logoDataUri) {
    letterheadStack.push({ image: ctx.logoDataUri, width: 100, fit: [100, 40], alignment: 'center', margin: [0, 0, 0, 4] })
  }
  letterheadStack.push({ text: ctx.issuerName, fontSize: 14, bold: true, alignment: 'center', characterSpacing: 1, margin: [0, 0, 0, 2] })
  if (ctx.issuerTaxId) letterheadStack.push({ text: `TIN: ${ctx.issuerTaxId}`, fontSize: 8, color: '#666666', alignment: 'center' })
  if (ctx.issuerVatReg) letterheadStack.push({ text: `VAT: ${ctx.issuerVatReg}`, fontSize: 8, color: '#666666', alignment: 'center' })
  if (ctx.issuerAddress) letterheadStack.push({ text: ctx.issuerAddress, fontSize: 8, color: '#666666', alignment: 'center' })
  content.push({ stack: letterheadStack, margin: [0, 0, 0, 8] })

  // Bottom border
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: brandColor }], margin: [0, 0, 0, 12] })

  // 4-column metadata grid
  content.push({
    columns: [
      { stack: [{ text: 'INVOICE NO', fontSize: 7, bold: true, color: '#999999' }, { text: ctx.invoice.invoice_number as string, fontSize: 9, bold: true }], width: '*' },
      { stack: [{ text: 'DATE', fontSize: 7, bold: true, color: '#999999' }, { text: formatDate(ctx.invoice.issue_date as string), fontSize: 9 }], width: '*' },
      { stack: [{ text: 'DUE DATE', fontSize: 7, bold: true, color: '#999999' }, { text: formatDate(ctx.invoice.due_date as string), fontSize: 9 }], width: '*' },
      {
        stack: [
          { text: 'STATUS', fontSize: 7, bold: true, color: '#999999' },
          {
            table: { widths: ['auto'], body: [[{ text: ctx.status.toUpperCase(), fontSize: 7, bold: true, color: statusColors[ctx.status] || '#1d4ed8', fillColor: statusBgColors[ctx.status] || '#dbeafe', margin: [4, 1, 4, 1] }]] },
            layout: 'noBorders'
          }
        ], width: '*'
      }
    ],
    margin: [0, 0, 0, 10]
  })
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: `${brandColor}40` }], margin: [0, 0, 0, 12] })

  // ISSUER / RECIPIENT two-column with colored labels
  content.push({
    columns: [
      { stack: [
        { text: 'ISSUER', fontSize: 8, bold: true, color: brandColor, characterSpacing: 0.5, margin: [0, 0, 0, 4] },
        { text: ctx.issuerName, fontSize: 11, bold: true, margin: [0, 0, 0, 1] },
        ...(ctx.issuerAddress ? [{ text: ctx.issuerAddress, fontSize: 9, color: '#444444' }] : []),
        ...(ctx.issuerEmail ? [{ text: ctx.issuerEmail, fontSize: 9, color: '#444444' }] : []),
        ...(ctx.issuerSnapshot?.contact_phone ? [{ text: ctx.issuerSnapshot.contact_phone, fontSize: 9, color: '#444444' }] : []),
      ], width: '50%' },
      { stack: [
        { text: 'RECIPIENT', fontSize: 8, bold: true, color: brandColor, characterSpacing: 0.5, margin: [0, 0, 0, 4] },
        { text: ctx.recipientName, fontSize: 11, bold: true, margin: [0, 0, 0, 1] },
        ...(ctx.recipientAddress ? [{ text: ctx.recipientAddress, fontSize: 9, color: '#444444' }] : []),
        ...(ctx.recipientEmail ? [{ text: ctx.recipientEmail, fontSize: 9, color: '#444444' }] : []),
        ...(ctx.recipientTaxId ? [{ text: `TIN: ${ctx.recipientTaxId}`, fontSize: 9, color: '#444444', bold: true }] : []),
      ], width: '50%' }
    ],
    margin: [0, 0, 0, 12]
  })
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: `${brandColor}40` }], margin: [0, 0, 0, 12] })

  // Items in bordered table
  const { headerRow, itemRows, tableWidths } = buildItemRows(ctx)
  content.push({
    table: { headerRows: 1, widths: tableWidths, body: [headerRow, ...itemRows] },
    layout: {
      hLineWidth: (i: number) => i <= 1 ? 1 : 0.5,
      vLineWidth: (i: number, _node: unknown) => (i === 0 || i === (ctx.hasVat ? 5 : 4)) ? 1 : 0,
      hLineColor: (i: number) => i <= 1 ? '#d1d5db' : '#f0f0f0',
      vLineColor: () => '#e5e7eb',
      fillColor: (r: number) => r === 0 ? '#f5f5f5' : null,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 10]
  })

  // Clean totals
  const { totalsBody, grandTotalIndex } = buildTotalsBody(ctx)
  content.push({
    columns: [{ text: '', width: '*' }, {
      table: { widths: [90, 90], body: totalsBody },
      layout: {
        hLineWidth: (i: number) => i === grandTotalIndex ? 2 : 0,
        vLineWidth: () => 0, hLineColor: () => brandColor,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
      width: 'auto'
    }],
    margin: [0, 0, 0, 10]
  })

  // Notes/Terms
  content.push(...buildNotesTerms(ctx))

  // Payment instructions
  if (ctx.paymentMethodSnapshot) {
    content.push({ text: 'PAYMENT INSTRUCTIONS', fontSize: 8, bold: true, color: brandColor, characterSpacing: 0.5, margin: [0, 8, 0, 3] })
    content.push(...buildPaymentContent(ctx))
  }

  // Double-border footer
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: brandColor }], margin: [0, 10, 0, 2] })
  content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 2, lineColor: brandColor }], margin: [0, 0, 0, 6] })
  content.push(...buildFooterContent(ctx))

  return content
}

// ============================================================
// Main PDF generator — dispatches to template-specific builder
// ============================================================
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
  // Dynamic imports for pdfmake
  // deno-lint-ignore no-explicit-any
  const pdfMakeModule: any = await import('https://esm.sh/pdfmake@0.2.13/build/pdfmake.js?bundle=false')
  // deno-lint-ignore no-explicit-any
  const pdfFontsModule: any = await import('https://esm.sh/pdfmake@0.2.13/build/vfs_fonts.js?bundle=false')
  const pdfMake = pdfMakeModule.default || pdfMakeModule
  const vfsData = pdfFontsModule?.pdfMake?.vfs || pdfFontsModule?.default?.pdfMake?.vfs
  if (vfsData) pdfMake.vfs = vfsData

  const currency = invoice.currency as string
  const balanceDue = (invoice.total_amount as number) - ((invoice.amount_paid as number) || 0)

  // Fetch logo as base64
  let logoDataUri: string | null = null
  const logoUrl = issuerSnapshot?.logo_url || null
  if (logoUrl) logoDataUri = await fetchImageAsBase64(logoUrl)

  // Fetch QR code as base64
  let qrDataUri: string | null = null
  if (verificationUrl) {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verificationUrl)}&format=png`
    qrDataUri = await fetchImageAsBase64(qrApiUrl)
  }

  const tplLayout = templateSnapshot?.layout || {}
  const tplStyles = templateSnapshot?.styles || {}

  const ctx: PdfBuildContext = {
    invoice, items, issuerSnapshot, recipientSnapshot, verificationUrl,
    showWatermark, paymentMethodSnapshot, templateSnapshot,
    currency, balanceDue,
    issuerName: issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Business',
    issuerAddress: formatAddressCompact(issuerSnapshot?.address),
    issuerEmail: issuerSnapshot?.contact_email || '',
    issuerTaxId: issuerSnapshot?.tax_id || '',
    issuerVatReg: issuerSnapshot?.vat_registration_number || '',
    recipientName: recipientSnapshot?.name || 'Client',
    recipientEmail: recipientSnapshot?.email || '',
    recipientAddress: formatAddressCompact(recipientSnapshot?.address),
    recipientTaxId: recipientSnapshot?.tax_id || '',
    status: invoice.status as string,
    hasVat: issuerSnapshot?.is_vat_registered || false,
    logoDataUri, qrDataUri,
    tplPrimaryColor: tplStyles.primary_color || '#1a1a1a',
    showLogo: tplLayout.show_logo !== false,
    showTerms: tplLayout.show_terms !== false,
    showNotes: tplLayout.show_notes !== false,
    showQr: tplLayout.show_verification_qr !== false,
  }

  const tplHeaderStyle = tplLayout.header_style || 'standard'
  let contentArray: unknown[]

  switch (tplHeaderStyle) {
    case 'minimal':
      contentArray = buildMinimalPdf(ctx)
      break
    case 'modern':
      contentArray = buildModernPdf(ctx)
      break
    case 'enterprise':
      contentArray = buildEnterprisePdf(ctx)
      break
    default:
      contentArray = buildStandardPdf(ctx)
      break
  }

  const docDefinition = {
    pageSize: 'A4' as const,
    pageMargins: [36, 40, 36, 40] as [number, number, number, number],
    content: contentArray,
    styles: {
      headerTitle: { fontSize: 18, bold: true },
      businessName: { fontSize: 14, bold: true },
      sectionTitle: { fontSize: 8, bold: true, color: '#999999', margin: [0, 8, 0, 3] },
      tableHeader: { fontSize: 9, bold: true, fillColor: '#f5f5f5' },
      smallText: { fontSize: 8, color: '#666666' },
    },
    defaultStyle: { fontSize: 9 },
    watermark: showWatermark ? { text: 'INVOICEMONK', opacity: 0.04, angle: -45, fontSize: 60 } : undefined,
  }

  return new Promise<string>((resolve, reject) => {
    try {
      // deno-lint-ignore no-explicit-any
      const pdfDocGenerator = pdfMake.createPdf(docDefinition as any)
      pdfDocGenerator.getBase64((base64: string) => { resolve(base64) })
    } catch (err) {
      reject(err)
    }
  })
}

// ============================================================
// MAIN SERVER HANDLER
// ============================================================
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Rate limit: max 10 emails/hour, 50 emails/day per user
    const hourlyAllowed = await checkRateLimit(serviceRoleKey, userId, 'send-invoice-email', 3600, 10)
    if (!hourlyAllowed) return rateLimitResponse(corsHeaders)
    const dailyAllowed = await checkRateLimit(serviceRoleKey, userId, 'email-daily', 86400, 50)
    if (!dailyAllowed) return rateLimitResponse(corsHeaders)

    const body: SendInvoiceRequest = await req.json()
    
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

    const customMessageError = validateString(body.custom_message, 'custom_message', 2000);
    if (customMessageError) {
      return new Response(
        JSON.stringify({ success: false, error: customMessageError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const sanitizedCustomMessage = body.custom_message ? sanitizeString(body.custom_message) : null;

    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com'

    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Email sending is not configured. Please configure BREVO_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    if (invoice.status === 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot send draft invoices. Please issue the invoice first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const issuerSnapshot = invoice.issuer_snapshot as IssuerSnapshot | null
    const recipientSnapshot = invoice.recipient_snapshot as RecipientSnapshot | null
    const templateSnapshot = invoice.template_snapshot as TemplateSnapshot | null
    const items = (invoice.invoice_items || []) as InvoiceItem[]
    
    const businessName = issuerSnapshot?.legal_name || issuerSnapshot?.name || 'Invoicemonk'
    const clientName = recipientSnapshot?.name || invoice.clients?.name || 'Valued Customer'
    const invoiceSummary = invoice.summary as string | null

    const issuerAddress = formatAddressCompact(issuerSnapshot?.address)
    const issuerEmail = issuerSnapshot?.contact_email || ''
    const issuerPhone = issuerSnapshot?.contact_phone || ''
    let issuerLogoUrl = issuerSnapshot?.logo_url || null

    if (!issuerLogoUrl && invoice.business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('logo_url')
        .eq('id', invoice.business_id)
        .single()
      issuerLogoUrl = business?.logo_url || null
      if (issuerLogoUrl) console.log('Logo fetched from business table as fallback')
    }

    const { data: tierResult, error: tierError } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'remove_watermark'
    })

    if (tierError) console.error('Tier check error:', tierError)

    const tierData = typeof tierResult === 'object' && tierResult !== null ? tierResult : { allowed: false, tier: 'starter' }
    const canRemoveWatermark = tierData.allowed === true

    const { data: brandingResult } = await supabase.rpc('check_tier_limit', {
      _user_id: userId,
      _feature: 'custom_branding'
    })
    const brandingData = typeof brandingResult === 'object' && brandingResult !== null ? brandingResult : { allowed: false }
    const canUseBranding = brandingData.allowed === true && templateSnapshot?.supports_branding !== false

    const templateRequiresWatermark = templateSnapshot?.watermark_required !== false
    const showWatermark = templateRequiresWatermark && !canRemoveWatermark

    let appUrl = body.app_url || Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    if (appUrl.includes('lovableproject.com') || appUrl.includes('lovable.app')) {
      console.warn('Lovable preview URL detected in app_url, using production fallback')
      appUrl = Deno.env.get('APP_URL') || 'https://app.invoicemonk.com'
    }
    
    const viewInvoiceUrl = invoice.verification_id 
      ? `${appUrl}/invoice/view/${invoice.verification_id}`
      : null
    const verificationUrl = invoice.verification_id 
      ? `${appUrl}/verify/invoice/${invoice.verification_id}`
      : null
    
    const qrCodeUrl = verificationUrl 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verificationUrl)}&format=png`
      : null

    // Parse payment method snapshot
    const paymentMethodSnapshot = invoice.payment_method_snapshot
      ? (typeof invoice.payment_method_snapshot === 'string'
          ? JSON.parse(invoice.payment_method_snapshot)
          : invoice.payment_method_snapshot) as Record<string, unknown>
      : null;

    // Generate PDF using pdfmake with template-specific layout
    console.log('Generating PDF attachment using pdfmake...')
    const attachmentContent = await generateInvoicePdfBase64(
      invoice, items, issuerSnapshot, recipientSnapshot,
      verificationUrl, showWatermark, paymentMethodSnapshot, templateSnapshot
    )
    const attachmentName = `Invoice-${invoice.invoice_number}.pdf`
    console.log(`PDF attachment generated: ${attachmentName}`)

    // Build email HTML
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
        
        <!-- Branded Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); padding: 24px 32px;">
          <tr>
            <td style="text-align: center;">
              ${issuerLogoUrl ? `<img src="${issuerLogoUrl}" alt="${businessName}" style="height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 12px;" /><br>` : ''}
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
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Invoice Number:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><strong style="color: #1f2937; font-size: 14px;">${invoice.invoice_number}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Issue Date:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.issue_date)}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><span style="color: #6b7280; font-size: 14px;">Due Date:</span></td>
                        <td style="text-align: right; padding: 8px 0;"><span style="color: #1f2937; font-size: 14px;">${formatDate(invoice.due_date)}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0; border-top: 1px solid #e5e7eb;"><strong style="color: #1f2937; font-size: 16px;">Total Amount:</strong></td>
                        <td style="text-align: right; padding: 12px 0 0; border-top: 1px solid #e5e7eb;"><strong style="color: #1f2937; font-size: 18px;">${formatCurrency(invoice.total_amount, invoice.currency)}</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${viewInvoiceUrl ? `
              <!-- Primary CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="text-align: center; padding: 8px 0;">
                    <a href="${viewInvoiceUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      View Invoice Online &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 8px;">
                    <span style="color: #6b7280; font-size: 12px;">View full invoice details, line items, and download options</span>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${verificationUrl ? `
              <!-- Verification Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bfdbfe;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">Verify Invoice Authenticity</p>
                          <p style="margin: 0 0 12px; color: #374151; font-size: 14px;">Scan the QR code or click the button to verify this invoice is genuine.</p>
                          <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Verify Invoice</a>
                          <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px;">Verification ID: ${invoice.verification_id}</p>
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

              <!-- Attachment Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #166534; font-size: 14px;">
                      <strong>Invoice Attached:</strong> Please find your professional invoice PDF attached to this email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #374151; font-size: 16px;">If you have any questions, please don't hesitate to contact us.</p>
              <p style="margin: 16px 0 0; color: #374151; font-size: 16px;">Best regards,<br><strong>${businessName}</strong></p>
            </td>
          </tr>
        </table>

        <!-- Business Contact Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1f2937;">${businessName}</p>
              ${issuerPhone ? `<p style="margin: 8px 0 0; font-size: 14px; color: #374151;">${issuerPhone}</p>` : ''}
              ${issuerEmail ? `<p style="margin: 4px 0 0; font-size: 14px; color: #374151;">${issuerEmail}</p>` : ''}
              ${issuerAddress ? `<p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">${issuerAddress}</p>` : ''}
            </td>
          </tr>
        </table>

        <!-- Platform Footer -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 16px 32px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.7);">
                Powered by Invoicemonk | &copy; ${new Date().getFullYear()} Invoicemonk LTD
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

    // Send email via Brevo API
    console.log('Sending email via Brevo API to:', body.recipient_email)

    try {
      const brevoPayload: Record<string, unknown> = {
        sender: { name: businessName, email: smtpFrom },
        to: [{ email: body.recipient_email, name: clientName }],
        subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
        htmlContent: emailHtml,
        attachment: [{ content: attachmentContent, name: attachmentName }],
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
          JSON.stringify({ success: false, error: `Failed to send email: ${errorData.message || 'Brevo API error'}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const brevoResult = await brevoResponse.json()
      console.log('Email sent successfully via Brevo:', brevoResult)
    } catch (emailError) {
      console.error('Email sending error:', emailError)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to send email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice status to 'sent' if currently 'issued'
    if (invoice.status === 'issued') {
      await supabase.from('invoices').update({ status: 'sent' }).eq('id', body.invoice_id)
    }

    // Log audit event and create notification
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)
      
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
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
