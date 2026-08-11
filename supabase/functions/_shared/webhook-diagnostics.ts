// Shared, secret-safe diagnostics for Stripe webhook signature failures.
//
// Never logs secret values. Only shape/presence information plus non-sensitive
// facts pulled from the request that failed verification.

export interface SignatureDiagnostics {
  function_name: string;
  reason: 'signature_mismatch';
  secret_env_var: string;
  secret_present: boolean;
  secret_prefix_ok: boolean; // true when the stored secret starts with "whsec_"
  secret_length: number;
  signature_header_present: boolean;
  signature_timestamp: string | null;
  signature_scheme_count: number;
  body_length: number;
  event_id: string | null;
  event_type: string | null;
  livemode: boolean | null;
  error_message: string;
}

/** Pull the `t=` timestamp and count the `v1=` signatures without exposing them. */
function parseSignatureHeader(header: string | null) {
  if (!header) {
    return { timestamp: null as string | null, schemeCount: 0 };
  }
  let timestamp: string | null = null;
  let schemeCount = 0;
  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    const k = (key ?? '').trim();
    if (k === 't') timestamp = (value ?? '').trim() || null;
    if (k.startsWith('v')) schemeCount += 1;
  }
  return { timestamp, schemeCount };
}

/** Best-effort read of identifying fields from an unverified body. */
function peekEvent(body: string) {
  try {
    const parsed = JSON.parse(body) as {
      id?: unknown;
      type?: unknown;
      livemode?: unknown;
    };
    return {
      event_id: typeof parsed.id === 'string' ? parsed.id : null,
      event_type: typeof parsed.type === 'string' ? parsed.type : null,
      livemode: typeof parsed.livemode === 'boolean' ? parsed.livemode : null,
    };
  } catch {
    return { event_id: null, event_type: null, livemode: null };
  }
}

export function buildSignatureDiagnostics(params: {
  functionName: string;
  secretEnvVar: string;
  secret: string | undefined;
  signatureHeader: string | null;
  body: string;
  error: unknown;
}): SignatureDiagnostics {
  const { timestamp, schemeCount } = parseSignatureHeader(params.signatureHeader);
  const { event_id, event_type, livemode } = peekEvent(params.body);
  const secret = params.secret ?? '';

  return {
    function_name: params.functionName,
    reason: 'signature_mismatch',
    secret_env_var: params.secretEnvVar,
    secret_present: secret.length > 0,
    secret_prefix_ok: secret.startsWith('whsec_'),
    secret_length: secret.length,
    signature_header_present: !!params.signatureHeader,
    signature_timestamp: timestamp,
    signature_scheme_count: schemeCount,
    body_length: params.body.length,
    event_id,
    event_type,
    livemode,
    error_message: params.error instanceof Error ? params.error.message : String(params.error),
  };
}

/** Log the diagnostics as a single structured line. */
export function logSignatureDiagnostics(diag: SignatureDiagnostics) {
  console.error(
    `${diag.function_name} SIGNATURE_MISMATCH ${JSON.stringify(diag)}`,
  );
}
