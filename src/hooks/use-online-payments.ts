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
        // Redirect to checkout
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
