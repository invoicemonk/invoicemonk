import { corsHeaders } from "@supabase/supabase-js/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const EmailSchema = z.object({
  email: z.string().email().max(255),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = EmailSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid email", is_disposable: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email } = parsed.data;
    const apiKey = Deno.env.get("ABSTRACTAPI_EMAIL_KEY");

    if (!apiKey) {
      console.error("ABSTRACTAPI_EMAIL_KEY not configured");
      return new Response(
        JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true }),
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
          JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          is_disposable: data.is_disposable_email?.value === true,
          deliverability: data.deliverability || "UNKNOWN",
          is_valid: data.is_valid_format?.value !== false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error("AbstractAPI request failed:", fetchErr);
      return new Response(
        JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("validate-email error:", err);
    return new Response(
      JSON.stringify({ is_disposable: false, deliverability: "UNKNOWN", is_valid: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
