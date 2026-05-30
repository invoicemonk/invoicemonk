/**
 * Tax report jurisdiction resolution.
 * The seed data lives in the `tax_report_mappings` table; this module just
 * picks which jurisdiction bucket to use for a business.
 */

export type TaxReportJurisdiction = 'US' | 'GB' | 'EU' | 'NG' | 'XX';

// ISO-3166 alpha-2 codes considered part of the EU VAT area for reporting.
const EU_MEMBER_STATES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
]);

export function resolveTaxJurisdiction(
  businessJurisdiction?: string | null,
): TaxReportJurisdiction {
  if (!businessJurisdiction) return 'XX';
  const code = businessJurisdiction.trim().toUpperCase();
  if (code === 'US') return 'US';
  if (code === 'GB' || code === 'UK') return 'GB';
  if (code === 'NG') return 'NG';
  if (EU_MEMBER_STATES.has(code)) return 'EU';
  return 'XX';
}

export function getJurisdictionLabel(j: TaxReportJurisdiction): string {
  switch (j) {
    case 'US': return 'United States — Schedule C';
    case 'GB': return 'United Kingdom — Self-Assessment SA103';
    case 'EU': return 'EU — VAT-aware summary';
    case 'NG': return 'Nigeria — Deductible expenses';
    case 'XX': return 'Generic deductible expense report';
  }
}
