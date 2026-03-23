import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOnlinePayment() {
  const [loading, setLoading] = useState(false);

  const createPaymentSession = async (verificationId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-session", {
        body: { verification_id: verificationId },
      });

      if (error) {
        toast.error(error.message || "Failed to create payment session");
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
        return data;
      }

      toast.error("No checkout URL received");
      return null;
    } catch (err) {
      console.error("Payment session error:", err);
      toast.error("Failed to initiate payment");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createPaymentSession, loading };
}

export function useStripeConnect() {
  const [loading, setLoading] = useState(false);

  const initiateConnect = async (businessId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        body: { business_id: businessId },
      });

      if (error) {
        toast.error(error.message || "Failed to start Stripe Connect setup");
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (data?.url) {
        window.location.href = data.url;
        return data;
      }

      toast.error("No onboarding URL received");
      return null;
    } catch (err) {
      console.error("Stripe Connect error:", err);
      toast.error("Failed to initiate Stripe Connect");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { initiateConnect, loading };
}

export function usePaystackSubaccount() {
  const [loading, setLoading] = useState(false);

  const createSubaccount = async (businessId: string, bankCode: string, accountNumber: string, businessName?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-paystack-subaccount", {
        body: { business_id: businessId, bank_code: bankCode, account_number: accountNumber, business_name: businessName },
      });

      if (error) {
        toast.error(error.message || "Failed to create Paystack subaccount");
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (data?.subaccount_code) {
        toast.success(`Bank account verified: ${data.account_name}`);
        return data;
      }

      toast.error("Failed to set up bank account");
      return null;
    } catch (err) {
      console.error("Paystack subaccount error:", err);
      toast.error("Failed to set up bank account");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createSubaccount, loading };
}
