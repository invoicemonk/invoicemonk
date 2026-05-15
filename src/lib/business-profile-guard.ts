import { isIssuerTaxIdRequired, isIssuerCacRequired } from './jurisdiction-config';

/**
 * Checks business profile completeness for invoice issuance.
 * Returns an array of missing field labels, or empty if complete.
 */
export function getBusinessProfileMissingFields(business: {
  name?: string | null;
  legal_name?: string | null;
  contact_email?: string | null;
  jurisdiction?: string | null;
  tax_id?: string | null;
  cac_number?: string | null;
  address?: unknown;
  entity_type?: string | null;
} | null | undefined): string[] {
  if (!business) return ['Business Profile'];

  const missing: string[] = [];

  if (!business.name?.trim()) missing.push('Business Name');
  if (!business.contact_email?.trim()) missing.push('Contact Email');
  if (!business.jurisdiction?.trim()) missing.push('Country');

  const address = business.address as { country?: string } | null;
  if (!address?.country?.trim()) missing.push('Address Country');

  const isNonIndividual = business.entity_type !== 'individual';

  // Business entities require legal name
  if (isNonIndividual && !business.legal_name?.trim()) {
    missing.push('Legal Name');
  }

  // Tax ID required for: any non-individual, OR jurisdictions that mandate
  // the issuer tax ID on every invoice (e.g. Nigeria FIRS, Kenya KRA, France SIREN).
  const taxIdRequired = isNonIndividual || isIssuerTaxIdRequired(business.jurisdiction);
  if (taxIdRequired && !business.tax_id?.trim()) {
    missing.push('Tax ID');
  }

  // CAC / commercial registration required for non-individuals in strict-regime jurisdictions.
  if (isNonIndividual && isIssuerCacRequired(business.jurisdiction) && !business.cac_number?.trim()) {
    missing.push('Commercial Registration');
  }

  return missing;
}
