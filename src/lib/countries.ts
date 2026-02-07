// Centralized country data for all ISO 3166-1 countries
// This is the single source of truth for country information across the app

export interface Country {
  code: string;        // ISO 3166-1 alpha-2 (e.g., 'NG')
  name: string;        // Full name (e.g., 'Nigeria')
  currency: string;    // ISO 4217 (e.g., 'NGN')
  phonePrefix: string; // Dialing code (e.g., '+234')
  region: string;      // For grouping (e.g., 'africa')
}

// All 195 ISO 3166-1 countries with their default currencies and phone prefixes
export const COUNTRIES: Country[] = [
  // Africa
  { code: 'DZ', name: 'Algeria', currency: 'DZD', phonePrefix: '+213', region: 'africa' },
  { code: 'AO', name: 'Angola', currency: 'AOA', phonePrefix: '+244', region: 'africa' },
  { code: 'BJ', name: 'Benin', currency: 'XOF', phonePrefix: '+229', region: 'africa' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', phonePrefix: '+267', region: 'africa' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', phonePrefix: '+226', region: 'africa' },
  { code: 'BI', name: 'Burundi', currency: 'BIF', phonePrefix: '+257', region: 'africa' },
  { code: 'CV', name: 'Cabo Verde', currency: 'CVE', phonePrefix: '+238', region: 'africa' },
  { code: 'CM', name: 'Cameroon', currency: 'XAF', phonePrefix: '+237', region: 'africa' },
  { code: 'CF', name: 'Central African Republic', currency: 'XAF', phonePrefix: '+236', region: 'africa' },
  { code: 'TD', name: 'Chad', currency: 'XAF', phonePrefix: '+235', region: 'africa' },
  { code: 'KM', name: 'Comoros', currency: 'KMF', phonePrefix: '+269', region: 'africa' },
  { code: 'CG', name: 'Congo', currency: 'XAF', phonePrefix: '+242', region: 'africa' },
  { code: 'CD', name: 'Congo (Democratic Republic)', currency: 'CDF', phonePrefix: '+243', region: 'africa' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', phonePrefix: '+225', region: 'africa' },
  { code: 'DJ', name: 'Djibouti', currency: 'DJF', phonePrefix: '+253', region: 'africa' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', phonePrefix: '+20', region: 'africa' },
  { code: 'GQ', name: 'Equatorial Guinea', currency: 'XAF', phonePrefix: '+240', region: 'africa' },
  { code: 'ER', name: 'Eritrea', currency: 'ERN', phonePrefix: '+291', region: 'africa' },
  { code: 'SZ', name: 'Eswatini', currency: 'SZL', phonePrefix: '+268', region: 'africa' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', phonePrefix: '+251', region: 'africa' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', phonePrefix: '+241', region: 'africa' },
  { code: 'GM', name: 'Gambia', currency: 'GMD', phonePrefix: '+220', region: 'africa' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', phonePrefix: '+233', region: 'africa' },
  { code: 'GN', name: 'Guinea', currency: 'GNF', phonePrefix: '+224', region: 'africa' },
  { code: 'GW', name: 'Guinea-Bissau', currency: 'XOF', phonePrefix: '+245', region: 'africa' },
  { code: 'KE', name: 'Kenya', currency: 'KES', phonePrefix: '+254', region: 'africa' },
  { code: 'LS', name: 'Lesotho', currency: 'LSL', phonePrefix: '+266', region: 'africa' },
  { code: 'LR', name: 'Liberia', currency: 'LRD', phonePrefix: '+231', region: 'africa' },
  { code: 'LY', name: 'Libya', currency: 'LYD', phonePrefix: '+218', region: 'africa' },
  { code: 'MG', name: 'Madagascar', currency: 'MGA', phonePrefix: '+261', region: 'africa' },
  { code: 'MW', name: 'Malawi', currency: 'MWK', phonePrefix: '+265', region: 'africa' },
  { code: 'ML', name: 'Mali', currency: 'XOF', phonePrefix: '+223', region: 'africa' },
  { code: 'MR', name: 'Mauritania', currency: 'MRU', phonePrefix: '+222', region: 'africa' },
  { code: 'MU', name: 'Mauritius', currency: 'MUR', phonePrefix: '+230', region: 'africa' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', phonePrefix: '+212', region: 'africa' },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', phonePrefix: '+258', region: 'africa' },
  { code: 'NA', name: 'Namibia', currency: 'NAD', phonePrefix: '+264', region: 'africa' },
  { code: 'NE', name: 'Niger', currency: 'XOF', phonePrefix: '+227', region: 'africa' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', phonePrefix: '+234', region: 'africa' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', phonePrefix: '+250', region: 'africa' },
  { code: 'ST', name: 'São Tomé and Príncipe', currency: 'STN', phonePrefix: '+239', region: 'africa' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', phonePrefix: '+221', region: 'africa' },
  { code: 'SC', name: 'Seychelles', currency: 'SCR', phonePrefix: '+248', region: 'africa' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLE', phonePrefix: '+232', region: 'africa' },
  { code: 'SO', name: 'Somalia', currency: 'SOS', phonePrefix: '+252', region: 'africa' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', phonePrefix: '+27', region: 'africa' },
  { code: 'SS', name: 'South Sudan', currency: 'SSP', phonePrefix: '+211', region: 'africa' },
  { code: 'SD', name: 'Sudan', currency: 'SDG', phonePrefix: '+249', region: 'africa' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', phonePrefix: '+255', region: 'africa' },
  { code: 'TG', name: 'Togo', currency: 'XOF', phonePrefix: '+228', region: 'africa' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', phonePrefix: '+216', region: 'africa' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', phonePrefix: '+256', region: 'africa' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', phonePrefix: '+260', region: 'africa' },
  { code: 'ZW', name: 'Zimbabwe', currency: 'ZWL', phonePrefix: '+263', region: 'africa' },

  // Americas
  { code: 'AG', name: 'Antigua and Barbuda', currency: 'XCD', phonePrefix: '+1268', region: 'americas' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', phonePrefix: '+54', region: 'americas' },
  { code: 'BS', name: 'Bahamas', currency: 'BSD', phonePrefix: '+1242', region: 'americas' },
  { code: 'BB', name: 'Barbados', currency: 'BBD', phonePrefix: '+1246', region: 'americas' },
  { code: 'BZ', name: 'Belize', currency: 'BZD', phonePrefix: '+501', region: 'americas' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', phonePrefix: '+591', region: 'americas' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', phonePrefix: '+55', region: 'americas' },
  { code: 'CA', name: 'Canada', currency: 'CAD', phonePrefix: '+1', region: 'americas' },
  { code: 'CL', name: 'Chile', currency: 'CLP', phonePrefix: '+56', region: 'americas' },
  { code: 'CO', name: 'Colombia', currency: 'COP', phonePrefix: '+57', region: 'americas' },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', phonePrefix: '+506', region: 'americas' },
  { code: 'CU', name: 'Cuba', currency: 'CUP', phonePrefix: '+53', region: 'americas' },
  { code: 'DM', name: 'Dominica', currency: 'XCD', phonePrefix: '+1767', region: 'americas' },
  { code: 'DO', name: 'Dominican Republic', currency: 'DOP', phonePrefix: '+1809', region: 'americas' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', phonePrefix: '+593', region: 'americas' },
  { code: 'SV', name: 'El Salvador', currency: 'USD', phonePrefix: '+503', region: 'americas' },
  { code: 'GD', name: 'Grenada', currency: 'XCD', phonePrefix: '+1473', region: 'americas' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', phonePrefix: '+502', region: 'americas' },
  { code: 'GY', name: 'Guyana', currency: 'GYD', phonePrefix: '+592', region: 'americas' },
  { code: 'HT', name: 'Haiti', currency: 'HTG', phonePrefix: '+509', region: 'americas' },
  { code: 'HN', name: 'Honduras', currency: 'HNL', phonePrefix: '+504', region: 'americas' },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', phonePrefix: '+1876', region: 'americas' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', phonePrefix: '+52', region: 'americas' },
  { code: 'NI', name: 'Nicaragua', currency: 'NIO', phonePrefix: '+505', region: 'americas' },
  { code: 'PA', name: 'Panama', currency: 'PAB', phonePrefix: '+507', region: 'americas' },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', phonePrefix: '+595', region: 'americas' },
  { code: 'PE', name: 'Peru', currency: 'PEN', phonePrefix: '+51', region: 'americas' },
  { code: 'KN', name: 'Saint Kitts and Nevis', currency: 'XCD', phonePrefix: '+1869', region: 'americas' },
  { code: 'LC', name: 'Saint Lucia', currency: 'XCD', phonePrefix: '+1758', region: 'americas' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', currency: 'XCD', phonePrefix: '+1784', region: 'americas' },
  { code: 'SR', name: 'Suriname', currency: 'SRD', phonePrefix: '+597', region: 'americas' },
  { code: 'TT', name: 'Trinidad and Tobago', currency: 'TTD', phonePrefix: '+1868', region: 'americas' },
  { code: 'US', name: 'United States', currency: 'USD', phonePrefix: '+1', region: 'americas' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', phonePrefix: '+598', region: 'americas' },
  { code: 'VE', name: 'Venezuela', currency: 'VES', phonePrefix: '+58', region: 'americas' },

  // Asia
  { code: 'AF', name: 'Afghanistan', currency: 'AFN', phonePrefix: '+93', region: 'asia' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', phonePrefix: '+374', region: 'asia' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', phonePrefix: '+994', region: 'asia' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', phonePrefix: '+973', region: 'asia' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', phonePrefix: '+880', region: 'asia' },
  { code: 'BT', name: 'Bhutan', currency: 'BTN', phonePrefix: '+975', region: 'asia' },
  { code: 'BN', name: 'Brunei', currency: 'BND', phonePrefix: '+673', region: 'asia' },
  { code: 'KH', name: 'Cambodia', currency: 'KHR', phonePrefix: '+855', region: 'asia' },
  { code: 'CN', name: 'China', currency: 'CNY', phonePrefix: '+86', region: 'asia' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR', phonePrefix: '+357', region: 'asia' },
  { code: 'GE', name: 'Georgia', currency: 'GEL', phonePrefix: '+995', region: 'asia' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', phonePrefix: '+852', region: 'asia' },
  { code: 'IN', name: 'India', currency: 'INR', phonePrefix: '+91', region: 'asia' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', phonePrefix: '+62', region: 'asia' },
  { code: 'IR', name: 'Iran', currency: 'IRR', phonePrefix: '+98', region: 'asia' },
  { code: 'IQ', name: 'Iraq', currency: 'IQD', phonePrefix: '+964', region: 'asia' },
  { code: 'IL', name: 'Israel', currency: 'ILS', phonePrefix: '+972', region: 'asia' },
  { code: 'JP', name: 'Japan', currency: 'JPY', phonePrefix: '+81', region: 'asia' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', phonePrefix: '+962', region: 'asia' },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', phonePrefix: '+7', region: 'asia' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', phonePrefix: '+965', region: 'asia' },
  { code: 'KG', name: 'Kyrgyzstan', currency: 'KGS', phonePrefix: '+996', region: 'asia' },
  { code: 'LA', name: 'Laos', currency: 'LAK', phonePrefix: '+856', region: 'asia' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP', phonePrefix: '+961', region: 'asia' },
  { code: 'MO', name: 'Macao', currency: 'MOP', phonePrefix: '+853', region: 'asia' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', phonePrefix: '+60', region: 'asia' },
  { code: 'MV', name: 'Maldives', currency: 'MVR', phonePrefix: '+960', region: 'asia' },
  { code: 'MN', name: 'Mongolia', currency: 'MNT', phonePrefix: '+976', region: 'asia' },
  { code: 'MM', name: 'Myanmar', currency: 'MMK', phonePrefix: '+95', region: 'asia' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', phonePrefix: '+977', region: 'asia' },
  { code: 'KP', name: 'North Korea', currency: 'KPW', phonePrefix: '+850', region: 'asia' },
  { code: 'OM', name: 'Oman', currency: 'OMR', phonePrefix: '+968', region: 'asia' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', phonePrefix: '+92', region: 'asia' },
  { code: 'PS', name: 'Palestine', currency: 'ILS', phonePrefix: '+970', region: 'asia' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', phonePrefix: '+63', region: 'asia' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', phonePrefix: '+974', region: 'asia' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', phonePrefix: '+966', region: 'asia' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', phonePrefix: '+65', region: 'asia' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', phonePrefix: '+82', region: 'asia' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', phonePrefix: '+94', region: 'asia' },
  { code: 'SY', name: 'Syria', currency: 'SYP', phonePrefix: '+963', region: 'asia' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', phonePrefix: '+886', region: 'asia' },
  { code: 'TJ', name: 'Tajikistan', currency: 'TJS', phonePrefix: '+992', region: 'asia' },
  { code: 'TH', name: 'Thailand', currency: 'THB', phonePrefix: '+66', region: 'asia' },
  { code: 'TL', name: 'Timor-Leste', currency: 'USD', phonePrefix: '+670', region: 'asia' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', phonePrefix: '+90', region: 'asia' },
  { code: 'TM', name: 'Turkmenistan', currency: 'TMT', phonePrefix: '+993', region: 'asia' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', phonePrefix: '+971', region: 'asia' },
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', phonePrefix: '+998', region: 'asia' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', phonePrefix: '+84', region: 'asia' },
  { code: 'YE', name: 'Yemen', currency: 'YER', phonePrefix: '+967', region: 'asia' },

  // Europe
  { code: 'AL', name: 'Albania', currency: 'ALL', phonePrefix: '+355', region: 'europe' },
  { code: 'AD', name: 'Andorra', currency: 'EUR', phonePrefix: '+376', region: 'europe' },
  { code: 'AT', name: 'Austria', currency: 'EUR', phonePrefix: '+43', region: 'europe' },
  { code: 'BY', name: 'Belarus', currency: 'BYN', phonePrefix: '+375', region: 'europe' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', phonePrefix: '+32', region: 'europe' },
  { code: 'BA', name: 'Bosnia and Herzegovina', currency: 'BAM', phonePrefix: '+387', region: 'europe' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', phonePrefix: '+359', region: 'europe' },
  { code: 'HR', name: 'Croatia', currency: 'EUR', phonePrefix: '+385', region: 'europe' },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK', phonePrefix: '+420', region: 'europe' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', phonePrefix: '+45', region: 'europe' },
  { code: 'EE', name: 'Estonia', currency: 'EUR', phonePrefix: '+372', region: 'europe' },
  { code: 'FI', name: 'Finland', currency: 'EUR', phonePrefix: '+358', region: 'europe' },
  { code: 'FR', name: 'France', currency: 'EUR', phonePrefix: '+33', region: 'europe' },
  { code: 'DE', name: 'Germany', currency: 'EUR', phonePrefix: '+49', region: 'europe' },
  { code: 'GR', name: 'Greece', currency: 'EUR', phonePrefix: '+30', region: 'europe' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', phonePrefix: '+36', region: 'europe' },
  { code: 'IS', name: 'Iceland', currency: 'ISK', phonePrefix: '+354', region: 'europe' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', phonePrefix: '+353', region: 'europe' },
  { code: 'IT', name: 'Italy', currency: 'EUR', phonePrefix: '+39', region: 'europe' },
  { code: 'XK', name: 'Kosovo', currency: 'EUR', phonePrefix: '+383', region: 'europe' },
  { code: 'LV', name: 'Latvia', currency: 'EUR', phonePrefix: '+371', region: 'europe' },
  { code: 'LI', name: 'Liechtenstein', currency: 'CHF', phonePrefix: '+423', region: 'europe' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR', phonePrefix: '+370', region: 'europe' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', phonePrefix: '+352', region: 'europe' },
  { code: 'MT', name: 'Malta', currency: 'EUR', phonePrefix: '+356', region: 'europe' },
  { code: 'MD', name: 'Moldova', currency: 'MDL', phonePrefix: '+373', region: 'europe' },
  { code: 'MC', name: 'Monaco', currency: 'EUR', phonePrefix: '+377', region: 'europe' },
  { code: 'ME', name: 'Montenegro', currency: 'EUR', phonePrefix: '+382', region: 'europe' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', phonePrefix: '+31', region: 'europe' },
  { code: 'MK', name: 'North Macedonia', currency: 'MKD', phonePrefix: '+389', region: 'europe' },
  { code: 'NO', name: 'Norway', currency: 'NOK', phonePrefix: '+47', region: 'europe' },
  { code: 'PL', name: 'Poland', currency: 'PLN', phonePrefix: '+48', region: 'europe' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', phonePrefix: '+351', region: 'europe' },
  { code: 'RO', name: 'Romania', currency: 'RON', phonePrefix: '+40', region: 'europe' },
  { code: 'RU', name: 'Russia', currency: 'RUB', phonePrefix: '+7', region: 'europe' },
  { code: 'SM', name: 'San Marino', currency: 'EUR', phonePrefix: '+378', region: 'europe' },
  { code: 'RS', name: 'Serbia', currency: 'RSD', phonePrefix: '+381', region: 'europe' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR', phonePrefix: '+421', region: 'europe' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR', phonePrefix: '+386', region: 'europe' },
  { code: 'ES', name: 'Spain', currency: 'EUR', phonePrefix: '+34', region: 'europe' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', phonePrefix: '+46', region: 'europe' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', phonePrefix: '+41', region: 'europe' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', phonePrefix: '+380', region: 'europe' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', phonePrefix: '+44', region: 'europe' },
  { code: 'VA', name: 'Vatican City', currency: 'EUR', phonePrefix: '+379', region: 'europe' },

  // Oceania
  { code: 'AU', name: 'Australia', currency: 'AUD', phonePrefix: '+61', region: 'oceania' },
  { code: 'FJ', name: 'Fiji', currency: 'FJD', phonePrefix: '+679', region: 'oceania' },
  { code: 'KI', name: 'Kiribati', currency: 'AUD', phonePrefix: '+686', region: 'oceania' },
  { code: 'MH', name: 'Marshall Islands', currency: 'USD', phonePrefix: '+692', region: 'oceania' },
  { code: 'FM', name: 'Micronesia', currency: 'USD', phonePrefix: '+691', region: 'oceania' },
  { code: 'NR', name: 'Nauru', currency: 'AUD', phonePrefix: '+674', region: 'oceania' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', phonePrefix: '+64', region: 'oceania' },
  { code: 'PW', name: 'Palau', currency: 'USD', phonePrefix: '+680', region: 'oceania' },
  { code: 'PG', name: 'Papua New Guinea', currency: 'PGK', phonePrefix: '+675', region: 'oceania' },
  { code: 'WS', name: 'Samoa', currency: 'WST', phonePrefix: '+685', region: 'oceania' },
  { code: 'SB', name: 'Solomon Islands', currency: 'SBD', phonePrefix: '+677', region: 'oceania' },
  { code: 'TO', name: 'Tonga', currency: 'TOP', phonePrefix: '+676', region: 'oceania' },
  { code: 'TV', name: 'Tuvalu', currency: 'AUD', phonePrefix: '+688', region: 'oceania' },
  { code: 'VU', name: 'Vanuatu', currency: 'VUV', phonePrefix: '+678', region: 'oceania' },
];

// Sort countries alphabetically by name
COUNTRIES.sort((a, b) => a.name.localeCompare(b.name));

// Helper functions
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getCountriesByRegion(region: string): Country[] {
  return COUNTRIES.filter(c => c.region === region);
}

export function getCountryName(code: string): string {
  return getCountryByCode(code)?.name || code;
}

export function getCountryCurrency(code: string): string {
  return getCountryByCode(code)?.currency || 'USD';
}

export function getCountryPhonePrefix(code: string): string {
  return getCountryByCode(code)?.phonePrefix || '+1';
}

// Pre-formatted options for select dropdowns
export const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ 
  code: c.code, 
  name: c.name 
}));

// Country options with "Other" for custom entries
export const COUNTRY_OPTIONS_WITH_OTHER = [
  ...COUNTRY_OPTIONS,
  { code: 'OTHER', name: 'Other' }
];

// Grouped countries by region for organized dropdowns
export const COUNTRIES_BY_REGION = {
  africa: getCountriesByRegion('africa'),
  americas: getCountriesByRegion('americas'),
  asia: getCountriesByRegion('asia'),
  europe: getCountriesByRegion('europe'),
  oceania: getCountriesByRegion('oceania'),
};

// Region labels for display
export const REGION_LABELS: Record<string, string> = {
  africa: 'Africa',
  americas: 'Americas',
  asia: 'Asia',
  europe: 'Europe',
  oceania: 'Oceania',
};
