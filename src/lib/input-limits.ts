/**
 * Centralized input length limits for all client-facing fields.
 * Used as maxLength props on Input/Textarea and .max() in zod schemas.
 * Server-side validation in _shared/validation.ts enforces similar limits.
 */
export const INPUT_LIMITS = {
  NAME: 50,
  LEGAL_NAME: 50,
  EMAIL: 100,
  PASSWORD: 128,
  PHONE: 30,
  TAX_ID: 50,
  REG_NUMBER: 50,
  ADDRESS_LINE: 200,
  POSTAL_CODE: 20,
  SHORT_TEXT: 200,
  TEXTAREA: 200,
  SEARCH: 200,
  INVOICE_NUMBER: 50,
  INVOICE_PREFIX: 10,
  CURRENCY_CODE: 10,
  COLOR_HEX: 7,
  LINE_ITEM_HEADING: 200,
  LINE_ITEM_DESCRIPTION: 1000,
} as const;

/**
 * Split a stored line-item description into a heading (first line) and an
 * optional multi-line description (everything after the first newline).
 * Backward-compatible: existing single-line descriptions become heading-only.
 */
export function splitLineItemDescription(stored: string | null | undefined): { heading: string; description: string } {
  const value = stored ?? '';
  const idx = value.indexOf('\n');
  if (idx === -1) return { heading: value, description: '' };
  return { heading: value.slice(0, idx), description: value.slice(idx + 1) };
}

/**
 * Combine a heading + optional description into the single column value.
 */
export function combineLineItemDescription(heading: string, description: string): string {
  const h = (heading ?? '').trim();
  const d = (description ?? '').trim();
  if (!d) return h;
  return `${h}\n${d}`;
}
