import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, checkRateLimit, rateLimitResponse } from '../_shared/validation.ts'
import { initSentry, captureException } from '../_shared/sentry.ts'
initSentry()

// Jurisdiction tax pack configs (server-side copy of key fields)
const TAX_PACK_CONFIG: Record<string, {
  taxAuthorityName: string;
  taxAuthorityFullName: string;
  vatLabel: string;
  standardVatRate: number;
  hasVat: boolean;
  documentTitle: string;
  disclaimerAuthority: string;
  additionalTaxes?: string[];
  currencySymbol: string;
}> = {
  NG: { taxAuthorityName: 'FIRS', taxAuthorityFullName: 'Federal Inland Revenue Service', vatLabel: 'VAT', standardVatRate: 7.5, hasVat: true, documentTitle: 'FIRS VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser registered with the Chartered Institute of Taxation of Nigeria (CITN)', additionalTaxes: ['WHT', 'CIT'], currencySymbol: '₦' },
  GH: { taxAuthorityName: 'GRA', taxAuthorityFullName: 'Ghana Revenue Authority', vatLabel: 'VAT', standardVatRate: 15, hasVat: true, documentTitle: 'GRA VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser registered with ICAG', currencySymbol: 'GH₵' },
  KE: { taxAuthorityName: 'KRA', taxAuthorityFullName: 'Kenya Revenue Authority', vatLabel: 'VAT', standardVatRate: 16, hasVat: true, documentTitle: 'KRA VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser registered with ICPAK', currencySymbol: 'KSh' },
  ZA: { taxAuthorityName: 'SARS', taxAuthorityFullName: 'South African Revenue Service', vatLabel: 'VAT', standardVatRate: 15, hasVat: true, documentTitle: 'SARS VAT Return Preparation Summary', disclaimerAuthority: 'a qualified tax practitioner registered with SARS', currencySymbol: 'R' },
  EG: { taxAuthorityName: 'ETA', taxAuthorityFullName: 'Egyptian Tax Authority', vatLabel: 'VAT', standardVatRate: 14, hasVat: true, documentTitle: 'ETA VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser in Egypt', currencySymbol: 'E£' },
  RW: { taxAuthorityName: 'RRA', taxAuthorityFullName: 'Rwanda Revenue Authority', vatLabel: 'VAT', standardVatRate: 18, hasVat: true, documentTitle: 'RRA VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser in Rwanda', currencySymbol: 'FRw' },
  TZ: { taxAuthorityName: 'TRA', taxAuthorityFullName: 'Tanzania Revenue Authority', vatLabel: 'VAT', standardVatRate: 18, hasVat: true, documentTitle: 'TRA VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser in Tanzania', currencySymbol: 'TSh' },
  UG: { taxAuthorityName: 'URA', taxAuthorityFullName: 'Uganda Revenue Authority', vatLabel: 'VAT', standardVatRate: 18, hasVat: true, documentTitle: 'URA VAT Return Worksheet', disclaimerAuthority: 'a qualified tax adviser in Uganda', currencySymbol: 'USh' },
  SN: { taxAuthorityName: 'DGID', taxAuthorityFullName: 'Direction Générale des Impôts et des Domaines', vatLabel: 'TVA', standardVatRate: 18, hasVat: true, documentTitle: 'Fiche Préparatoire TVA - DGID', disclaimerAuthority: 'un conseiller fiscal qualifié au Sénégal', currencySymbol: 'CFA' },
  US: { taxAuthorityName: 'IRS', taxAuthorityFullName: 'Internal Revenue Service', vatLabel: 'Sales Tax', standardVatRate: 0, hasVat: false, documentTitle: 'Income & Expense Summary for IRS Filing', disclaimerAuthority: 'a licensed CPA or Enrolled Agent', additionalTaxes: ['State Sales Tax', '1099 Reporting'], currencySymbol: '$' },
  CA: { taxAuthorityName: 'CRA', taxAuthorityFullName: 'Canada Revenue Agency', vatLabel: 'GST/HST', standardVatRate: 5, hasVat: true, documentTitle: 'CRA GST/HST Return Worksheet', disclaimerAuthority: 'a chartered professional accountant (CPA)', currencySymbol: 'C$' },
  MX: { taxAuthorityName: 'SAT', taxAuthorityFullName: 'Servicio de Administración Tributaria', vatLabel: 'IVA', standardVatRate: 16, hasVat: true, documentTitle: 'Hoja de Trabajo IVA - SAT', disclaimerAuthority: 'un contador público certificado', currencySymbol: 'MX$' },
  BR: { taxAuthorityName: 'Receita Federal', taxAuthorityFullName: 'Secretaria Especial da Receita Federal do Brasil', vatLabel: 'ICMS/ISS', standardVatRate: 0, hasVat: true, documentTitle: 'Resumo Fiscal - Receita Federal', disclaimerAuthority: 'um contador registrado no CRC', currencySymbol: 'R$' },
  AR: { taxAuthorityName: 'AFIP', taxAuthorityFullName: 'Administración Federal de Ingresos Públicos', vatLabel: 'IVA', standardVatRate: 21, hasVat: true, documentTitle: 'Hoja de Trabajo IVA - AFIP', disclaimerAuthority: 'un contador público certificado', currencySymbol: 'AR$' },
  CL: { taxAuthorityName: 'SII', taxAuthorityFullName: 'Servicio de Impuestos Internos', vatLabel: 'IVA', standardVatRate: 19, hasVat: true, documentTitle: 'Hoja de Trabajo IVA - SII', disclaimerAuthority: 'un contador auditor certificado', currencySymbol: 'CL$' },
  CO: { taxAuthorityName: 'DIAN', taxAuthorityFullName: 'Dirección de Impuestos y Aduanas Nacionales', vatLabel: 'IVA', standardVatRate: 19, hasVat: true, documentTitle: 'Hoja de Trabajo IVA - DIAN', disclaimerAuthority: 'un contador público certificado', currencySymbol: 'CO$' },
  GB: { taxAuthorityName: 'HMRC', taxAuthorityFullName: 'HM Revenue & Customs', vatLabel: 'VAT', standardVatRate: 20, hasVat: true, documentTitle: 'HMRC VAT Return Summary', disclaimerAuthority: 'a qualified accountant or tax adviser', additionalTaxes: ['Corporation Tax', 'PAYE'], currencySymbol: '£' },
  DE: { taxAuthorityName: 'Finanzamt', taxAuthorityFullName: 'Bundeszentralamt für Steuern', vatLabel: 'USt/MwSt', standardVatRate: 19, hasVat: true, documentTitle: 'Umsatzsteuervoranmeldung Vorbereitung', disclaimerAuthority: 'einen Steuerberater', currencySymbol: '€' },
  FR: { taxAuthorityName: 'DGFiP', taxAuthorityFullName: 'Direction Générale des Finances Publiques', vatLabel: 'TVA', standardVatRate: 20, hasVat: true, documentTitle: 'Fiche Préparatoire TVA - DGFiP', disclaimerAuthority: 'un expert-comptable', currencySymbol: '€' },
  NL: { taxAuthorityName: 'Belastingdienst', taxAuthorityFullName: 'Belastingdienst', vatLabel: 'BTW', standardVatRate: 21, hasVat: true, documentTitle: 'BTW-aangifte Voorbereiding', disclaimerAuthority: 'een belastingadviseur', currencySymbol: '€' },
  ES: { taxAuthorityName: 'AEAT', taxAuthorityFullName: 'Agencia Estatal de Administración Tributaria', vatLabel: 'IVA', standardVatRate: 21, hasVat: true, documentTitle: 'Modelo 303 - Hoja de Trabajo IVA', disclaimerAuthority: 'un asesor fiscal colegiado', currencySymbol: '€' },
  IT: { taxAuthorityName: 'AdE', taxAuthorityFullName: 'Agenzia delle Entrate', vatLabel: 'IVA', standardVatRate: 22, hasVat: true, documentTitle: 'Liquidazione IVA - Preparazione', disclaimerAuthority: "un commercialista iscritto all'albo", currencySymbol: '€' },
  PL: { taxAuthorityName: 'KAS', taxAuthorityFullName: 'Krajowa Administracja Skarbowa', vatLabel: 'VAT', standardVatRate: 23, hasVat: true, documentTitle: 'Deklaracja VAT - Przygotowanie', disclaimerAuthority: 'doradcę podatkowego', currencySymbol: 'zł' },
  SE: { taxAuthorityName: 'Skatteverket', taxAuthorityFullName: 'Skatteverket', vatLabel: 'Moms', standardVatRate: 25, hasVat: true, documentTitle: 'Momsdeklaration Förberedelse', disclaimerAuthority: 'en auktoriserad revisor', currencySymbol: 'kr' },
  IE: { taxAuthorityName: 'Revenue', taxAuthorityFullName: 'Office of the Revenue Commissioners', vatLabel: 'VAT', standardVatRate: 23, hasVat: true, documentTitle: 'Revenue VAT3 Return Worksheet', disclaimerAuthority: 'a qualified tax adviser or chartered accountant', currencySymbol: '€' },
  BE: { taxAuthorityName: 'SPF Finances', taxAuthorityFullName: 'Service Public Fédéral Finances', vatLabel: 'BTW/TVA', standardVatRate: 21, hasVat: true, documentTitle: 'Préparation Déclaration TVA', disclaimerAuthority: 'un expert-comptable ou conseiller fiscal', currencySymbol: '€' },
  CH: { taxAuthorityName: 'FTA', taxAuthorityFullName: 'Federal Tax Administration', vatLabel: 'MWST/TVA', standardVatRate: 8.1, hasVat: true, documentTitle: 'MWST-Abrechnung Vorbereitung', disclaimerAuthority: 'einen zugelassenen Steuerberater', currencySymbol: 'CHF' },
  AU: { taxAuthorityName: 'ATO', taxAuthorityFullName: 'Australian Taxation Office', vatLabel: 'GST', standardVatRate: 10, hasVat: true, documentTitle: 'BAS Preparation Summary', disclaimerAuthority: 'a registered tax agent or BAS agent', currencySymbol: 'A$' },
  IN: { taxAuthorityName: 'CBIC', taxAuthorityFullName: 'Central Board of Indirect Taxes and Customs', vatLabel: 'GST', standardVatRate: 18, hasVat: true, documentTitle: 'GST Filing Summary (GSTR-3B Preparation)', disclaimerAuthority: 'a chartered accountant or GST practitioner', currencySymbol: '₹' },
  JP: { taxAuthorityName: 'NTA', taxAuthorityFullName: 'National Tax Agency', vatLabel: 'Consumption Tax', standardVatRate: 10, hasVat: true, documentTitle: 'Consumption Tax Filing Summary', disclaimerAuthority: 'a licensed tax accountant', currencySymbol: '¥' },
  SG: { taxAuthorityName: 'IRAS', taxAuthorityFullName: 'Inland Revenue Authority of Singapore', vatLabel: 'GST', standardVatRate: 9, hasVat: true, documentTitle: 'IRAS GST Return Worksheet (GST F5)', disclaimerAuthority: 'a qualified tax adviser in Singapore', currencySymbol: 'S$' },
  HK: { taxAuthorityName: 'IRD', taxAuthorityFullName: 'Inland Revenue Department', vatLabel: 'N/A', standardVatRate: 0, hasVat: false, documentTitle: 'Profits Tax Return Preparation Summary', disclaimerAuthority: 'a certified public accountant in Hong Kong', currencySymbol: 'HK$' },
  AE: { taxAuthorityName: 'FTA', taxAuthorityFullName: 'Federal Tax Authority', vatLabel: 'VAT', standardVatRate: 5, hasVat: true, documentTitle: 'FTA VAT Return Worksheet', disclaimerAuthority: 'a tax agent registered with the FTA', currencySymbol: 'AED' },
  SA: { taxAuthorityName: 'ZATCA', taxAuthorityFullName: 'Zakat, Tax and Customs Authority', vatLabel: 'VAT', standardVatRate: 15, hasVat: true, documentTitle: 'ZATCA VAT Return Summary', disclaimerAuthority: 'a licensed tax adviser in Saudi Arabia', additionalTaxes: ['Zakat', 'WHT'], currencySymbol: 'SAR' },
  MY: { taxAuthorityName: 'RMCD', taxAuthorityFullName: 'Royal Malaysian Customs Department', vatLabel: 'SST', standardVatRate: 8, hasVat: true, documentTitle: 'RMCD SST Return Worksheet', disclaimerAuthority: 'a licensed tax agent in Malaysia', currencySymbol: 'RM' },
  ID: { taxAuthorityName: 'DGT', taxAuthorityFullName: 'Directorate General of Taxes', vatLabel: 'PPN', standardVatRate: 11, hasVat: true, documentTitle: 'SPT Masa PPN - Preparation Sheet', disclaimerAuthority: 'a certified tax consultant in Indonesia', currencySymbol: 'Rp' },
  PH: { taxAuthorityName: 'BIR', taxAuthorityFullName: 'Bureau of Internal Revenue', vatLabel: 'VAT', standardVatRate: 12, hasVat: true, documentTitle: 'BIR VAT Return Worksheet (BIR Form 2550Q)', disclaimerAuthority: 'a certified public accountant in the Philippines', currencySymbol: '₱' },
  NZ: { taxAuthorityName: 'IRD', taxAuthorityFullName: 'Inland Revenue Department', vatLabel: 'GST', standardVatRate: 15, hasVat: true, documentTitle: 'IRD GST Return Worksheet', disclaimerAuthority: 'a chartered accountant in New Zealand', currencySymbol: 'NZ$' },
  BG: { taxAuthorityName: 'NRA', taxAuthorityFullName: 'National Revenue Agency', vatLabel: 'DDS', standardVatRate: 20, hasVat: true, documentTitle: 'VAT Return Worksheet (DDS)', disclaimerAuthority: 'a certified auditor or tax adviser in Bulgaria', currencySymbol: 'лв' },
  RO: { taxAuthorityName: 'ANAF', taxAuthorityFullName: 'Agenția Națională de Administrare Fiscală', vatLabel: 'TVA', standardVatRate: 19, hasVat: true, documentTitle: 'Declarație TVA - Pregătire (D300)', disclaimerAuthority: 'un consultant fiscal autorizat', currencySymbol: 'lei' },
  HU: { taxAuthorityName: 'NAV', taxAuthorityFullName: 'Nemzeti Adó- és Vámhivatal', vatLabel: 'ÁFA', standardVatRate: 27, hasVat: true, documentTitle: 'ÁFA Bevallás Előkészítés', disclaimerAuthority: 'adótanácsadó vagy könyvelő', currencySymbol: 'Ft' },
  RS: { taxAuthorityName: 'PU', taxAuthorityFullName: 'Poreska Uprava', vatLabel: 'PDV', standardVatRate: 20, hasVat: true, documentTitle: 'PDV Prijava Priprema', disclaimerAuthority: 'ovlašćeni poreski savetnik', currencySymbol: 'din.' },
}

