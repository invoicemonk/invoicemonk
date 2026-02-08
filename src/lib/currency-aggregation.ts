/**
 * Currency Aggregation Utility
 * 
 * This utility provides mathematically correct aggregation of multi-currency amounts.
 * Exchange rates must be snapshotted at document creation time and are immutable.
 * 
 * Rules:
 * - Aggregates may only produce a single total if:
 *   1. ALL amounts are in the same currency, OR
 *   2. ALL non-primary currency amounts have a stored exchange_rate_to_primary
 * - Otherwise, show per-currency breakdowns with explicit indicators
 * - Never silently mix currencies
 */

export interface CurrencyAmount {
  amount: number;
  currency: string;
  exchangeRateToPrimary?: number | null;
}

export interface CurrencyBreakdownItem {
  total: number;
  count: number;
  convertedTotal: number;
  hasAllRates: boolean;
  unconvertibleCount: number;
}

export interface AggregationResult {
  /** Sum of converted amounts (excludes unconvertible) */
  primaryTotal: number;
  /** The primary/base currency */
  primaryCurrency: string;
  /** True if more than one currency appears in the dataset */
  hasMultipleCurrencies: boolean;
  /** True if some amounts couldn't be converted */
  hasUnconvertibleAmounts: boolean;
  /** Sum of amounts that couldn't be converted (in their original currencies) */
  unconvertibleTotal: number;
  /** List of currencies without rates */
  unconvertibleCurrencies: string[];
  /** Per-currency breakdown */
  breakdown: Record<string, CurrencyBreakdownItem>;
  /** Total number of items */
  totalCount: number;
  /** Number of items included in primaryTotal */
  convertedCount: number;
  /** Number of items excluded due to missing rates */
  excludedCount: number;
}

/**
 * Aggregates amounts across multiple currencies with proper conversion.
 * 
 * @param amounts - Array of currency amounts with optional exchange rates
 * @param primaryCurrency - The base currency to convert to
 * @returns Aggregation result with totals, breakdowns, and conversion status
 */
export function aggregateAmounts(
  amounts: CurrencyAmount[],
  primaryCurrency: string
): AggregationResult {
  const breakdown: Record<string, CurrencyBreakdownItem> = {};
  const unconvertibleCurrencies = new Set<string>();
  
  let primaryTotal = 0;
  let unconvertibleTotal = 0;
  let convertedCount = 0;
  let excludedCount = 0;
  const currencies = new Set<string>();

  for (const item of amounts) {
    const { amount, currency, exchangeRateToPrimary } = item;
    currencies.add(currency);

    // Initialize breakdown for this currency if needed
    if (!breakdown[currency]) {
      breakdown[currency] = {
        total: 0,
        count: 0,
        convertedTotal: 0,
        hasAllRates: true,
        unconvertibleCount: 0,
      };
    }

    breakdown[currency].total += amount;
    breakdown[currency].count += 1;

    // Determine if this amount can be converted
    if (currency === primaryCurrency) {
      // Same as primary currency - no conversion needed
      primaryTotal += amount;
      breakdown[currency].convertedTotal += amount;
      convertedCount += 1;
    } else if (exchangeRateToPrimary && exchangeRateToPrimary > 0) {
      // Has valid exchange rate - convert
      const converted = amount * exchangeRateToPrimary;
      primaryTotal += converted;
      breakdown[currency].convertedTotal += converted;
      convertedCount += 1;
    } else {
      // No valid rate - cannot convert
      unconvertibleTotal += amount;
      unconvertibleCurrencies.add(currency);
      breakdown[currency].hasAllRates = false;
      breakdown[currency].unconvertibleCount += 1;
      excludedCount += 1;
    }
  }

  return {
    primaryTotal,
    primaryCurrency,
    hasMultipleCurrencies: currencies.size > 1,
    hasUnconvertibleAmounts: excludedCount > 0,
    unconvertibleTotal,
    unconvertibleCurrencies: Array.from(unconvertibleCurrencies),
    breakdown,
    totalCount: amounts.length,
    convertedCount,
    excludedCount,
  };
}

/**
 * Format currency with symbol
 */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  const symbol = symbols[currency] || `${currency} `;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  return symbols[currency] || currency;
}
