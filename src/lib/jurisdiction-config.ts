// Centralized jurisdiction configuration for dynamic compliance fields

export interface JurisdictionConfig {
  name: string;
  currency: string;
  // Business tax labels
  taxIdLabel: string;
  taxIdPlaceholder: string;
  taxIdHint: string;
  showCac: boolean;
  cacLabel?: string;
  cacPlaceholder?: string;
  cacHint?: string;
  cacRequired?: boolean;
  showVat: boolean;
  vatLabel?: string;
  vatPlaceholder?: string;
  vatHint?: string;
  showStateTax?: boolean;
  stateTaxLabel?: string;
  stateTaxPlaceholder?: string;
  // Client-specific labels
  clientTaxIdLabel: string;
  clientTaxIdPlaceholder: string;
  clientTaxIdHint: string;
  showClientReg: boolean;
  clientRegLabel?: string;
  clientRegPlaceholder?: string;
  clientRegHint?: string;
  phonePrefix: string;
}

export const JURISDICTION_CONFIG: Record<string, JurisdictionConfig> = {
  NG: {
    name: 'Nigeria',
    currency: 'NGN',
    taxIdLabel: 'Tax Identification Number (TIN)',
    taxIdPlaceholder: '12345678-0001',
    taxIdHint: 'Your FIRS-issued Tax Identification Number',
    showCac: true,
    cacLabel: 'CAC Registration Number',
    cacPlaceholder: 'RC 123456',
    cacHint: 'Corporate Affairs Commission registration number for registered companies',
    cacRequired: false,
    showVat: true,
    vatLabel: 'VAT Registration Number',
    vatPlaceholder: '12345678',
    vatHint: 'Your FIRS-issued VAT registration number',
    // Client-specific
    clientTaxIdLabel: 'Tax Identification Number (TIN)',
    clientTaxIdPlaceholder: '12345678-0001',
    clientTaxIdHint: 'Required for B2B invoices per FIRS regulations',
    showClientReg: true,
    clientRegLabel: 'CAC Registration Number',
    clientRegPlaceholder: 'RC 123456',
    clientRegHint: 'Corporate Affairs Commission registration number',
    phonePrefix: '+234',
  },
  US: {
    name: 'United States',
    currency: 'USD',
    taxIdLabel: 'Employer Identification Number (EIN)',
    taxIdPlaceholder: '12-3456789',
    taxIdHint: 'Your IRS-issued EIN or SSN for sole proprietors',
    showCac: false,
    showVat: false,
    showStateTax: true,
    stateTaxLabel: 'State Tax ID',
    stateTaxPlaceholder: 'State-specific format',
    // Client-specific
    clientTaxIdLabel: 'Tax ID (EIN/SSN)',
    clientTaxIdPlaceholder: '12-3456789',
    clientTaxIdHint: 'Employer ID or Social Security Number for 1099 reporting',
    showClientReg: false,
    phonePrefix: '+1',
  },
  GB: {
    name: 'United Kingdom',
    currency: 'GBP',
    taxIdLabel: 'Corporation Tax Reference (UTR)',
    taxIdPlaceholder: '1234567890',
    taxIdHint: 'Your HMRC Unique Taxpayer Reference (10 digits)',
    showCac: true,
    cacLabel: 'Companies House Number',
    cacPlaceholder: '12345678',
    cacHint: 'Your 8-character Companies House registration number',
    cacRequired: false,
    showVat: true,
    vatLabel: 'VAT Registration Number',
    vatPlaceholder: 'GB123456789',
    vatHint: 'Your HMRC-issued VAT number (GB + 9 or 12 digits)',
    // Client-specific
    clientTaxIdLabel: 'VAT Number / UTR',
    clientTaxIdPlaceholder: 'GB123456789',
    clientTaxIdHint: 'For HMRC compliance on B2B invoices',
    showClientReg: true,
    clientRegLabel: 'Companies House Number',
    clientRegPlaceholder: '12345678',
    clientRegHint: '8-character company registration number',
    phonePrefix: '+44',
  },
  CA: {
    name: 'Canada',
    currency: 'CAD',
    taxIdLabel: 'Business Number (BN)',
    taxIdPlaceholder: '123456789RC0001',
    taxIdHint: 'Your 15-character CRA Business Number',
    showCac: false,
    showVat: true,
    vatLabel: 'GST/HST Registration Number',
    vatPlaceholder: '123456789RT0001',
    vatHint: 'Your CRA GST/HST registration number',
    // Client-specific
    clientTaxIdLabel: 'Business Number (BN)',
    clientTaxIdPlaceholder: '123456789RC0001',
    clientTaxIdHint: 'For CRA reporting requirements',
    showClientReg: false,
    phonePrefix: '+1',
  },
  DE: {
    name: 'Germany',
    currency: 'EUR',
    taxIdLabel: 'Steuernummer (Tax Number)',
    taxIdPlaceholder: '123/456/78901',
    taxIdHint: 'Your German tax number from Finanzamt',
    showCac: true,
    cacLabel: 'Handelsregister Number',
    cacPlaceholder: 'HRB 12345',
    cacHint: 'Your commercial register (Handelsregister) entry',
    cacRequired: false,
    showVat: true,
    vatLabel: 'USt-IdNr (VAT ID)',
    vatPlaceholder: 'DE123456789',
    vatHint: 'Your EU VAT identification number',
    // Client-specific
    clientTaxIdLabel: 'Steuernummer',
    clientTaxIdPlaceholder: '123/456/78901',
    clientTaxIdHint: 'Tax number for German clients',
    showClientReg: true,
    clientRegLabel: 'Handelsregister Number',
    clientRegPlaceholder: 'HRB 12345',
    clientRegHint: 'Commercial register entry',
    phonePrefix: '+49',
  },
  FR: {
    name: 'France',
    currency: 'EUR',
    taxIdLabel: 'SIREN Number',
    taxIdPlaceholder: '123456789',
    taxIdHint: 'Your 9-digit SIREN identification number',
    showCac: true,
    cacLabel: 'SIRET Number',
    cacPlaceholder: '12345678901234',
    cacHint: 'Your 14-digit SIRET number (SIREN + NIC)',
    cacRequired: false,
    showVat: true,
    vatLabel: 'TVA Number',
    vatPlaceholder: 'FR12345678901',
    vatHint: 'Your French intra-community VAT number',
    // Client-specific
    clientTaxIdLabel: 'SIREN/SIRET',
    clientTaxIdPlaceholder: '123456789',
    clientTaxIdHint: 'French business identifier',
    showClientReg: true,
    clientRegLabel: 'SIRET Number',
    clientRegPlaceholder: '12345678901234',
    clientRegHint: '14-digit establishment identifier',
    phonePrefix: '+33',
  },
};

