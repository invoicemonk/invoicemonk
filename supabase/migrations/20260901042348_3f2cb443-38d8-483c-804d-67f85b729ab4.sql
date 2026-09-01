REVOKE EXECUTE ON FUNCTION public.subscription_has_prepaid_coverage(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_has_prepaid_coverage(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_has_prepaid_coverage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_has_prepaid_coverage(uuid) TO service_role;