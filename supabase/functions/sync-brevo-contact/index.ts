import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/validation.ts";
import { initSentry, captureException } from "../_shared/sentry.ts";

initSentry();

interface SyncPayload {
  email: string;
  attributes?: Record<string, unknown>;
  listIds?: number[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Brevo not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: SyncPayload = await req.json();

    if (!payload.email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Record<string, unknown> = {
      email: payload.email,
      updateEnabled: true,
    };

    if (payload.attributes && Object.keys(payload.attributes).length > 0) {
      body.attributes = payload.attributes;
    }

    if (payload.listIds && payload.listIds.length > 0) {
      body.listIds = payload.listIds;
    }

    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brevo contacts API error (${response.status}):`, errorText);
      return new Response(
        JSON.stringify({ error: "Brevo API error", status: response.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseText = await response.text();
    console.log("Brevo contact synced:", payload.email);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-brevo-contact error:", error);
    captureException(error, { function_name: "sync-brevo-contact" });
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
