import { getJurisdictionConfig } from './jurisdiction-config';

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
  // Entity type for conditional requirements
  entityType?: 'individual' | 'business' | 'nonprofit';
  // Government ID (replaces taxId for new model)
  governmentIdValue?: string;
  // Document verification status (for individuals)
  documentVerificationStatus?: string;
}

// Required fields matching the database compute_business_compliance trigger:
// Adjusted per entity_type: individuals have fewer requirements
const REQUIRED_FIELDS: ProfileField[] = [
  { key: 'name', label: 'Business Name', getValue: (d) => !!d.name?.trim() },
  { 
    key: 'legalName', 
    label: 'Legal Name', 
    getValue: (d) => !!d.legalName?.trim(),
    // Not required for individuals
    condition: (d) => d.entityType !== 'individual',
  },
  { 
    key: 'governmentId', 
    label: 'Government ID', 
    getValue: (d) => !!(d.governmentIdValue?.trim() || d.taxId?.trim()),
    // Required for businesses; optional for individuals and nonprofits
    condition: (d) => d.entityType === 'business' || (!d.entityType),
  },
  { key: 'email', label: 'Email', getValue: (d) => !!d.email?.trim() },
  { 
    key: 'addressCity', 
    label: 'City', 
    getValue: (d) => !!d.addressCity?.trim(),
    // Not required for individuals
    condition: (d) => d.entityType !== 'individual',
  },
  { key: 'addressCountry', label: 'Country', getValue: (d) => !!d.addressCountry?.trim() },
  { 
    key: 'vatRegistrationNumber', 
    label: 'VAT Registration Number', 
    getValue: (d) => !!d.vatRegistrationNumber?.trim(),
    // Required for businesses that are VAT registered (Nigeria and others with VAT)
    condition: (d) => getJurisdictionConfig(d.jurisdiction || '').showVat && d.isVatRegistered === true
  },
  {
    key: 'documentVerification',
    label: 'Identity Document Upload',
    getValue: (d) => d.documentVerificationStatus !== 'not_uploaded' && !!d.documentVerificationStatus,
    // Required for individuals only
    condition: (d) => d.entityType === 'individual',
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
