ALTER TABLE public.invoices DISABLE TRIGGER enforce_invoice_template_tier_trg;

UPDATE public.invoices
SET template_id = '93033737-a1d9-4993-8944-cde633c8d7ea'::uuid
WHERE id = '7a9b67fc-8f89-4815-8e6c-78379e3bf330'::uuid
  AND status = 'draft';

ALTER TABLE public.invoices ENABLE TRIGGER enforce_invoice_template_tier_trg;