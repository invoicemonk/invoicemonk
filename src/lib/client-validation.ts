import { isDisposableEmail } from './disposable-emails';

// ── Name validation ──────────────────────────────────────────────────

const GIBBERISH_PATTERNS = [
  /^[a-z]{1,2}$/i,                    // single / two random letters
  /^(.)\1{2,}$/i,                     // "aaa", "bbb"
  /^(asdf|qwer|zxcv|test|fake|xxx|abc|none|na|n\/a)/i,
  /^\d+$/,                            // all digits
  /^[^a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF]+$/,  // no letters at all
];

const KEYBOARD_MASH = /^[asdfghjklqwertyuiopzxcvbnm]{4,}$/i;

export function validateClientName(
  name: string,
  clientType: 'individual' | 'company',
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: 'Name is required' };
  if (trimmed.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };

  for (const pat of GIBBERISH_PATTERNS) {
    if (pat.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid name' };
    }
  }

  // Keyboard mash detection – only flag short random strings
  if (trimmed.length < 8 && KEYBOARD_MASH.test(trimmed.replace(/\s/g, ''))) {
    return { valid: false, error: 'Please enter a valid name' };
  }

  if (clientType === 'individual' && trimmed.split(/\s+/).length < 2) {
    return { valid: false, error: 'Please enter a full name (first and last)' };
  }

  return { valid: true };
}

// ── Email validation ─────────────────────────────────────────────────

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

export function validateClientEmail(email: string): {
  valid: boolean;
  error?: string;
  isDisposable?: boolean;
} {
  const trimmed = email.trim();
  if (!trimmed) return { valid: false, error: 'Email is required' };
  if (!EMAIL_RE.test(trimmed)) return { valid: false, error: 'Invalid email format' };

  const disposable = isDisposableEmail(trimmed);
  if (disposable) {
    // soft warning – still technically valid
    return { valid: true, isDisposable: true };
  }
  return { valid: true, isDisposable: false };
}

// ── Phone validation ─────────────────────────────────────────────────

const PHONE_RE = /^[+\d][\d\s\-().]{5,}$/;

export function validateClientPhone(phone: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = phone.trim();
  if (!trimmed) return { valid: true }; // phone is optional
  if (!PHONE_RE.test(trimmed)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  return { valid: true };
}

// ── Tax ID validation ────────────────────────────────────────────────

export function validateClientTaxId(
  taxId: string,
  _jurisdiction?: string,
): { valid: boolean; error?: string } {
  const trimmed = taxId.trim();
  if (!trimmed) return { valid: true }; // optional
  if (trimmed.length < 3) {
    return { valid: false, error: 'Tax ID is too short' };
  }
  // Generic format: alphanumeric + hyphens
  if (!/^[A-Za-z0-9\-]+$/.test(trimmed)) {
    return { valid: false, error: 'Tax ID contains invalid characters' };
  }
  return { valid: true };
}

// ── Aggregate validator ──────────────────────────────────────────────

export interface ClientValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

export function validateClient(
  data: {
    name: string;
    email: string;
    phone: string;
    tax_id: string;
    client_type: 'individual' | 'company';
  },
  _jurisdiction?: string,
): ClientValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  const nameResult = validateClientName(data.name, data.client_type);
  if (!nameResult.valid && nameResult.error) errors.name = nameResult.error;

  const emailResult = validateClientEmail(data.email);
  if (!emailResult.valid && emailResult.error) errors.email = emailResult.error;
  if (emailResult.isDisposable) warnings.push('This email uses a disposable/temporary domain');

  const phoneResult = validateClientPhone(data.phone);
  if (!phoneResult.valid && phoneResult.error) errors.phone = phoneResult.error;

  const taxResult = validateClientTaxId(data.tax_id, _jurisdiction);
  if (!taxResult.valid && taxResult.error) errors.tax_id = taxResult.error;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
