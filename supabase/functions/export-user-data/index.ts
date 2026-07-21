// export-user-data — GDPR / user data-portability endpoint used by the mobile
// Settings > Privacy screen. Bundles the calling user's profile + all
// businesses they own into a single JSON file, uploads it to the private
// "exports" bucket, emails the download link via Brevo, and returns the link.
//
// Contract:
//   POST /functions/v1/export-user-data
//   -> 200 { success: true, file_url, filename }

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const BREVO = Deno.env.get('BREVO_API_KEY');
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'noreply@invoicemonk.com';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendBrevo(to: string, subject: string, html: string) {
  if (!BREVO) return false;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'InvoiceMonk', email: SMTP_FROM },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return json(401, { error: 'Invalid token' });
  const user = userData.user;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const [profile, memberships, prefs, sessions] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    admin.from('business_members').select('business_id, role, created_at').eq('user_id', user.id),
    admin.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('user_login_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
  ]);

  const businessIds = (memberships.data ?? []).map(m => m.business_id);
  const businesses = businessIds.length
    ? (await admin.from('businesses').select('*').in('id', businessIds)).data
    : [];

  const invoices = businessIds.length
    ? (await admin.from('invoices').select('id, invoice_number, status, total_amount, currency, issue_date, business_id').in('business_id', businessIds).limit(5000)).data
    : [];
  const clients = businessIds.length
    ? (await admin.from('clients').select('id, name, email, phone, business_id').in('business_id', businessIds).limit(5000)).data
    : [];
  const expenses = businessIds.length
    ? (await admin.from('expenses').select('id, amount, currency, category, expense_date, business_id').in('business_id', businessIds).limit(5000)).data
    : [];

  const bundle = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    profile: profile.data,
    preferences: prefs.data,
    memberships: memberships.data ?? [],
    businesses: businesses ?? [],
    invoices: invoices ?? [],
    clients: clients ?? [],
    expenses: expenses ?? [],
    recent_logins: sessions.data ?? [],
  };

  const content = JSON.stringify(bundle, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = businessIds[0] ?? user.id; // fits exports-bucket RLS when possible
  const filename = `user-data-${user.id}-${stamp}.json`;
  const objectPath = `${folder}/${filename}`;

  const { error: upErr } = await admin.storage
    .from('exports')
    .upload(objectPath, new Blob([content], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: true,
    });
  if (upErr) return json(500, { error: `Upload failed: ${upErr.message}` });

  const { data: signed, error: signErr } = await admin.storage
    .from('exports')
    .createSignedUrl(objectPath, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) return json(500, { error: 'Sign URL failed' });

  if (user.email) {
    await sendBrevo(
      user.email,
      'Your InvoiceMonk data export is ready',
      `<p>Hi,</p><p>Your data export is ready. The link is valid for 7 days:</p>
       <p><a href="${signed.signedUrl}">Download my data</a></p>
       <p>— InvoiceMonk</p>`,
    ).catch(() => false);
  }

  await admin.rpc('log_audit_event', {
    _event_type: 'DATA_EXPORTED',
    _entity_type: 'user',
    _user_id: user.id,
    _metadata: { kind: 'user_data_portability', file_path: objectPath },
  }).catch(() => {});

  return json(200, {
    success: true,
    file_url: signed.signedUrl,
    filename,
  });
});