function fmt(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function generateHtml(
  business: any,
  config: typeof TAX_PACK_CONFIG['NG'],
  periodStart: string,
  periodEnd: string,
  invoices: any[],
  expenses: any[],
  payments: any[],
  creditNotes: any[],
  currency: string,
): string {
  const sym = config.currencySymbol

  // Compute totals
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.subtotal || 0), 0)
  const outputVat = invoices.reduce((s, i) => s + Number(i.tax_amount || 0), 0)
  const totalInvoiceAmount = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const creditNoteTotal = creditNotes.reduce((s, c) => s + Number(c.amount || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const inputVat = expenses.reduce((s, e) => s + Number(e.tax_amount || 0), 0)
  const totalPaymentsReceived = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const netVat = outputVat - inputVat
  const netIncome = totalRevenue - creditNoteTotal - totalExpenses

  const address = business.address || {}
  const addressStr = [address.street, address.city, address.state, address.postal_code, address.country].filter(Boolean).join(', ')

  const taxIdLabel = business.jurisdiction === 'NG' ? 'TIN' : business.jurisdiction === 'GB' ? 'UTR' : business.jurisdiction === 'US' ? 'EIN' : business.jurisdiction === 'IN' ? 'GSTIN' : business.jurisdiction === 'AU' ? 'ABN' : 'Tax ID'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${config.documentTitle} - ${business.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 13px; }
  .header { border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 22px; margin-bottom: 4px; }
  .header .authority { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .meta-box { background: #f8f9fa; padding: 16px; border-radius: 6px; border: 1px solid #e9ecef; }
  .meta-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 8px; }
  .meta-box p { font-size: 13px; margin-bottom: 2px; }
  .meta-box .value { font-weight: 600; }
  .section { margin-bottom: 30px; }
  .section h2 { font-size: 16px; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
  th { background: #f8f9fa; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  th.amount { text-align: right; }
  .summary-row { font-weight: 700; background: #f0f4f8; }
  .summary-row td { border-top: 2px solid #1a1a1a; }
  .highlight-box { background: #e8f5e9; border: 1px solid #a5d6a7; padding: 16px; border-radius: 6px; margin-bottom: 30px; }
  .highlight-box.warning { background: #fff3e0; border-color: #ffcc80; }
  .highlight-box h3 { font-size: 14px; margin-bottom: 8px; }
  .highlight-box .big-number { font-size: 24px; font-weight: 700; }
  .vat-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .vat-box { padding: 16px; border-radius: 6px; text-align: center; }
  .vat-box.output { background: #e3f2fd; border: 1px solid #90caf9; }
  .vat-box.input { background: #fce4ec; border: 1px solid #f48fb1; }
  .vat-box.net { background: ${netVat >= 0 ? '#fff3e0' : '#e8f5e9'}; border: 1px solid ${netVat >= 0 ? '#ffcc80' : '#a5d6a7'}; }
  .vat-box .label { font-size: 11px; text-transform: uppercase; color: #666; }
  .vat-box .amount { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .disclaimer { background: #f5f5f5; padding: 16px; border-radius: 6px; border-left: 4px solid #ff9800; margin-top: 30px; font-size: 11px; color: #666; }
  .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #dee2e6; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <div class="authority">Prepared for filing with ${config.taxAuthorityFullName} (${config.taxAuthorityName})</div>
    <h1>${config.documentTitle}</h1>
    <p>Period: ${periodStart} to ${periodEnd} | Currency: ${currency}</p>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h3>Business Details</h3>
      <p class="value">${business.name}</p>
      ${business.legal_name ? `<p>${business.legal_name}</p>` : ''}
      ${addressStr ? `<p>${addressStr}</p>` : ''}
      ${business.contact_email ? `<p>${business.contact_email}</p>` : ''}
    </div>
    <div class="meta-box">
      <h3>Tax Identifiers</h3>
      ${business.tax_id ? `<p>${taxIdLabel}: <span class="value">${business.tax_id}</span></p>` : `<p>${taxIdLabel}: <em>Not provided</em></p>`}
      ${business.vat_registration_number ? `<p>${config.vatLabel} Reg: <span class="value">${business.vat_registration_number}</span></p>` : (config.hasVat ? `<p>${config.vatLabel} Reg: <em>Not provided</em></p>` : '')}
      ${business.cac_number ? `<p>Company Reg: <span class="value">${business.cac_number}</span></p>` : ''}
    </div>
  </div>

  <!-- INCOME STATEMENT -->
  <div class="section">
    <h2>Income Statement</h2>
    <table>
      <tr><td>Gross Revenue (Invoiced)</td><td class="amount">${fmt(totalRevenue, sym)}</td></tr>
      <tr><td>Less: Credit Note Adjustments</td><td class="amount">(${fmt(creditNoteTotal, sym)})</td></tr>
      <tr class="summary-row"><td>Net Revenue</td><td class="amount">${fmt(totalRevenue - creditNoteTotal, sym)}</td></tr>
      <tr><td>Total Expenses</td><td class="amount">(${fmt(totalExpenses, sym)})</td></tr>
      <tr class="summary-row"><td><strong>Net Income</strong></td><td class="amount"><strong>${fmt(netIncome, sym)}</strong></td></tr>
    </table>
  </div>

  <!-- CASH POSITION -->
  <div class="highlight-box${totalPaymentsReceived < totalRevenue ? ' warning' : ''}">
    <h3>Cash Position</h3>
    <p>Payments Received: <span class="big-number">${fmt(totalPaymentsReceived, sym)}</span></p>
    <p style="margin-top:4px;font-size:12px;">Collection Rate: ${totalRevenue > 0 ? Math.round((totalPaymentsReceived / totalRevenue) * 100) : 0}%</p>
  </div>

  ${config.hasVat ? `
  <!-- VAT/GST SUMMARY -->
  <div class="section">
    <h2>${config.vatLabel} Summary</h2>
    <div class="vat-summary">
      <div class="vat-box output">
        <div class="label">Output ${config.vatLabel} (Collected)</div>
        <div class="amount">${fmt(outputVat, sym)}</div>
      </div>
      <div class="vat-box input">
        <div class="label">Input ${config.vatLabel} (Paid)</div>
        <div class="amount">${fmt(inputVat, sym)}</div>
      </div>
      <div class="vat-box net">
        <div class="label">Net ${config.vatLabel} ${netVat >= 0 ? 'Payable' : 'Refundable'}</div>
        <div class="amount">${fmt(Math.abs(netVat), sym)}</div>
      </div>
    </div>
    <table>
      <tr><td>${config.vatLabel} collected on ${invoices.length} invoices @ standard rate ${config.standardVatRate}%</td><td class="amount">${fmt(outputVat, sym)}</td></tr>
      <tr><td>${config.vatLabel} paid on ${expenses.filter(e => Number(e.tax_amount) > 0).length} expenses (input ${config.vatLabel})</td><td class="amount">(${fmt(inputVat, sym)})</td></tr>
      <tr class="summary-row"><td>Net ${config.vatLabel} ${netVat >= 0 ? 'Due to ' + config.taxAuthorityName : 'Refundable from ' + config.taxAuthorityName}</td><td class="amount">${fmt(Math.abs(netVat), sym)}</td></tr>
    </table>
  </div>
  ` : ''}

  <!-- REVENUE REGISTER -->
  <div class="section">
    <h2>Revenue Register (${invoices.length} invoices)</h2>
    ${invoices.length > 0 ? `
    <table>
      <thead>
        <tr><th>Invoice #</th><th>Date</th><th>Status</th><th class="amount">Subtotal</th>${config.hasVat ? `<th class="amount">${config.vatLabel}</th>` : ''}<th class="amount">Total</th></tr>
      </thead>
      <tbody>
        ${invoices.map(inv => `
        <tr>
          <td>${inv.invoice_number}</td>
          <td>${inv.issue_date || inv.created_at?.split('T')[0] || '-'}</td>
          <td>${inv.status}</td>
          <td class="amount">${fmt(Number(inv.subtotal || 0), sym)}</td>
          ${config.hasVat ? `<td class="amount">${fmt(Number(inv.tax_amount || 0), sym)}</td>` : ''}
          <td class="amount">${fmt(Number(inv.total_amount || 0), sym)}</td>
        </tr>`).join('')}
        <tr class="summary-row">
          <td colspan="${config.hasVat ? 3 : 3}">Total</td>
          <td class="amount">${fmt(totalRevenue, sym)}</td>
          ${config.hasVat ? `<td class="amount">${fmt(outputVat, sym)}</td>` : ''}
          <td class="amount">${fmt(totalInvoiceAmount, sym)}</td>
        </tr>
      </tbody>
    </table>
    ` : '<p>No invoices issued in this period.</p>'}
  </div>

  <!-- EXPENSE REGISTER -->
  <div class="section">
    <h2>Expense Register (${expenses.length} expenses)</h2>
    ${expenses.length > 0 ? `
    <table>
      <thead>
        <tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th>${config.hasVat ? `<th class="amount">${config.vatLabel}</th>` : ''}<th class="amount">Amount</th></tr>
      </thead>
      <tbody>
        ${expenses.map(exp => `
        <tr>
          <td>${exp.expense_date || '-'}</td>
          <td>${exp.category}</td>
          <td>${exp.vendor || '-'}</td>
          <td>${exp.description || '-'}</td>
          ${config.hasVat ? `<td class="amount">${fmt(Number(exp.tax_amount || 0), sym)}</td>` : ''}
          <td class="amount">${fmt(Number(exp.amount || 0), sym)}</td>
        </tr>`).join('')}
        <tr class="summary-row">
          <td colspan="${config.hasVat ? 4 : 4}">Total</td>
          ${config.hasVat ? `<td class="amount">${fmt(inputVat, sym)}</td>` : ''}
          <td class="amount">${fmt(totalExpenses, sym)}</td>
        </tr>
      </tbody>
    </table>
    ` : '<p>No expenses recorded in this period.</p>'}
  </div>

  ${creditNotes.length > 0 ? `
  <!-- CREDIT NOTES -->
  <div class="section">
    <h2>Credit Notes (${creditNotes.length})</h2>
    <table>
      <thead><tr><th>Credit Note #</th><th>Date</th><th>Reason</th><th class="amount">Amount</th></tr></thead>
      <tbody>
        ${creditNotes.map(cn => `
        <tr>
          <td>${cn.credit_note_number}</td>
          <td>${cn.issued_at?.split('T')[0] || '-'}</td>
          <td>${cn.reason || '-'}</td>
          <td class="amount">${fmt(Number(cn.amount || 0), sym)}</td>
        </tr>`).join('')}
        <tr class="summary-row"><td colspan="3">Total</td><td class="amount">${fmt(creditNoteTotal, sym)}</td></tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  ${config.additionalTaxes?.length ? `
  <div class="section">
    <h2>Additional Tax Obligations</h2>
    <p style="font-size:12px;">The following taxes may also apply to your business. Please consult ${config.disclaimerAuthority} for guidance:</p>
    <ul style="margin-top:8px;padding-left:20px;">
      ${config.additionalTaxes.map(t => `<li>${t}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="disclaimer">
    <strong>⚠ Important Disclaimer</strong><br>
    This document is generated from self-reported data recorded in Invoicemonk and does not constitute a tax return, official filing, or professional tax advice. 
    Figures may not reflect all taxable transactions. Before filing with ${config.taxAuthorityName} (${config.taxAuthorityFullName}), 
    please have this document reviewed by ${config.disclaimerAuthority}. 
    Invoicemonk is not responsible for the accuracy of tax calculations or filing outcomes.
  </div>

  <div class="footer">
    Generated by Invoicemonk on ${new Date().toISOString().split('T')[0]} at ${new Date().toISOString().split('T')[1]?.split('.')[0] || ''} UTC<br>
    This document is for preparation purposes only.
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = claimsData.claims.sub

    // Rate limit: 5/min
    const rateLimited = checkRateLimit(`tax-pack:${userId}`, 5, 60000)
    if (rateLimited) return rateLimitResponse(corsHeaders)

    const body = await req.json()
    const { business_id, currency_account_id, period_start, period_end } = body

    if (!business_id || !currency_account_id || !period_start || !period_end) {
      return new Response(JSON.stringify({ error: 'business_id, currency_account_id, period_start, period_end are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check platform admin
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'platform_admin' })
    const isPlatformAdmin = !!isAdmin

    // Verify business membership
    if (!isPlatformAdmin) {
      const { data: membership } = await supabase
        .from('business_members')
        .select('id')
        .eq('user_id', userId)
        .eq('business_id', business_id)
        .maybeSingle()

      if (!membership) {
        return new Response(JSON.stringify({ error: 'You do not have access to this business' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Tier check - Professional minimum
      const { data: tierCheck } = await supabaseUser.rpc('check_tier_limit_business', {
        _business_id: business_id,
        _feature: 'reports_enabled',
      })
      if (!tierCheck?.allowed) {
        return new Response(JSON.stringify({ error: 'Tax Pack requires a Professional subscription or higher.', upgrade_required: true }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Fetch business
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business_id)
      .single()

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get jurisdiction config
    const jurisdiction = business.jurisdiction || 'US'
    const config = TAX_PACK_CONFIG[jurisdiction]
    if (!config) {
      return new Response(JSON.stringify({ error: `Unsupported jurisdiction: ${jurisdiction}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get currency from currency account
    const { data: currencyAccount } = await supabase
      .from('currency_accounts')
      .select('currency')
      .eq('id', currency_account_id)
      .eq('business_id', business_id)
      .single()

    if (!currencyAccount) {
      return new Response(JSON.stringify({ error: 'Currency account not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const currency = currencyAccount.currency

    // Fetch invoices (non-draft, non-voided)
    const { data: invoices = [] } = await supabase
      .from('invoices')
      .select('invoice_number, issue_date, created_at, status, subtotal, tax_amount, total_amount')
      .eq('business_id', business_id)
      .eq('currency_account_id', currency_account_id)
      .not('status', 'in', '("draft","voided")')
      .gte('issue_date', period_start)
      .lte('issue_date', period_end)
      .order('issue_date', { ascending: true })

    // Fetch expenses
    const { data: expenses = [] } = await supabase
      .from('expenses')
      .select('expense_date, category, vendor, description, amount, tax_amount')
      .eq('business_id', business_id)
      .eq('currency_account_id', currency_account_id)
      .gte('expense_date', period_start)
      .lte('expense_date', period_end)
      .order('expense_date', { ascending: true })

    // Fetch payments for the invoices in this period
    const invoiceIds = (invoices || []).map((i: any) => i.id).filter(Boolean)
    let payments: any[] = []
    if (invoiceIds.length > 0) {
      // Get payments through invoices
      const { data: paymentData = [] } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .in('invoice_id', invoiceIds)
        .gte('payment_date', period_start)
        .lte('payment_date', period_end)
      payments = paymentData || []
    }
    
    // Also get payments by date range via currency account
    const { data: periodPayments = [] } = await supabase
      .from('payments')
      .select('amount, payment_date, invoice_id')
      .eq('currency_account_id', currency_account_id)
      .gte('payment_date', period_start)
      .lte('payment_date', period_end)
    
    // Dedupe and use period payments if available
    if ((periodPayments || []).length > 0) {
      payments = periodPayments || []
    }

    // Fetch credit notes
    const { data: creditNotes = [] } = await supabase
      .from('credit_notes')
      .select('credit_note_number, issued_at, reason, amount')
      .eq('business_id', business_id)
      .eq('currency_account_id', currency_account_id)
      .gte('issued_at', period_start)
      .lte('issued_at', period_end + 'T23:59:59')
      .order('issued_at', { ascending: true })

    // Generate HTML
    const html = generateHtml(business, config, period_start, period_end, invoices || [], expenses || [], payments, creditNotes || [], currency)

    // Log to export_manifests
    const userEmail = claimsData.claims.email || 'unknown'
    // Simple hash of the content
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(html))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    await supabase.from('export_manifests').insert({
      actor_id: userId,
      actor_email: userEmail,
      business_id: business_id,
      export_type: 'tax-pack',
      format: 'html',
      record_count: (invoices?.length || 0) + (expenses?.length || 0),
      scope: { period_start, period_end, currency_account_id, jurisdiction },
      integrity_hash: hashHex,
    })

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="tax-pack-${period_start}-to-${period_end}.html"`,
      },
    })
  } catch (error) {
    captureException(error, { function_name: 'generate-tax-pack' })
    console.error('generate-tax-pack error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
