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

  // Business entities require more fields
  if (business.entity_type !== 'individual') {
    if (!business.legal_name?.trim()) missing.push('Legal Name');
    if (!business.tax_id?.trim()) missing.push('Tax ID');
  }

  return missing;
}
