
-- Rate limiting table for edge functions
CREATE TABLE public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_rate_limit_log_key_endpoint_created 
  ON public.rate_limit_log (key, endpoint, created_at DESC);

-- Auto-cleanup: index for old entries
CREATE INDEX idx_rate_limit_log_created_at 
  ON public.rate_limit_log (created_at);

-- RLS: no direct user access needed, only service role
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Function to check and enforce rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_endpoint TEXT,
  p_window_seconds INTEGER,
  p_max_requests INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count INTEGER;
  _window_start TIMESTAMPTZ;
BEGIN
  _window_start := now() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Count requests in window
  SELECT COUNT(*) INTO _count
  FROM rate_limit_log
  WHERE key = p_key
    AND endpoint = p_endpoint
    AND created_at >= _window_start;
  
  -- If under limit, log this request and allow
  IF _count < p_max_requests THEN
    INSERT INTO rate_limit_log (key, endpoint) VALUES (p_key, p_endpoint);
    RETURN TRUE;
  END IF;
  
  -- Over limit
  RETURN FALSE;
END;
$$;

-- Cleanup function to purge old rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < now() - INTERVAL '10 minutes';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;
