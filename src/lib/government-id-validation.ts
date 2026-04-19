/**
 * Lightweight per-jurisdiction government ID validators.
 *
 * Each check is hint-level (length, allowed chars, simple checksum where trivial)
 * — not a strict legal validator. Used for inline form feedback only.
 */
import type { GovernmentIdType } from './jurisdiction-config';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const onlyDigits = (s: string) => /^\d+$/.test(s);
const stripSpaces = (s: string) => s.replace(/[\s.-]/g, '');

// Mod-97 helper for IBAN-style VAT numbers (used by some EU validators)
function mod97(text: string): number {
  let remainder = 0;
  for (const ch of text) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder;
}

// SIREN/SIRET Luhn
function luhnValid(s: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = Number(s[i]);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum > 0 && sum % 10 === 0;
}

const TYPE_RULES: Partial<Record<GovernmentIdType, (raw: string, jurisdiction?: string) => ValidationResult>> = {
  SIREN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 9) {
      return { valid: false, message: 'SIREN must be exactly 9 digits.' };
    }
    if (!luhnValid(s)) return { valid: false, message: 'SIREN failed checksum (Luhn).' };
    return { valid: true };
  },
  SIRET: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 14) {
      return { valid: false, message: 'SIRET must be exactly 14 digits.' };
    }
    if (!luhnValid(s)) return { valid: false, message: 'SIRET failed checksum (Luhn).' };
    return { valid: true };
  },
  ABN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 11) {
      return { valid: false, message: 'ABN must be 11 digits.' };
    }
    return { valid: true };
  },
  ACN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 9) return { valid: false, message: 'ACN must be 9 digits.' };
    return { valid: true };
  },
  NZBN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 13) return { valid: false, message: 'NZBN must be 13 digits.' };
    return { valid: true };
  },
  CNPJ: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 14) return { valid: false, message: 'CNPJ must be 14 digits.' };
    return { valid: true };
  },
  CPF: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 11) return { valid: false, message: 'CPF must be 11 digits.' };
    return { valid: true };
  },
  RFC: (raw) => {
    const s = raw.trim().toUpperCase().replace(/\s/g, '');
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(s)) {
      return { valid: false, message: 'RFC format looks invalid (e.g. XAXX010101000).' };
    }
    return { valid: true };
  },
  CURP: (raw) => {
    const s = raw.trim().toUpperCase();
    if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/.test(s)) {
      return { valid: false, message: 'CURP must be 18 characters with a valid pattern.' };
    }
    return { valid: true };
  },
  RUT: (raw) => {
    const s = raw.replace(/[\s.]/g, '').toUpperCase();
    if (!/^\d{7,8}-?[\dK]$/.test(s)) {
      return { valid: false, message: 'RUT format looks invalid (e.g. 12345678-9).' };
    }
    return { valid: true };
  },
  NIT: (raw) => {
    const s = stripSpaces(raw);
    if (!/^\d{6,12}$/.test(s)) return { valid: false, message: 'NIT must be 6-12 digits.' };
    return { valid: true };
  },
  BN: (raw) => {
    const s = stripSpaces(raw);
    if (!/^\d{9}([A-Z]{2}\d{4})?$/.test(s)) {
      return { valid: false, message: 'BN should be 9 digits, optionally followed by 6-char program account.' };
    }
    return { valid: true };
  },
  UTR: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 10) {
      return { valid: false, message: 'UTR must be exactly 10 digits.' };
    }
    return { valid: true };
  },
  CRO: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length < 5 || s.length > 7) {
      return { valid: false, message: 'CRO number is typically 5-7 digits.' };
    }
    return { valid: true };
  },
  KRA_PIN: (raw) => {
    const s = raw.trim().toUpperCase();
    if (!/^[A-Z]\d{9}[A-Z]$/.test(s)) {
      return { valid: false, message: 'KRA PIN must be 11 chars: letter + 9 digits + letter.' };
    }
    return { valid: true };
  },
  URA_TIN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 10) {
      return { valid: false, message: 'URA TIN must be 10 digits.' };
    }
    return { valid: true };
  },
  EIN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 9) return { valid: false, message: 'EIN must be 9 digits (XX-XXXXXXX).' };
    return { valid: true };
  },
  SSN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 9) return { valid: false, message: 'SSN must be 9 digits (XXX-XX-XXXX).' };
    return { valid: true };
  },
  NIN: (raw) => {
    const s = stripSpaces(raw);
    if (!onlyDigits(s) || s.length !== 11) return { valid: false, message: 'NIN must be 11 digits.' };
    return { valid: true };
  },
  VAT: (raw, jurisdiction) => {
    const s = raw.replace(/\s/g, '').toUpperCase();
    if (s.length < 4) return { valid: false, message: 'VAT number is too short.' };
    if (jurisdiction === 'GB') {
      if (!/^GB\d{9}(\d{3})?$|^GB(GD|HA)\d{3}$/.test(s)) {
        return { valid: false, message: 'UK VAT format: GB + 9 or 12 digits.' };
      }
    } else if (jurisdiction === 'FR') {
      if (!/^FR[A-Z\d]{2}\d{9}$/.test(s)) {
        return { valid: false, message: 'French VAT: FR + 2-char key + 9-digit SIREN.' };
      }
    } else if (jurisdiction === 'DE') {
      if (!/^DE\d{9}$/.test(s)) return { valid: false, message: 'German VAT: DE + 9 digits.' };
    } else if (jurisdiction && /^[A-Z]{2}/.test(s)) {
      // Generic EU-style check: 2-letter prefix + alphanumeric body
      if (!/^[A-Z]{2}[A-Z\d]{2,12}$/.test(s)) {
        return { valid: false, message: 'VAT number format looks invalid.' };
      }
    }
    return { valid: true };
  },
  PASSPORT: (raw) => {
    const s = raw.trim().toUpperCase();
    if (!/^[A-Z\d]{6,12}$/.test(s)) {
      return { valid: false, message: 'Passport numbers are 6-12 alphanumeric characters.' };
    }
    return { valid: true };
  },
  NATIONAL_ID: (raw) => {
    const s = stripSpaces(raw);
    if (s.length < 5 || s.length > 25) {
      return { valid: false, message: 'National ID length looks unusual.' };
    }
    return { valid: true };
  },
  DRIVERS_LICENSE: (raw) => {
    const s = raw.trim();
    if (s.length < 4 || s.length > 25) {
      return { valid: false, message: "Driver's license length looks unusual." };
    }
    return { valid: true };
  },
  TIN: (raw) => {
    const s = stripSpaces(raw);
    if (s.length < 5) return { valid: false, message: 'TIN is too short.' };
    return { valid: true };
  },
  OTHER: () => ({ valid: true }),
};

/**
 * Validate a government ID value against its declared type and (optionally) jurisdiction.
 * Returns { valid, message? } — message only present when invalid.
 */
export function validateGovernmentId(
  type: GovernmentIdType | string | undefined | null,
  value: string | undefined | null,
  jurisdiction?: string
): ValidationResult {
  if (!type || !value || !value.trim()) return { valid: true };
  const rule = TYPE_RULES[type as GovernmentIdType];
  if (!rule) return { valid: true };
  return rule(value, jurisdiction);
}
