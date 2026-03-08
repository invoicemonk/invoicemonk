import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const THROTTLE_MS = 30 * 1000;

export const useIdleTimeout = (user: User | null, signOut: () => Promise<void>) => {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const throttleRef = useRef(0);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    if (now - throttleRef.current > THROTTLE_MS) {
      lastActivityRef.current = now;
      throttleRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();
    throttleRef.current = Date.now();

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));

    const interval = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        events.forEach((e) => window.removeEventListener(e, updateActivity));
        await signOut();
        navigate('/login?reason=idle', { replace: true });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, updateActivity));
    };
  }, [user, signOut, navigate, updateActivity]);
};
