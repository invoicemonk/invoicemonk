
-- 1. Create the user_login_events table
CREATE TABLE public.user_login_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sign_in', 'sign_up')),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for fast lookups by user
CREATE INDEX idx_user_login_events_user_id ON public.user_login_events (user_id, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;

-- 4. Platform admins can read all events
CREATE POLICY "Platform admins can view all login events"
  ON public.user_login_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));

-- 5. Users can view their own login events
CREATE POLICY "Users can view own login events"
  ON public.user_login_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Service role inserts (edge function uses service role, bypasses RLS)
-- No INSERT policy needed for regular users since the edge function uses service role
