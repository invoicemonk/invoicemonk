const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.log('TURNSTILE_SECRET_KEY not configured, skipping verification');
    return true; // Don't block if not configured
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });

    if (!response.ok) {
      console.error(`Turnstile verify returned ${response.status}`);
      return true; // Fail open
    }

    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return true; // Fail open
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Verify Turnstile token if provided
    let turnstileValid = true;
    if (body?.turnstile_token) {
      turnstileValid = await verifyTurnstileToken(body.turnstile_token);
    }

    if (!isValidEmail(body?.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email", is_disposable: false, turnstile_valid: turnstileValid }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = body.email;
    const apiKey = Deno.env.get("ABSTRACTAPI_EMAIL_KEY");

    if (!apiKey) {
      console.error("ABSTRACTAPI_EMAIL_KEY not configured");
      return new Response(
        JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true, turnstile_valid: turnstileValid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`AbstractAPI returned ${response.status}`);
        return new Response(
          JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true, turnstile_valid: turnstileValid }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          is_disposable: data.is_disposable_email?.value === true,
          deliverability: data.deliverability || "UNKNOWN",
          is_valid: data.is_valid_format?.value !== false,
          turnstile_valid: turnstileValid,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error("AbstractAPI request failed:", fetchErr);
      return new Response(
        JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true, turnstile_valid: turnstileValid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("validate-email error:", err);
    return new Response(
      JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true, turnstile_valid: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
