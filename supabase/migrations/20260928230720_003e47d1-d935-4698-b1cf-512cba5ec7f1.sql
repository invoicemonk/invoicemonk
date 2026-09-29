REVOKE ALL ON FUNCTION public.trg_product_invoices() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_product_simple() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_product_capture() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_product_event(text,text,text,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_product_event(text,text,text,text,uuid,jsonb) TO authenticated;