// Default config for unknown jurisdictions
export const DEFAULT_JURISDICTION_CONFIG: JurisdictionConfig = {
  name: 'Other',
  currency: 'USD',
  taxIdLabel: 'Tax ID',
  taxIdPlaceholder: 'Enter your tax ID',
  taxIdHint: 'Your tax identification number',
  showCac: false,
  showVat: false,
  // Client-specific defaults
  clientTaxIdLabel: 'Tax ID',
  clientTaxIdPlaceholder: 'Enter tax ID',
  clientTaxIdHint: 'Tax identification number for compliance',
  showClientReg: false,
  phonePrefix: '+1',
};

export function getJurisdictionConfig(jurisdiction: string): JurisdictionConfig {
  return JURISDICTION_CONFIG[jurisdiction] || DEFAULT_JURISDICTION_CONFIG;
}

// Helper to get CAC label based on jurisdiction (for display in invoices)
export function getCacDisplayLabel(jurisdiction: string): string {
  const config = getJurisdictionConfig(jurisdiction);
  if (!config.showCac) return 'Reg No';
  
  switch (jurisdiction) {
    case 'NG':
      return 'CAC';
    case 'GB':
      return 'Co. No';
    case 'DE':
      return 'HRB';
    case 'FR':
      return 'SIRET';
    default:
      return 'Reg No';
  }
}
