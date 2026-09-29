ALTER FUNCTION public.get_product_feedback_prompt(uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_product_discovery_overview(integer) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.get_product_feedback_prompt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_product_discovery_overview(integer) FROM PUBLIC, anon;