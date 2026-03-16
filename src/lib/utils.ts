import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip URLs from user-provided text to prevent phishing/spam in emails.
 * Replaces http(s), ftp, and www. links with '[link removed]'.
 */
export function stripUrls(str: string): string {
  return str
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, '[link removed]')
    .replace(/ftp:\/\/[^\s<>"')\]]+/gi, '[link removed]')
    .replace(/www\.[^\s<>"')\]]+/gi, '[link removed]')
    .replace(/\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(com|net|org|io|co|app|dev|xyz|info|biz|me|us|uk|ng|za|ke|gh|de|fr|es|it|nl|au|ca|in|jp|ru|br|mx|ar|cl|se|no|dk|fi|pl|cz|pt|be|at|ch|ie|nz|sg|hk|tw|kr|ph|th|my|id|vn|ae|sa|qa|eg|ma|tz|rw|ug|site|online|store|shop|tech|pro|cloud|ai|gg|tv|cc|ly)(\/[^\s<>"')\]]*)?/gi, '[link removed]');
}

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    // Major currencies
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    // Americas
    CAD: 'C$',
    MXN: 'MX$',
    BRL: 'R$',
    ARS: '$',
    CLP: '$',
    COP: '$',
    PEN: 'S/',
    UYU: '$U',
    // Europe
    CHF: 'CHF',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RON: 'lei',
    BGN: 'лв',
    RSD: 'din.',
    RUB: '₽',
    UAH: '₴',
    // Africa
    NGN: '₦',
    ZAR: 'R',
    GHS: 'GH₵',
    KES: 'KSh',
    EGP: 'E£',
    MAD: 'DH',
    TZS: 'TSh',
    UGX: 'USh',
    RWF: 'FRw',
    XOF: 'CFA',
    XAF: 'FCFA',
    // Asia-Pacific
    INR: '₹',
    SGD: 'S$',
    HKD: 'HK$',
    TWD: 'NT$',
    KRW: '₩',
    THB: '฿',
    MYR: 'RM',
    IDR: 'Rp',
    PHP: '₱',
    VND: '₫',
    PKR: '₨',
    BDT: '৳',
    LKR: 'Rs',
    // Middle East
    AED: 'د.إ',
    SAR: '﷼',
    QAR: 'QR',
    KWD: 'KD',
    BHD: 'BD',
    OMR: 'OMR',
    JOD: 'JD',
    ILS: '₪',
    TRY: '₺',
    // Oceania
    AUD: 'A$',
    NZD: 'NZ$',
    FJD: 'FJ$',
  };
  return symbols[currency] || currency;
}

/**
 * Format a number as currency with proper symbol.
 * Handles negative amounts with a leading minus sign.
 */
export function formatCurrency(amount: number, currency: string = 'NGN'): string {
  const symbol = getCurrencySymbol(currency);
  const prefix = amount < 0 ? '-' : '';
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Format currency with smart abbreviation for large values
 */
export function formatCompactCurrency(amount: number, currency: string = 'NGN'): string {
  const symbol = getCurrencySymbol(currency);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    return `${symbol}${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 100_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount, currency);
}
