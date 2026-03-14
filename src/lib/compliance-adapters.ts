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

  /** Whether regulatory submission is required for this jurisdiction */
  submissionRequired: boolean;

  /** Supported XML/document formats (e.g., 'UBL_2_1', 'XRECHNUNG') */
  supportedFormats: string[];
}

/**
 * Registry of all supported compliance adapters.
 * Key format: regulatorCode (e.g., 'NGA-NRS')
 */
export const COMPLIANCE_ADAPTERS: Record<string, ComplianceAdapter> = {
  // ============= AFRICA =============
  'NGA-NRS': {
    regulatorCode: 'NGA-NRS',
    countryCode: 'NG',
    supportedArtifacts: ['IRN', 'UBL_3_0', 'CRYPTO_STAMP'],
    displayName: 'Nigeria — National Revenue Service',
    regulatorName: 'National Revenue Service',
    eInvoicingAvailable: false,
    defaultTaxRate: 7.5,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'GHA-GRA': {
    regulatorCode: 'GHA-GRA',
    countryCode: 'GH',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Ghana — Ghana Revenue Authority',
    regulatorName: 'Ghana Revenue Authority',
    eInvoicingAvailable: false,
    defaultTaxRate: 15,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'KEN-KRA': {
    regulatorCode: 'KEN-KRA',
    countryCode: 'KE',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Kenya — Kenya Revenue Authority',
    regulatorName: 'Kenya Revenue Authority',
    eInvoicingAvailable: false,
    defaultTaxRate: 16,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'ZAF-SARS': {
    regulatorCode: 'ZAF-SARS',
    countryCode: 'ZA',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'South Africa — SARS',
    regulatorName: 'South African Revenue Service',
    eInvoicingAvailable: false,
    defaultTaxRate: 15,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'EGY-ETA': {
    regulatorCode: 'EGY-ETA',
    countryCode: 'EG',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Egypt — Egyptian Tax Authority',
    regulatorName: 'Egyptian Tax Authority',
    eInvoicingAvailable: true,
    defaultTaxRate: 14,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'RWA-RRA': {
    regulatorCode: 'RWA-RRA',
    countryCode: 'RW',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Rwanda — Rwanda Revenue Authority',
    regulatorName: 'Rwanda Revenue Authority',
    eInvoicingAvailable: true,
    defaultTaxRate: 18,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'TZA-TRA': {
    regulatorCode: 'TZA-TRA',
    countryCode: 'TZ',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Tanzania — Tanzania Revenue Authority',
    regulatorName: 'Tanzania Revenue Authority',
    eInvoicingAvailable: true,
    defaultTaxRate: 18,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'UGA-URA': {
    regulatorCode: 'UGA-URA',
    countryCode: 'UG',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Uganda — Uganda Revenue Authority',
    regulatorName: 'Uganda Revenue Authority',
    eInvoicingAvailable: true,
    defaultTaxRate: 18,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'SEN-DGID': {
    regulatorCode: 'SEN-DGID',
    countryCode: 'SN',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Senegal — DGID',
    regulatorName: 'Direction Générale des Impôts et Domaines',
    eInvoicingAvailable: false,
    defaultTaxRate: 18,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },

  // ============= AMERICAS =============
  'USA-IRS': {
    regulatorCode: 'USA-IRS',
    countryCode: 'US',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'United States — IRS',
    regulatorName: 'Internal Revenue Service',
    eInvoicingAvailable: false,
    defaultTaxRate: 0,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'CAN-CRA': {
    regulatorCode: 'CAN-CRA',
    countryCode: 'CA',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Canada — CRA',
    regulatorName: 'Canada Revenue Agency',
    eInvoicingAvailable: false,
    defaultTaxRate: 5,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'MEX-SAT': {
    regulatorCode: 'MEX-SAT',
    countryCode: 'MX',
    supportedArtifacts: ['CFDI'],
    displayName: 'Mexico — SAT',
    regulatorName: 'Servicio de Administración Tributaria',
    eInvoicingAvailable: true,
    defaultTaxRate: 16,
    submissionRequired: false,
    supportedFormats: ['CFDI_4_0'],
  },
  'BRA-RFB': {
    regulatorCode: 'BRA-RFB',
    countryCode: 'BR',
    supportedArtifacts: ['NFE'],
    displayName: 'Brazil — Receita Federal',
    regulatorName: 'Receita Federal do Brasil',
    eInvoicingAvailable: true,
    defaultTaxRate: 18,
    submissionRequired: false,
    supportedFormats: ['NFE_4_0'],
  },
  'ARG-AFIP': {
    regulatorCode: 'ARG-AFIP',
    countryCode: 'AR',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Argentina — AFIP',
    regulatorName: 'Administración Federal de Ingresos Públicos',
    eInvoicingAvailable: true,
    defaultTaxRate: 21,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'CHL-SII': {
    regulatorCode: 'CHL-SII',
    countryCode: 'CL',
    supportedArtifacts: ['DTE'],
    displayName: 'Chile — SII',
    regulatorName: 'Servicio de Impuestos Internos',
    eInvoicingAvailable: true,
    defaultTaxRate: 19,
    submissionRequired: false,
    supportedFormats: ['DTE'],
  },
  'COL-DIAN': {
    regulatorCode: 'COL-DIAN',
    countryCode: 'CO',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Colombia — DIAN',
    regulatorName: 'Dirección de Impuestos y Aduanas Nacionales',
    eInvoicingAvailable: true,
    defaultTaxRate: 19,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },

  // ============= EUROPE =============
  'GBR-HMRC': {
    regulatorCode: 'GBR-HMRC',
    countryCode: 'GB',
    supportedArtifacts: ['MTD_VAT'],
    displayName: 'United Kingdom — HMRC',
    regulatorName: 'HM Revenue & Customs',
    eInvoicingAvailable: false,
    defaultTaxRate: 20,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'DEU-BFINV': {
    regulatorCode: 'DEU-BFINV',
    countryCode: 'DE',
    supportedArtifacts: ['XRECHNUNG', 'ZUGFERD'],
    displayName: 'Germany — Federal Finance Ministry',
    regulatorName: 'Bundesfinanzministerium',
    eInvoicingAvailable: false,
    defaultTaxRate: 19,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1', 'XRECHNUNG', 'ZUGFERD'],
  },
  'FRA-DGFIP': {
    regulatorCode: 'FRA-DGFIP',
    countryCode: 'FR',
    supportedArtifacts: ['FACTUR_X', 'CHORUS_PRO'],
    displayName: 'France — DGFiP',
    regulatorName: 'Direction Générale des Finances Publiques',
    eInvoicingAvailable: false,
    defaultTaxRate: 20,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1', 'FACTUR_X'],
  },
  'NLD-TAX': {
    regulatorCode: 'NLD-TAX',
    countryCode: 'NL',
    supportedArtifacts: ['UBL_2_1', 'SI_UBL'],
    displayName: 'Netherlands — Belastingdienst',
    regulatorName: 'Belastingdienst',
    eInvoicingAvailable: false,
    defaultTaxRate: 21,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1', 'SI_UBL_2_0'],
  },
  'ESP-AEAT': {
    regulatorCode: 'ESP-AEAT',
    countryCode: 'ES',
    supportedArtifacts: ['FACTURAE'],
    displayName: 'Spain — AEAT',
    regulatorName: 'Agencia Estatal de Administración Tributaria',
    eInvoicingAvailable: false,
    defaultTaxRate: 21,
    submissionRequired: false,
    supportedFormats: ['FACTURAE_3_2_2'],
  },
  'ITA-SDI': {
    regulatorCode: 'ITA-SDI',
    countryCode: 'IT',
    supportedArtifacts: ['FE_SDI'],
    displayName: 'Italy — SDI (Agenzia delle Entrate)',
    regulatorName: 'Sistema di Interscambio',
    eInvoicingAvailable: true,
    defaultTaxRate: 22,
    submissionRequired: true,
    supportedFormats: ['FATTURA_PA'],
  },
  'POL-KAS': {
    regulatorCode: 'POL-KAS',
    countryCode: 'PL',
    supportedArtifacts: ['KSEF'],
    displayName: 'Poland — KAS (KSeF)',
    regulatorName: 'Krajowa Administracja Skarbowa',
    eInvoicingAvailable: true,
    defaultTaxRate: 23,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'SWE-SKV': {
    regulatorCode: 'SWE-SKV',
    countryCode: 'SE',
    supportedArtifacts: ['PEPPOL_BIS'],
    displayName: 'Sweden — Skatteverket',
    regulatorName: 'Skatteverket',
    eInvoicingAvailable: false,
    defaultTaxRate: 25,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1', 'PEPPOL_BIS_3_0'],
  },
  'IRL-REV': {
    regulatorCode: 'IRL-REV',
    countryCode: 'IE',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Ireland — Revenue',
    regulatorName: 'Office of the Revenue Commissioners',
    eInvoicingAvailable: false,
    defaultTaxRate: 23,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'BEL-SPF': {
    regulatorCode: 'BEL-SPF',
    countryCode: 'BE',
    supportedArtifacts: ['UBL_2_1', 'PEPPOL_BIS'],
    displayName: 'Belgium — SPF Finances',
    regulatorName: 'Service Public Fédéral Finances',
    eInvoicingAvailable: false,
    defaultTaxRate: 21,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1', 'PEPPOL_BIS_3_0'],
  },
  'CHE-ESTV': {
    regulatorCode: 'CHE-ESTV',
    countryCode: 'CH',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Switzerland — ESTV',
    regulatorName: 'Eidgenössische Steuerverwaltung',
    eInvoicingAvailable: false,
    defaultTaxRate: 8.1,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'BGR-NRA': {
    regulatorCode: 'BGR-NRA',
    countryCode: 'BG',
    supportedArtifacts: ['EN_16931', 'SAF_T'],
    displayName: 'Bulgaria — National Revenue Agency',
    regulatorName: 'National Revenue Agency (НАП)',
    eInvoicingAvailable: false,
    defaultTaxRate: 20,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1', 'EN_16931'],
  },
  'ROU-ANAF': {
    regulatorCode: 'ROU-ANAF',
    countryCode: 'RO',
    supportedArtifacts: ['E_FACTURA'],
    displayName: 'Romania — ANAF',
    regulatorName: 'Agenția Națională de Administrare Fiscală',
    eInvoicingAvailable: true,
    defaultTaxRate: 19,
    submissionRequired: true,
    supportedFormats: ['UBL_2_1'],
  },
  'HUN-NAV': {
    regulatorCode: 'HUN-NAV',
    countryCode: 'HU',
    supportedArtifacts: ['ONLINE_SZAMLA'],
    displayName: 'Hungary — NAV',
    regulatorName: 'Nemzeti Adó- és Vámhivatal',
    eInvoicingAvailable: true,
    defaultTaxRate: 27,
    submissionRequired: true,
    supportedFormats: ['NAV_XML_3_0'],
  },
  'SRB-SEF': {
    regulatorCode: 'SRB-SEF',
    countryCode: 'RS',
    supportedArtifacts: ['SEF_INVOICE'],
    displayName: 'Serbia — SEF',
    regulatorName: 'Sistem Elektronskih Faktura',
    eInvoicingAvailable: true,
    defaultTaxRate: 20,
    submissionRequired: true,
    supportedFormats: ['UBL_2_1'],
  },

  // ============= ASIA-PACIFIC =============
  'IND-GSTN': {
    regulatorCode: 'IND-GSTN',
    countryCode: 'IN',
    supportedArtifacts: ['IRN_GST'],
    displayName: 'India — GSTN',
    regulatorName: 'Goods and Services Tax Network',
    eInvoicingAvailable: true,
    defaultTaxRate: 18,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'JPN-NTA': {
    regulatorCode: 'JPN-NTA',
    countryCode: 'JP',
    supportedArtifacts: ['PEPPOL_BIS'],
    displayName: 'Japan — NTA',
    regulatorName: 'National Tax Agency',
    eInvoicingAvailable: false,
    defaultTaxRate: 10,
    submissionRequired: false,
    supportedFormats: ['PEPPOL_BIS_3_0'],
  },
  'SGP-IRAS': {
    regulatorCode: 'SGP-IRAS',
    countryCode: 'SG',
    supportedArtifacts: ['PEPPOL_BIS'],
    displayName: 'Singapore — IRAS',
    regulatorName: 'Inland Revenue Authority of Singapore',
    eInvoicingAvailable: false,
    defaultTaxRate: 9,
    submissionRequired: false,
    supportedFormats: ['PEPPOL_BIS_3_0'],
  },
  'ARE-FTA': {
    regulatorCode: 'ARE-FTA',
    countryCode: 'AE',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'UAE — Federal Tax Authority',
    regulatorName: 'Federal Tax Authority',
    eInvoicingAvailable: false,
    defaultTaxRate: 5,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'SAU-ZATCA': {
    regulatorCode: 'SAU-ZATCA',
    countryCode: 'SA',
    supportedArtifacts: ['FATOORAH'],
    displayName: 'Saudi Arabia — ZATCA',
    regulatorName: 'Zakat, Tax and Customs Authority',
    eInvoicingAvailable: true,
    defaultTaxRate: 15,
    submissionRequired: true,
    supportedFormats: ['UBL_2_1'],
  },
  'MYS-LHDN': {
    regulatorCode: 'MYS-LHDN',
    countryCode: 'MY',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Malaysia — LHDN',
    regulatorName: 'Lembaga Hasil Dalam Negeri',
    eInvoicingAvailable: true,
    defaultTaxRate: 8,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'IDN-DJP': {
    regulatorCode: 'IDN-DJP',
    countryCode: 'ID',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Indonesia — DJP',
    regulatorName: 'Direktorat Jenderal Pajak',
    eInvoicingAvailable: false,
    defaultTaxRate: 11,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'PHL-BIR': {
    regulatorCode: 'PHL-BIR',
    countryCode: 'PH',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'Philippines — BIR',
    regulatorName: 'Bureau of Internal Revenue',
    eInvoicingAvailable: false,
    defaultTaxRate: 12,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
  },
  'AUS-ATO': {
    regulatorCode: 'AUS-ATO',
    countryCode: 'AU',
    supportedArtifacts: ['PEPPOL_BIS'],
    displayName: 'Australia — ATO',
    regulatorName: 'Australian Taxation Office',
    eInvoicingAvailable: false,
    defaultTaxRate: 10,
    submissionRequired: false,
    supportedFormats: ['PEPPOL_BIS_3_0'],
  },
  'NZL-IRD': {
    regulatorCode: 'NZL-IRD',
    countryCode: 'NZ',
    supportedArtifacts: ['UBL_2_1'],
    displayName: 'New Zealand — IRD',
    regulatorName: 'Inland Revenue Department',
    eInvoicingAvailable: false,
    defaultTaxRate: 15,
    submissionRequired: false,
    supportedFormats: ['UBL_2_1'],
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
