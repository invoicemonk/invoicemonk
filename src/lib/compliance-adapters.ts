/**
 * Compliance Adapter Pattern
 * 
 * Defines jurisdiction-specific regulatory configurations.
 * All government compliance logic must:
 * - Live behind these adapters
 * - Be keyed by regulatorCode
 * - Never branch core invoice/receipt/accounting logic on regulator names
 */

export interface ComplianceAdapter {
  /** Unique identifier for this regulator (e.g., 'NGA-NRS', 'GBR-HMRC') */
  regulatorCode: string;
  
  /** ISO-2 country code */
  countryCode: string;
  
  /** Supported compliance artifacts (e.g., IRN, UBL, VAT) */
  supportedArtifacts: string[];
  
  /** Display name following "Country — Regulator Name" pattern */
  displayName: string;
  
  /** Regulator's official name */
  regulatorName: string;
  
  /** Whether e-invoicing integration is available */
  eInvoicingAvailable: boolean;
  
  /** Default tax rate for this jurisdiction (if applicable) */
  defaultTaxRate?: number;
}

/**
 * Registry of all supported compliance adapters.
 * Key format: regulatorCode (e.g., 'NGA-NRS')
 */
export const COMPLIANCE_ADAPTERS: Record<string, ComplianceAdapter> = {
  'NGA-NRS': {
    regulatorCode: 'NGA-NRS',
    countryCode: 'NG',
    supportedArtifacts: ['IRN', 'UBL_3_0', 'CRYPTO_STAMP'],
    displayName: 'Nigeria — National Revenue Service',
    regulatorName: 'National Revenue Service',
    eInvoicingAvailable: false, // Future integration
    defaultTaxRate: 7.5,
  },
  'GBR-HMRC': {
    regulatorCode: 'GBR-HMRC',
    countryCode: 'GB',
    supportedArtifacts: ['MTD_VAT'],
    displayName: 'United Kingdom — HMRC',
    regulatorName: 'HM Revenue & Customs',
    eInvoicingAvailable: false,
    defaultTaxRate: 20,
  },
  'DEU-BFINV': {
    regulatorCode: 'DEU-BFINV',
    countryCode: 'DE',
    supportedArtifacts: ['XRECHNUNG', 'ZUGFERD'],
    displayName: 'Germany — Federal Finance Ministry',
    regulatorName: 'Bundesfinanzministerium',
    eInvoicingAvailable: false,
    defaultTaxRate: 19,
  },
};

/**
 * Get a compliance adapter by its regulator code.
 * @param regulatorCode The unique regulator identifier
 * @returns ComplianceAdapter or null if not found
 */
export function getComplianceAdapter(regulatorCode: string): ComplianceAdapter | null {
  return COMPLIANCE_ADAPTERS[regulatorCode] || null;
}

/**
 * Get a compliance adapter by country code.
 * Returns the first adapter found for that country.
 * @param countryCode ISO-2 country code
 * @returns ComplianceAdapter or null if not found
 */
export function getComplianceAdapterByCountry(countryCode: string): ComplianceAdapter | null {
  const adapter = Object.values(COMPLIANCE_ADAPTERS).find(
    (a) => a.countryCode === countryCode
  );
  return adapter || null;
}

/**
 * Get display name for a regulator code.
 * Follows the pattern: "Country — Regulator Name"
 * @param regulatorCode The unique regulator identifier
 * @returns Display name or the raw code if not found
 */
export function getRegulatorDisplayName(regulatorCode: string): string {
  const adapter = getComplianceAdapter(regulatorCode);
  return adapter?.displayName || regulatorCode;
}

/**
 * Check if a country has e-invoicing available.
 * @param countryCode ISO-2 country code
 * @returns boolean
 */
export function hasEInvoicingSupport(countryCode: string): boolean {
  const adapter = getComplianceAdapterByCountry(countryCode);
  return adapter?.eInvoicingAvailable || false;
}

/**
 * Get all available regulator codes for a given country.
 * @param countryCode ISO-2 country code
 * @returns Array of regulator codes
 */
export function getRegulatorCodesForCountry(countryCode: string): string[] {
  return Object.values(COMPLIANCE_ADAPTERS)
    .filter((a) => a.countryCode === countryCode)
    .map((a) => a.regulatorCode);
}
