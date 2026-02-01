// Shared validation utilities for edge functions

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateUUID(value: unknown, fieldName: string): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return { field: fieldName, message: `${fieldName} is required` };
  }
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  if (!UUID_REGEX.test(value)) {
    return { field: fieldName, message: `${fieldName} must be a valid UUID` };
  }
  return null;
}

export function validateString(
  value: unknown, 
  fieldName: string, 
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationError | null {
  const { required = false, minLength = 0, maxLength = 10000 } = options;
  
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { field: fieldName, message: `${fieldName} is required` };
    }
    return null;
  }
  
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  
  if (value.length < minLength) {
    return { field: fieldName, message: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (value.length > maxLength) {
    return { field: fieldName, message: `${fieldName} must be at most ${maxLength} characters` };
  }
  
  return null;
}

export function validateAmount(value: unknown, fieldName: string): ValidationError | null {
  if (value === null || value === undefined) {
    return { field: fieldName, message: `${fieldName} is required` };
  }
  
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { field: fieldName, message: `${fieldName} must be a valid number` };
  }
  
  if (value <= 0) {
    return { field: fieldName, message: `${fieldName} must be positive` };
  }
  
  if (value > 999999999.99) {
    return { field: fieldName, message: `${fieldName} exceeds maximum allowed value` };
  }
  
  return null;
}

export function validateEnum<T extends string>(
  value: unknown, 
  fieldName: string, 
  allowedValues: readonly T[]
): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return { field: fieldName, message: `${fieldName} is required` };
  }
  
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  
  if (!allowedValues.includes(value as T)) {
    return { 
      field: fieldName, 
      message: `${fieldName} must be one of: ${allowedValues.join(', ')}` 
    };
  }
  
  return null;
}

export function validateDate(value: unknown, fieldName: string, required = false): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { field: fieldName, message: `${fieldName} is required` };
    }
    return null;
  }
  
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  
  // Check ISO date format (YYYY-MM-DD or full ISO)
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!dateRegex.test(value)) {
    return { field: fieldName, message: `${fieldName} must be a valid date format (YYYY-MM-DD)` };
  }
  
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return { field: fieldName, message: `${fieldName} is not a valid date` };
  }
  
  return null;
}

export function validateEmail(value: unknown, fieldName: string, required = false): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { field: fieldName, message: `${fieldName} is required` };
    }
    return null;
  }
  
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value) || value.length > 254) {
    return { field: fieldName, message: `${fieldName} must be a valid email address` };
  }
  
  return null;
}

// Sanitize string to prevent injection (removes HTML tags, trims)
export function sanitizeString(value: string): string {
  return value
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove remaining angle brackets
    .trim();
}

// CORS configuration for edge functions
// Dynamic CORS that allows any Lovable preview domain + production domains
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com') ||
    origin === 'https://app.invoicemonk.com' ||
    origin === 'https://invoicemonk.com' ||
    origin.startsWith('http://localhost:')
  );
}

export function getCorsHeaders(req: Request, isPublicEndpoint = false): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  
  // For public endpoints (verify-invoice, view-invoice), allow broader access
  if (isPublicEndpoint) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
  }
  
  // For protected endpoints, validate origin dynamically
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://app.invoicemonk.com';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

// Legacy CORS headers for backward compatibility during migration
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
