// scan-document — extracts structured data from a receipt or invoice image
// stored in the `receipt-scans` bucket using Lovable AI Gateway (Gemini).
//
// Auth: verify_jwt is false at the config level; we validate the JWT in code
// so we can return clean 401s with CORS headers.
//
// Contract:
//   POST { storage_path: string, source: 'receipt'|'invoice', business_id: uuid }
//   -> 200 { job_id, status, extracted, confidence }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BodySchema = z.object({
  storage_path: z.string().min(1).max(512),
  source: z.enum(['receipt', 'invoice']),
  business_id: z.string().uuid(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const RECEIPT_PROMPT = `You are an expert receipt scanner for a business
accounting app. Extract these fields from the attached receipt image and
respond with ONLY valid JSON, no prose, matching this schema:

{
  "vendor": string,
  "date": "YYYY-MM-DD",
  "currency": "ISO 4217 code",
  "subtotal": number,
  "tax": number,
  "total": number,
  "tax_rate": number | null,
  "category": string | null,
  "line_items": [{ "description": string, "quantity": number, "unit_price": number, "amount": number }],
  "payment_method": string | null,
  "confidence": number (0-100, your overall confidence),
  "field_confidence": {
    "vendor": number, "date": number, "currency": number,
    "subtotal": number, "tax": number, "total": number
  }
}

If a field is unreadable use null. Numbers must be plain (no currency symbols).
"field_confidence" values are 0-100 and describe how sure you are of each
specific field. Always include a field_confidence entry for every field you
returned.`;

const INVOICE_PROMPT = `You are an expert invoice scanner. Extract these
fields from the attached invoice image and respond with ONLY valid JSON:

{
  "vendor": string,
  "invoice_number": string | null,
  "issue_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "currency": "ISO 4217 code",
  "subtotal": number,
  "tax": number,
  "total": number,
  "bill_to": { "name": string | null, "email": string | null, "address": string | null },
  "line_items": [{ "description": string, "quantity": number, "unit_price": number, "amount": number }],
  "confidence": number (0-100),
  "field_confidence": {
    "vendor": number, "invoice_number": number, "issue_date": number,
    "due_date": number, "currency": number,
    "subtotal": number, "tax": number, "total": number
  }
}

"field_confidence" values are 0-100 per-field confidences. Always include an
entry for every field you returned.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // Validate JWT in code
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json(401, { error: 'Missing bearer token' });

  const authClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userRes.user) return json(401, { error: 'Invalid token' });
  const user = userRes.user;

  // Validate body
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json(400, { error: parsed.error.flatten().fieldErrors });
  }
  const { storage_path, source, business_id } = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Membership check (defense in depth on top of storage RLS)
  const { data: isMember, error: memberErr } = await admin.rpc(
    'is_business_member',
    { _user_id: user.id, _business_id: business_id },
  );
  if (memberErr || !isMember) return json(403, { error: 'Not a business member' });

  // Storage path must be within the business's folder
  if (!storage_path.startsWith(`${business_id}/`)) {
    return json(400, { error: 'storage_path must be inside business folder' });
  }

  // Create the job row
  const { data: job, error: jobErr } = await admin
    .from('scan_jobs')
    .insert({
      business_id,
      user_id: user.id,
      source,
      storage_path,
      status: 'processing',
    })
    .select('id')
    .single();
  if (jobErr || !job) return json(500, { error: 'Failed to create scan job' });

  try {
    // Signed URL so the model can fetch the image
    const { data: signed, error: signErr } = await admin.storage
      .from('receipt-scans')
      .createSignedUrl(storage_path, 60);
    if (signErr || !signed?.signedUrl) throw new Error('Sign URL failed');

    const prompt = source === 'receipt' ? RECEIPT_PROMPT : INVOICE_PROMPT;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        await admin.from('scan_jobs').update({
          status: 'failed',
          error: 'AI rate limit — please try again shortly',
        }).eq('id', job.id);
        return json(429, { error: 'Rate limit exceeded' });
      }
      if (aiRes.status === 402) {
        await admin.from('scan_jobs').update({
          status: 'failed',
          error: 'AI credits exhausted',
        }).eq('id', job.id);
        return json(402, { error: 'AI credits exhausted' });
      }
      throw new Error(`AI ${aiRes.status}: ${errText.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? '{}';
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(raw);
    } catch {
      // Model returned prose — save raw for debugging
      extracted = { _raw: raw };
    }
    const confidence =
      typeof extracted.confidence === 'number' ? extracted.confidence : null;

    await admin
      .from('scan_jobs')
      .update({
        status: 'done',
        extracted_json: extracted,
        confidence,
        error: null,
      })
      .eq('id', job.id);

    return json(200, {
      job_id: job.id,
      status: 'done',
      extracted,
      confidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from('scan_jobs')
      .update({ status: 'failed', error: message })
      .eq('id', job.id);
    return json(500, { error: message, job_id: job.id });
  }
});
