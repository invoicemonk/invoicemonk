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
} as const;
