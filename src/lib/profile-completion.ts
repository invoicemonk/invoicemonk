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
  condition?: (data: FormDataInput) => boolean; // Optional condition for when field is required
}

export interface FormDataInput {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  addressCity: string;
  addressCountry: string;
  // Jurisdiction for dynamic field requirements
  jurisdiction?: string;
  // VAT fields for VAT-registered businesses
  isVatRegistered?: boolean;
  vatRegistrationNumber?: string;
  // CAC/Registration number
  cacNumber?: string;
}

// Required fields matching the database compute_business_compliance trigger:
// name, legal_name, tax_id, contact_email, address->city, address->country
// Plus jurisdiction-specific requirements
const REQUIRED_FIELDS: ProfileField[] = [
  { key: 'name', label: 'Business Name', getValue: (d) => !!d.name?.trim() },
  { key: 'legalName', label: 'Legal Name', getValue: (d) => !!d.legalName?.trim() },
  { key: 'taxId', label: 'Tax ID', getValue: (d) => !!d.taxId?.trim() },
  { key: 'email', label: 'Email', getValue: (d) => !!d.email?.trim() },
  { key: 'addressCity', label: 'City', getValue: (d) => !!d.addressCity?.trim() },
  { key: 'addressCountry', label: 'Country', getValue: (d) => !!d.addressCountry?.trim() },
  { 
    key: 'vatRegistrationNumber', 
    label: 'VAT Registration Number', 
    getValue: (d) => !!d.vatRegistrationNumber?.trim(),
    // Required for businesses that are VAT registered (Nigeria and others with VAT)
    condition: (d) => ['NG', 'GB', 'DE', 'FR', 'CA'].includes(d.jurisdiction || '') && d.isVatRegistered === true
  },
];

export interface ProfileCompletionResult {
  completed: number;
  total: number;
  percentage: number;
  isComplete: boolean;
  missingFields: string[];
}

export function calculateProfileCompletion(formData: FormDataInput): ProfileCompletionResult {
  // Filter fields that are applicable based on conditions
  const applicableFields = REQUIRED_FIELDS.filter(f => 
    !f.condition || f.condition(formData)
  );
  
  const completed = applicableFields.filter(f => f.getValue(formData)).length;
  const missingFields = applicableFields.filter(f => !f.getValue(formData)).map(f => f.label);
  
  return {
    completed,
    total: applicableFields.length,
    percentage: Math.round((completed / applicableFields.length) * 100),
    isComplete: completed === applicableFields.length,
    missingFields
  };
}
