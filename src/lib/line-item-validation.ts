/**
 * Shared validation for invoice line items.
 *
 * Compliance rule: an invoice must describe real goods/services. Placeholder or
 * zero-value lines must never be saveable, issuable, or payable.
 */

export interface ValidatableLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

/** Descriptions that are never acceptable on a compliant invoice. */
const PLACEHOLDER_DESCRIPTIONS = [
  'sample service',
  'sample',
  'sample item',
  'test',
  'testing',
  'placeholder',
  'n/a',
  'na',
  '-',
  '--',
  'tbd',
  'xxx',
];

export function isPlaceholderDescription(description: string): boolean {
  const normalized = description.trim().toLowerCase().replace(/\s+/g, ' ');
  return PLACEHOLDER_DESCRIPTIONS.includes(normalized);
}

/** A line item that carries real billable content. */
export function isMeaningfulLineItem(item: ValidatableLineItem): boolean {
  return (
    item.description.trim().length > 0 &&
    !isPlaceholderDescription(item.description) &&
    Number(item.quantity) > 0 &&
    Number(item.unitPrice) > 0
  );
}

/** Line items considered "filled in" by the user (partial rows still count). */
function isTouchedLineItem(item: ValidatableLineItem): boolean {
  return item.description.trim().length > 0 || Number(item.unitPrice) > 0;
}

export function getValidLineItems<T extends ValidatableLineItem>(items: T[]): T[] {
  return items.filter(isMeaningfulLineItem);
}

export interface LineItemValidationResult {
  valid: boolean;
  title?: string;
  description?: string;
}

/**
 * Validate the full set of line items for an invoice.
 * Returns a toast-ready title/description on failure.
 */
export function validateLineItems(items: ValidatableLineItem[]): LineItemValidationResult {
  const touched = items.filter(isTouchedLineItem);

  if (touched.length === 0) {
    return {
      valid: false,
      title: 'Line items required',
      description: 'Add at least one line item with a description, quantity and unit price.',
    };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!isTouchedLineItem(item)) continue;
    const label = `Line ${i + 1}`;

    if (item.description.trim().length === 0) {
      return {
        valid: false,
        title: `${label}: description required`,
        description: 'Describe what you are billing for, or remove the line.',
      };
    }
    if (isPlaceholderDescription(item.description)) {
      return {
        valid: false,
        title: `${label}: placeholder description`,
        description: `"${item.description.trim()}" is not a valid description. Describe the actual goods or service supplied.`,
      };
    }
    if (!(Number(item.quantity) > 0)) {
      return {
        valid: false,
        title: `${label}: quantity required`,
        description: 'Quantity must be greater than zero.',
      };
    }
    if (!(Number(item.unitPrice) > 0)) {
      return {
        valid: false,
        title: `${label}: unit price required`,
        description: 'Unit price must be greater than zero.',
      };
    }
  }

  const total = getValidLineItems(items).reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );

  if (!(total > 0)) {
    return {
      valid: false,
      title: 'Invoice total must be greater than zero',
      description: 'Enter the real amounts you are billing before saving or issuing.',
    };
  }

  return { valid: true };
}

/** True when the invoice has at least one real line item (used to gate buttons). */
export function hasValidLineItems(items: ValidatableLineItem[]): boolean {
  return validateLineItems(items).valid;
}
