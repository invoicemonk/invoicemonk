import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Send email via Brevo
async function sendBrevoEmail(
  brevoApiKey: string,
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const smtpFrom = Deno.env.get("SMTP_FROM") || "noreply@invoicemonk.com";
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "InvoiceMonk", email: smtpFrom },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brevo API error (${response.status}):`, errorText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo email send error:", err);
    return false;
  }
}

function upgradeEmailTemplate(userName: string, tierName: string, nextBillingDate: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #1d6b5a 0%, #155a4a 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <span style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: white;">invoiceMonk</span>
    <h1 style="margin: 10px 0 0; font-size: 22px;">🎉 Upgrade Confirmed!</h1>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${userName},</p>
    <p>Thank you for upgrading to the <strong>${tierName}</strong> plan! Your subscription is now active.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1d6b5a;">
      <p style="margin: 0; color: #155a4a; font-size: 14px;">
        <strong>Plan:</strong> ${tierName}<br>
        <strong>Next billing date:</strong> ${nextBillingDate}
      </p>
    </div>
    <p>You now have access to all the features included in your plan. Here are some things you can do:</p>
    <ul style="color: #555;">
      <li>Create unlimited invoices and receipts</li>
      <li>Add team members to your business</li>
      <li>Use custom branding on your invoices</li>
      <li>Access audit logs and data exports</li>
    </ul>
    <div style="text-align: center; margin: 25px 0;">
      <a href="https://app.invoicemonk.com/dashboard" style="display: inline-block; background: #1d6b5a; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Dashboard →</a>
    </div>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Sent by InvoiceMonk · <a href="https://invoicemonk.com" style="color: #999;">invoicemonk.com</a>
    </p>
  </div>
</body>
</html>`;
}

