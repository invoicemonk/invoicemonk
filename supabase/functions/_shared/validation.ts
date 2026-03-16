// Shared validation utilities for edge functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ValidationError {
  field: string;
  message: string;
}

// === Object-returning validators (original) ===

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

// === String-returning wrappers (for edge functions using simpler API) ===

export function validateUUIDStr(value: unknown, fieldName: string): string | null {
  const err = validateUUID(value, fieldName);
  return err ? err.message : null;
}

export function validateAmountStr(value: unknown, fieldName: string): string | null {
  const err = validateAmount(value, fieldName);
  return err ? err.message : null;
}

export function validateStringStr(value: unknown, fieldName: string, maxLength = 1000): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (value.length > maxLength) return `${fieldName} must be at most ${maxLength} characters`;
  return null;
}

export function validateStringRequiredStr(value: unknown, fieldName: string, minLength = 0, maxLength = 1000): string | null {
  if (value === null || value === undefined || value === '') {
    if (minLength > 0) return `${fieldName} is required`;
    return null;
  }
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (typeof value === 'string' && value.trim().length < minLength) return `${fieldName} must be at least ${minLength} characters`;
  if (value.length > maxLength) return `${fieldName} must be at most ${maxLength} characters`;
  return null;
}

export function validateEmailStr(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') return `${fieldName} is required`;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value) || value.length > 254) return `${fieldName} must be a valid email address`;
  return null;
}

export function validateEnumStr<T extends string>(value: unknown, fieldName: string, allowedValues: readonly T[]): string | null {
  if (value === null || value === undefined || value === '') return `${fieldName} is required`;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (!allowedValues.includes(value as T)) return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
  return null;
}

export function validateDateStr(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value) || isNaN(new Date(value).getTime())) return `${fieldName} must be a valid date (YYYY-MM-DD)`;
  return null;
}

// HTML entity encoder to prevent injection when interpolating into HTML templates
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip URLs (http/https/ftp and www.) from user-provided text to prevent phishing
export function stripUrls(str: string): string {
  return str
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, '[link removed]')
    .replace(/ftp:\/\/[^\s<>"')\]]+/gi, '[link removed]')
    .replace(/www\.[^\s<>"')\]]+/gi, '[link removed]')
    .replace(/\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(com|net|org|io|co|app|dev|xyz|info|biz|me|us|uk|ng|za|ke|gh|de|fr|es|it|nl|au|ca|in|jp|ru|br|mx|ar|cl|se|no|dk|fi|pl|cz|pt|be|at|ch|ie|nz|sg|hk|tw|kr|ph|th|my|id|vn|ae|sa|qa|eg|ma|tz|rw|ug|site|online|store|shop|tech|pro|cloud|ai|gg|tv|cc|ly)(\/[^\s<>"')\]]*)?/gi, '[link removed]');
}

// Sanitize string to prevent injection (removes HTML tags, URLs, encodes entities, trims)
export function sanitizeString(value: string): string {
  return escapeHtml(
    stripUrls(
      value
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[<>]/g, '') // Remove remaining angle brackets
    ).trim()
  );
}

// === Header sanitization ===

/** Sanitize a string for use in email headers to prevent header injection. */
export function sanitizeHeaderValue(value: string): string {
  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
    .slice(0, 200);
}

// === CORS configuration ===

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

// === Rate Limiting ===

/**
 * Check rate limit using Postgres-based sliding window.
 * Returns true if request is allowed, false if rate limited.
 * 
 * @param serviceRoleKey - Service role key to create admin client
 * @param key - User ID or IP hash
 * @param endpoint - Function name
 * @param windowSeconds - Time window in seconds
 * @param maxRequests - Max requests in window
 */
export async function checkRateLimit(
  serviceRoleKey: string,
  key: string,
  endpoint: string,
  windowSeconds: number,
  maxRequests: number
): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_endpoint: endpoint,
      p_window_seconds: windowSeconds,
      p_max_requests: maxRequests,
    });
    
    if (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request (fail open)
      return true;
    }
    
    return data === true;
  } catch (err) {
    console.error('Rate limit exception:', err);
    // Fail open
    return true;
  }
}

/**
 * Helper to return a 429 response with proper CORS headers.
 */
export function rateLimitResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
  );
}

/**
 * Get a rate limit key from the request - extracts IP or falls back to a hash.
 */
export function getRateLimitKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}
