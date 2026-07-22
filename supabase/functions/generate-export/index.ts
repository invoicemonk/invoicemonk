// generate-export — mobile-friendly wrapper around export-records.
// Runs the export, uploads the file to the private "exports" bucket, updates
// the corresponding export_manifests row with the signed URL, and returns the
// signed URL to the caller. The mobile app never needs to stream large CSV
// payloads through the JSON body.
//
// Contract:
//   POST /functions/v1/generate-export
//   Body: { export_type, business_id?, currency_account_id?, date_from?, date_to?, format? }
//   -> 200 { success: true, file_url, filename, record_count, manifest_id }

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: 'Invalid token' });

  const body = await req.json().catch(() => null);
  if (!body?.export_type) return json(400, { error: 'export_type required' });

  // Delegate to export-records (which enforces tier + membership).
  const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/export-records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      apikey: ANON,
    },
    body: JSON.stringify(body),
  });

  const inner = await invokeRes.json().catch(() => ({}));
  if (!invokeRes.ok || !inner?.success || !inner.data || !inner.filename) {
    return json(invokeRes.status || 500, inner ?? { error: 'Export failed' });
  }

  const businessId: string | null = body.business_id ?? null;
  if (!businessId) {
    // Without a business folder we can't respect exports-bucket RLS.
    return json(400, { error: 'business_id required for mobile export upload' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const contentType = body.format === 'json' ? 'application/json' : 'text/csv';
  const objectPath = `${businessId}/${inner.filename}`;

  const { error: upErr } = await admin.storage
    .from('exports')
    .upload(objectPath, new Blob([inner.data], { type: contentType }), {
      contentType,
      upsert: true,
    });
  if (upErr) return json(500, { error: `Upload failed: ${upErr.message}` });

  const { data: signed, error: signErr } = await admin.storage
    .from('exports')
    .createSignedUrl(objectPath, 60 * 60 * 24 * 7); // 7-day link
  if (signErr || !signed?.signedUrl) {
    return json(500, { error: 'Failed to sign URL' });
  }

  // Backfill file_url onto the manifest created by export-records.
  if (inner.manifest_id) {
    await admin
      .from('export_manifests')
      .update({ file_url: signed.signedUrl, file_path: objectPath })
      .eq('id', inner.manifest_id);
  }

  return json(200, {
    success: true,
    manifest_id: inner.manifest_id ?? null,
    file_url: signed.signedUrl,
    file_path: objectPath,
    filename: inner.filename,
    record_count: inner.record_count,
    integrity_hash: inner.integrity_hash,
    generated_at: inner.generated_at,
  });
});
