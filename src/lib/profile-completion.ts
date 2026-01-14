interface AddressData {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [key: string]: string | undefined;
}

interface ProfileField {
  key: string;
  label: string;
  getValue: (data: FormDataInput) => boolean;
}

export interface FormDataInput {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  addressCity: string;
  addressCountry: string;
}

// Required fields matching the database compute_business_compliance trigger:
// name, legal_name, tax_id, contact_email, address->city, address->country
const REQUIRED_FIELDS: ProfileField[] = [
  { key: 'name', label: 'Business Name', getValue: (d) => !!d.name?.trim() },
  { key: 'legalName', label: 'Legal Name', getValue: (d) => !!d.legalName?.trim() },
  { key: 'taxId', label: 'Tax ID', getValue: (d) => !!d.taxId?.trim() },
  { key: 'email', label: 'Email', getValue: (d) => !!d.email?.trim() },
  { key: 'addressCity', label: 'City', getValue: (d) => !!d.addressCity?.trim() },
  { key: 'addressCountry', label: 'Country', getValue: (d) => !!d.addressCountry?.trim() },
];

export interface ProfileCompletionResult {
  completed: number;
  total: number;
  percentage: number;
  isComplete: boolean;
  missingFields: string[];
}

export function calculateProfileCompletion(formData: FormDataInput): ProfileCompletionResult {
  const completed = REQUIRED_FIELDS.filter(f => f.getValue(formData)).length;
  const missingFields = REQUIRED_FIELDS.filter(f => !f.getValue(formData)).map(f => f.label);
  
  return {
    completed,
    total: REQUIRED_FIELDS.length,
    percentage: Math.round((completed / REQUIRED_FIELDS.length) * 100),
    isComplete: completed === REQUIRED_FIELDS.length,
    missingFields
  };
}
