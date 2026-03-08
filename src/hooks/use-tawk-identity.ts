import { useEffect, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Tawk_API?: {
      setAttributes: (
        attrs: Record<string, string>,
        callback?: (error: any) => void
      ) => void;
      endChat: () => void;
      logout?: () => void;
      hideWidget: () => void;
      showWidget: () => void;
      maximize: () => void;
      minimize: () => void;
      onLoad?: () => void;
      onChatMinimized?: () => void;
      customStyle?: any;
      visitor?: { email?: string };
    };
  }
}

function waitForTawk(timeout = 10000): Promise<NonNullable<Window["Tawk_API"]>> {
  return new Promise((resolve, reject) => {
    if (window.Tawk_API?.setAttributes) return resolve(window.Tawk_API);

    const start = Date.now();
    const check = () => {
      if (window.Tawk_API?.setAttributes) return resolve(window.Tawk_API);
      if (Date.now() - start > timeout) return reject(new Error("Tawk timeout"));
      setTimeout(check, 200);
    };

    // Try onLoad callback first
    if (window.Tawk_API) {
      window.Tawk_API.onLoad = () => resolve(window.Tawk_API!);
    }
    check();
  });
}

export function useTawkIdentity() {
  const identifiedEmailRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const injectIdentity = async (session: Session) => {
      if (!isMounted || !session?.user) return;
      if (identifiedEmailRef.current === session.user.email) return;

      const { data, error } = await supabase.functions.invoke("tawk-identity", {
        body: { userId: session.user.id },
      });

      if (error || !data?.hash) return;

      try {
        const tawk = await waitForTawk();
        if (!isMounted) return;

        tawk.setAttributes(
          {
            name: session.user.user_metadata?.full_name || "User",
            email: session.user.email || "",
            userId: session.user.id,
            hash: data.hash,
          },
          (err) => {
            if (!err) {
              identifiedEmailRef.current = session.user.email || null;
            }
          }
        );
      } catch (e) {
        // Tawk not loaded — silent fail
      }
    };

    const clearIdentity = async () => {
      identifiedEmailRef.current = null;
      try {
        const tawk = await waitForTawk(3000);
        tawk.endChat();
        tawk.logout?.();
      } catch {
        // Tawk not available
      }
    };

    // Mount: check existing session (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setTimeout(() => injectIdentity(session), 0);
      }
    });

    // Listen for auth changes (handles login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session) setTimeout(() => injectIdentity(session), 0);
        }
        if (event === "SIGNED_OUT") {
          clearIdentity();
        }
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);
}
