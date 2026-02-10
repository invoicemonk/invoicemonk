import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Lock commissions that have been pending for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: lockedCommissions, error } = await supabase
      .from("commissions")
      .update({
        status: "locked" as const,
        locked_at: new Date().toISOString(),
      })
      .eq("status", "pending")
      .lt("created_at", thirtyDaysAgo.toISOString())
      .select("id, partner_id, commission_amount, currency");

    if (error) {
      console.error("Error locking commissions:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = lockedCommissions?.length || 0;
    console.log(`Locked ${count} commissions that were pending > 30 days`);

    // Log audit events for each locked commission
    for (const comm of lockedCommissions || []) {
      await supabase.rpc("log_audit_event", {
        _event_type: "COMMISSION_LOCKED",
        _entity_type: "commission",
        _entity_id: comm.id,
        _metadata: {
          partner_id: comm.partner_id,
          commission_amount: comm.commission_amount,
          currency: comm.currency,
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, locked_count: count }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Lock commissions error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
