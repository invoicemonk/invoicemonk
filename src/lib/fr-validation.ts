/**
 * French business identifier validators (SIREN / SIRET / TVA intracommunautaire).
 *
 * Used both for client-side onboarding/validation and for invoice-level compliance
 * checks against the upcoming Sept 2026 e-invoicing mandate.
 */

/** Luhn checksum used by both SIREN (9 digits) and SIRET (14 digits). */
function luhnValid(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  let sum = 0;
  // Iterate from rightmost digit; double every 2nd digit.
  for (let i = 0; i < value.length; i++) {
    const digit = Number(value[value.length - 1 - i]);
    const doubled = i % 2 === 1 ? digit * 2 : digit;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return sum % 10 === 0;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** SIREN — 9 digits, Luhn-valid. Identifies the legal entity (head office). */
export function validateSiren(input: string): ValidationResult {
  const v = input.replace(/\s+/g, '');
  if (!v) return { valid: false, error: 'SIREN is required' };
  if (!/^\d{9}$/.test(v)) return { valid: false, error: 'SIREN must be exactly 9 digits' };
  if (!luhnValid(v)) return { valid: false, error: 'SIREN failed Luhn checksum' };
  return { valid: true };
}

/** SIRET — 14 digits (SIREN + 5-digit NIC), Luhn-valid. Identifies a specific establishment. */
export function validateSiret(input: string): ValidationResult {
  const v = input.replace(/\s+/g, '');
  if (!v) return { valid: false, error: 'SIRET is required' };
  if (!/^\d{14}$/.test(v)) return { valid: false, error: 'SIRET must be exactly 14 digits' };
  if (!luhnValid(v)) return { valid: false, error: 'SIRET failed Luhn checksum' };
  // The first 9 digits must themselves form a valid SIREN.
  const sirenPart = v.slice(0, 9);
  if (!luhnValid(sirenPart)) {
    return { valid: false, error: 'SIRET prefix is not a valid SIREN' };
  }
  return { valid: true };
}

/**
 * TVA intracommunautaire — `FR` + 2-character key + 9-digit SIREN.
 * The 2-character key is the modulo-97 algorithm: `(12 + 3 * (SIREN mod 97)) mod 97`,
 * zero-padded to 2 digits. New SIREN can also use a letter pair (rare) — we accept
 * digits or uppercase letters for the key but only verify the modulo when both are digits.
 */
export function validateTvaIntra(input: string): ValidationResult {
  const v = input.replace(/\s+/g, '').toUpperCase();
  if (!v) return { valid: false, error: 'TVA number is required' };
  const m = v.match(/^FR([0-9A-Z]{2})(\d{9})$/);
  if (!m) {
    return { valid: false, error: 'TVA must follow format FRxx123456789 (FR + 2-char key + 9-digit SIREN)' };
  }
  const [, key, siren] = m;
  // Validate the embedded SIREN.
  const sirenCheck = validateSiren(siren);
  if (!sirenCheck.valid) return { valid: false, error: 'TVA contains an invalid SIREN' };
  // Verify modulo-97 key when key is numeric.
  if (/^\d{2}$/.test(key)) {
    const sirenNum = Number(siren);
    const expected = ((12 + 3 * (sirenNum % 97)) % 97).toString().padStart(2, '0');
    if (expected !== key) {
      return { valid: false, error: `TVA checksum invalid (expected key ${expected})` };
    }
  }
  return { valid: true };
}

/**
 * Convenience: validate either a SIREN or SIRET (caller doesn't know which).
 * Used as a generic "French business ID" check on client records.
 */
export function validateFrBusinessId(input: string): ValidationResult {
  const v = input.replace(/\s+/g, '');
  if (!v) return { valid: false, error: 'Business identifier is required' };
  if (v.length === 9) return validateSiren(v);
  if (v.length === 14) return validateSiret(v);
  return { valid: false, error: 'French ID must be 9 digits (SIREN) or 14 digits (SIRET)' };
}
