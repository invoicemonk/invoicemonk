-- Create a safe RPC wrapper for the referral_customer_ref_seq sequence
CREATE OR REPLACE FUNCTION public.nextval(seq_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the referral sequence
  IF seq_name != 'referral_customer_ref_seq' THEN
    RAISE EXCEPTION 'Access denied: only referral_customer_ref_seq is allowed';
  END IF;
  RETURN nextval('referral_customer_ref_seq');
END;
$$;