async function sendUpgradeEmail(
  supabase: any,
  businessId: string,
  tier: string,
  periodEnd: string
) {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) {
    console.log("BREVO_API_KEY not configured, skipping upgrade email");
    return;
  }

  try {
    // Find business owner
    const { data: ownerMember } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerMember?.user_id) {
      console.log("No owner found for business:", businessId);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", ownerMember.user_id)
      .maybeSingle();

    if (!profile?.email) {
      console.log("No email found for owner:", ownerMember.user_id);
      return;
    }

    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    const nextBilling = new Date(periodEnd).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const sent = await sendBrevoEmail(
      brevoApiKey,
      profile.email,
      profile.full_name || "there",
      `Your InvoiceMonk ${tierName} plan is now active!`,
      upgradeEmailTemplate(profile.full_name || "there", tierName, nextBilling)
    );

    console.log(sent ? "Upgrade email sent to:" : "Failed to send upgrade email to:", profile.email);
  } catch (err) {
    console.error("Error sending upgrade email:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("Stripe secret key not configured");
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      console.error("CRITICAL: STRIPE_WEBHOOK_SECRET is not configured. Rejecting webhook.");
      return new Response(
        JSON.stringify({ error: "Webhook signature verification not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    try {
      // Use constructEventAsync for Deno's async SubtleCrypto
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Webhook signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);

        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string" 
            ? session.subscription 
            : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = session.metadata?.user_id || subscription.metadata?.user_id;
          const businessId = session.metadata?.business_id || subscription.metadata?.business_id;
          const tier = session.metadata?.tier || subscription.metadata?.tier || "professional";
          const pricingRegion = subscription.metadata?.pricing_region;
          const billingCurrency = subscription.metadata?.billing_currency;
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          if (!businessId) {
            console.error("No business_id in metadata - falling back to user_id lookup");
            if (userId) {
              const { data: userBusiness } = await supabase
                .from("business_members")
                .select("business_id, businesses(is_default)")
                .eq("user_id", userId)
                .limit(10);
              
              const defaultBusiness = userBusiness?.find((m: any) => m.businesses?.is_default) || userBusiness?.[0];
              if (defaultBusiness) {
                await updateSubscriptionByBusiness(supabase, subscription, defaultBusiness.business_id, tier, pricingRegion, billingCurrency, session.customer as string);
                await sendUpgradeEmail(supabase, defaultBusiness.business_id, tier, periodEnd);
              }
            }
            break;
          }

          // Resolve the business owner's user_id to populate on the subscription
          let resolvedUserId = userId;
          if (!resolvedUserId) {
            const { data: ownerMember } = await supabase
              .from("business_members")
              .select("user_id")
              .eq("business_id", businessId)
              .eq("role", "owner")
              .maybeSingle();
            resolvedUserId = ownerMember?.user_id || null;
          }

          // Check if business has existing subscription
          const { data: existingSub } = await supabase
            .from("subscriptions")
            .select("id")
            .eq("business_id", businessId)
            .maybeSingle();

          if (existingSub) {
            await supabase
              .from("subscriptions")
              .update({
                tier,
                status: "active",
                user_id: resolvedUserId,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: periodEnd,
                pricing_region: pricingRegion,
                billing_currency: billingCurrency,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingSub.id);

            console.log("Updated subscription for business:", businessId, "user_id:", resolvedUserId);
          } else {
            await supabase
              .from("subscriptions")
              .insert({
                business_id: businessId,
                user_id: resolvedUserId,
                tier,
                status: "active",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: periodEnd,
                pricing_region: pricingRegion,
                billing_currency: billingCurrency,
              });

            console.log("Created subscription for business:", businessId, "user_id:", resolvedUserId);
          }

          // Send upgrade confirmation email
          await sendUpgradeEmail(supabase, businessId, tier, periodEnd);

          // Log audit event
          await supabase.rpc("log_audit_event", {
            _event_type: "SUBSCRIPTION_CHANGED",
            _entity_type: "subscription",
            _user_id: userId,
            _business_id: businessId,
            _metadata: { tier, action: "upgraded", stripe_subscription_id: subscriptionId },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription updated:", subscription.id);

        const businessId = subscription.metadata?.business_id;
        const userId = subscription.metadata?.user_id;
        
        if (businessId) {
          await doUpdateSubscriptionByBusiness(supabase, subscription, businessId);
        } else if (userId) {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("business_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          if (sub?.business_id) {
            await doUpdateSubscriptionByBusiness(supabase, subscription, sub.business_id);
          } else {
            await doUpdateSubscription(supabase, subscription, userId);
          }
        } else {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("business_id, user_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          if (sub?.business_id) {
            await doUpdateSubscriptionByBusiness(supabase, subscription, sub.business_id);
          } else if (sub?.user_id) {
            await doUpdateSubscription(supabase, subscription, sub.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription deleted:", subscription.id);

        const { error } = await supabase
          .from("subscriptions")
          .update({
            tier: "starter",
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          console.error("Error updating cancelled subscription:", error);
        } else {
          console.log("Subscription cancelled, reverted to starter");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Payment failed for invoice:", invoice.id);

        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          const { data: subData } = await supabase
            .from("subscriptions")
            .select("id, business_id, businesses(name)")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          await supabase
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (subData?.id) {
            const businessName = (subData.businesses as any)?.name || 'Unknown business';
            await supabase.rpc('notify_admin_payment_failed', {
              _subscription_id: subData.id,
              _business_name: businessName
            });
            console.log("Admin notification created for payment failure");
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice paid:", invoice.id);

        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          // --- REFERRAL COMMISSION LOGIC ---
          try {
            const { data: subRecord } = await supabase
              .from("subscriptions")
              .select("id, business_id, tier, billing_currency")
              .eq("stripe_subscription_id", subscriptionId)
              .maybeSingle();

            if (subRecord?.business_id) {
              const { data: ownerMember } = await supabase
                .from("business_members")
                .select("user_id")
                .eq("business_id", subRecord.business_id)
                .eq("role", "owner")
                .maybeSingle();

              if (ownerMember?.user_id) {
                const { data: referral } = await supabase
                  .from("referrals")
                  .select("id, partner_id, commission_business_id, is_self_referral")
                  .eq("referred_user_id", ownerMember.user_id)
                  .maybeSingle();

                if (referral && !referral.is_self_referral) {
                  if (!referral.commission_business_id) {
                    await supabase
                      .from("referrals")
                      .update({ commission_business_id: subRecord.business_id })
                      .eq("id", referral.id);
                    referral.commission_business_id = subRecord.business_id;
                    console.log("Locked commission_business_id:", subRecord.business_id);
                  }

                  if (referral.commission_business_id === subRecord.business_id) {
                    const { data: partner } = await supabase
                      .from("referral_partners")
                      .select("id, commission_rate, status")
                      .eq("id", referral.partner_id)
                      .maybeSingle();

                    if (partner && partner.status === "active") {
                      const grossAmount = (invoice.amount_paid || 0) / 100;
                      const commissionRate = Number(partner.commission_rate);
                      const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
                      const currency = subRecord.billing_currency || invoice.currency?.toUpperCase() || "USD";

                      const { data: existingComm } = await supabase
                        .from("commissions")
                        .select("id")
                        .eq("billing_event_id", invoice.id)
                        .maybeSingle();

                      if (!existingComm) {
                        await supabase.from("commissions").insert({
                          partner_id: partner.id,
                          referral_id: referral.id,
                          subscription_id: subRecord.id,
                          billing_event_id: invoice.id,
                          gross_amount: grossAmount,
                          commission_rate: commissionRate,
                          commission_amount: commissionAmount,
                          currency: currency,
                        });

                        console.log("Commission created:", commissionAmount, currency, "for partner:", partner.id);
                      }
                    }
                  }
                }
              }
            }
          } catch (commErr) {
            console.error("Commission processing error:", commErr);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

const TIER_ORDER: Record<string, number> = { starter: 0, starter_paid: 1, professional: 2, business: 3 };

async function doUpdateSubscription(
  supabase: any,
  subscription: Stripe.Subscription,
  userId: string
) {
  const metadataTier = subscription.metadata?.tier || "professional";

  // Check current DB tier to prevent downgrading manual upgrades
  const { data: currentSub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();

  const dbTier = currentSub?.tier || "starter";
  const tier = (TIER_ORDER[dbTier] ?? 0) > (TIER_ORDER[metadataTier] ?? 0) ? dbTier : metadataTier;

  if (tier !== metadataTier) {
    console.log("Tier-downgrade protection: keeping DB tier", dbTier, "instead of metadata tier", metadataTier);
  }

  const status = subscription.status === "active" ? "active" 
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "cancelled"
    : subscription.status === "trialing" ? "trialing"
    : "active";

  await supabase
    .from("subscriptions")
    .update({
      tier,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  console.log("Updated subscription for user:", userId, "tier:", tier, "status:", status);
}

async function doUpdateSubscriptionByBusiness(
  supabase: any,
  subscription: Stripe.Subscription,
  businessId: string
) {
  const metadataTier = subscription.metadata?.tier || "professional";

  // Check current DB tier to prevent downgrading manual upgrades
  const { data: currentSub } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("business_id", businessId)
    .maybeSingle();

  const dbTier = currentSub?.tier || "starter";
  const tier = (TIER_ORDER[dbTier] ?? 0) > (TIER_ORDER[metadataTier] ?? 0) ? dbTier : metadataTier;

  if (tier !== metadataTier) {
    console.log("Tier-downgrade protection: keeping DB tier", dbTier, "instead of metadata tier", metadataTier);
  }

  const status = subscription.status === "active" ? "active" 
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "canceled" ? "cancelled"
    : subscription.status === "trialing" ? "trialing"
    : "active";

  await supabase
    .from("subscriptions")
    .update({
      tier,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  console.log("Updated subscription for business:", businessId, "tier:", tier, "status:", status);
}

async function updateSubscriptionByBusiness(
  supabase: any,
  subscription: Stripe.Subscription,
  businessId: string,
  tier: string,
  pricingRegion: string | undefined,
  billingCurrency: string | undefined,
  stripeCustomerId: string
) {
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingSub) {
    await supabase
      .from("subscriptions")
      .update({
        tier,
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        pricing_region: pricingRegion,
        billing_currency: billingCurrency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSub.id);
  } else {
    await supabase
      .from("subscriptions")
      .insert({
        business_id: businessId,
        tier,
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        pricing_region: pricingRegion,
        billing_currency: billingCurrency,
      });
  }
  console.log("Updated subscription for business:", businessId);
}
